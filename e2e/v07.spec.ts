/**
 * Version 0.7 in the browser: greeting on the overview, current name in the settings, rest at
 * the recipient with a reply through the visiting owl, burning all letters, the world map and
 * the start page with login box and group picture of the same size.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { borrowViaUi, registerViaUi } from './account-helpers.ts';
import { setGold } from './db-helpers.ts';

async function addContact(page: Page, name: string): Promise<void> {
  await page.goto('/app/adressbuch');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText(/^Anfrage gespeichert\./)).toBeVisible();
}

test.describe('Version 0.7', () => {
  test('Begrüßung nach Tageszeit und aktueller Nutzername', async ({ page }) => {
    const me = await registerViaUi(page);
    await page.goto('/app');
    const greeting = page.getByTestId('greeting');
    await expect(greeting.getByRole('heading')).toContainText(me.name);
    await expect(greeting.getByRole('heading')).toHaveText(
      /^(Guten Morgen|Guten Tag|Guten Abend|Hallo .*, du Nachteule)/,
    );
    await expect(greeting).toContainText(/Bei dir zu Hause ist es gerade \d\d:\d\d Uhr\./);

    await page.goto('/app/einstellungen');
    await expect(page.getByTestId('current-name')).toContainText(me.name);
  });

  test('Rast beim Empfänger, Antwort mit der Gast-Eule, alle Briefe verbrennen', async ({
    browser,
    page,
  }) => {
    test.setTimeout(150_000);
    const anna = await registerViaUi(page);
    const otherContext = await browser.newContext({ locale: 'de-DE' });
    const other = await otherContext.newPage();
    const ben = await registerViaUi(other);
    await addContact(page, ben.name);
    await addContact(other, anna.name);

    // Anna sends with a loan owl that rests 48 hours with Ben (in the test: about 90 seconds).
    const owl = await borrowViaUi(page);
    await page.goto('/app/adressbuch');
    await page.getByTestId('person-contact').getByRole('link', { name: 'Brief schreiben' }).click();
    await page.getByLabel('Text').fill('Magst du mir antworten?');
    await page.getByLabel('Rast bei jedem Empfänger').selectOption('48');
    // v0.8.5: the owl choice appears by itself.
    await page.getByRole('button', { name: 'Absenden' }).click();
    await expect(page.getByText('Die Eule ist losgeflogen.')).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText(new RegExp(`(Unterwegs mit|Gebracht von) ${owl} \\(.*, Leiheule\\)`)),
    ).toBeVisible();

    // Ben sees the owl as a guest – clearly marked – and hands it a reply.
    await other.goto('/app/eulen');
    await expect(other.getByTestId('guest-owl')).toBeVisible({ timeout: 60_000 });
    await expect(other.getByTestId('guest-owl')).toContainText('Nur zur Rast hier!');
    await other.getByRole('button', { name: `Antwort an ${anna.name} mitgeben` }).click();
    await other.getByLabel('Text').fill('Gern, hier ist meine Antwort.');
    // v0.7.1: replying with the visiting owl – no rest option, no other owls.
    await expect(other.getByLabel('Rast bei jedem Empfänger')).toBeHidden();
    // v0.8.5: the owl choice appears by itself.
    const guestChoice = other.locator('input[name="letter-owl"][value^="guest:"]');
    await expect(guestChoice).toBeChecked();
    await expect(other.locator('input[name="letter-owl"]')).toHaveCount(1);
    await expect(other.getByText(/Rastet gerade bei dir/)).toBeVisible();
    await other.getByRole('button', { name: 'Absenden' }).click();
    await expect(other.getByTestId('owl-overlay')).toContainText(`${owl} fliegt los`);
    await other.goto('/app/eulen');
    await expect(other.getByTestId('guest-owl')).toBeHidden();

    // The reply reaches Anna with the loan owl, which then goes back to the Menagerie.
    await page.goto(`/app/briefe`);
    await page.getByRole('link', { name: new RegExp(ben.name) }).click();
    await expect(page.getByText('Gern, hier ist meine Antwort.')).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByText(new RegExp(`Gebracht von ${owl} \\(.*, Leiheule\\)`)).first(),
    ).toBeVisible();

    // Burning all letters: asked first, then the fireplace.
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('verbrennen');
      void dialog.accept();
    });
    await page.getByRole('button', { name: 'Alle Briefe verbrennen' }).click();
    await expect(page.getByTestId('owl-overlay')).toHaveAttribute('data-kind', 'burn');
    await expect(page).toHaveURL(/\/app\/briefe$/);
    await otherContext.close();
  });

  test('Weltkarte: ganz herausgezoomt passt die Welt ins Quadrat; Zurücksetzen auf die Startansicht', async ({
    page,
  }) => {
    await registerViaUi(page);
    await page.goto('/app/karte');
    await expect(page.locator('path.country').first()).toBeAttached();
    const viewBox = () =>
      page.locator('.map svg').evaluate((svg) => {
        const [, , w, h] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
        return {
          w,
          h,
          view: svg.getAttribute('viewBox'),
          countries: svg.querySelectorAll('path.country').length,
        };
      });
    await expect.poll(async () => (await viewBox()).w).toBeLessThan(30_000);
    const start = await viewBox();
    for (let i = 0; i < 20; i++) await page.getByRole('button', { name: 'Verkleinern' }).click();
    const box = await viewBox();
    expect(box.w).toBe(box.h);
    // About 34 500 km wide: the whole world.
    expect(box.w).toBeGreaterThan(30_000);
    expect(box.countries).toBeGreaterThan(200);
    // v0.7.1: the reset button goes back to the view the map opened with.
    await page.getByRole('button', { name: 'Ansicht zurücksetzen' }).click();
    expect((await viewBox()).view).toBe(start.view);
  });

  test('v0.7.1: Kaufen nur nach Rückfrage; Nachricht an den Admin einmal am Tag', async ({
    page,
  }) => {
    const me = await registerViaUi(page);
    setGold(me.name, 300);
    await page.goto('/app/menagerie');
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Waldkauz wirklich für 6,0 Gold kaufen?');
      void dialog.dismiss();
    });
    await page.getByRole('button', { name: 'Waldkauz kaufen' }).click();
    await expect(page).toHaveURL(/\/app\/menagerie$/);

    await page.goto('/app/einstellungen');
    const feedback = page.getByTestId('feedback');
    await expect(feedback).toContainText('nicht verschlüsselt');
    await feedback
      .getByLabel('Deine Nachricht')
      .fill('Die Eulen sind toll, nur die Karte lädt langsam.');
    await feedback.getByRole('button', { name: 'An den Admin schicken' }).click();
    await expect(feedback).toContainText('Danke! Deine Nachricht ist beim Admin angekommen.');
    await expect(feedback).toContainText('Heute hast du schon eine Nachricht geschickt.');
    await expect(feedback.getByLabel('Deine Nachricht')).toBeHidden();
  });

  test('Startseite: Anmeldung und Gruppenbild gleich groß, Fußzeile in einer Farbe', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(page.locator('.footer-links a')).toHaveCount(5);
    const colours = await page
      .locator('.footer-links a')
      .evaluateAll((links) => links.map((link) => getComputedStyle(link).color));
    expect(new Set(colours).size).toBe(1);
    test.skip(!testInfo.project.name.includes('desktop'), 'nebeneinander nur auf dem Desktop');
    const login = await page.locator('.columns > .card').boundingBox();
    const group = await page.locator('.columns > .group').boundingBox();
    expect(Math.abs((login?.width ?? 0) - (group?.width ?? 1))).toBeLessThan(2);
    expect(Math.abs((login?.height ?? 0) - (group?.height ?? 1))).toBeLessThan(2);
    expect(Math.abs((login?.y ?? 0) - (group?.y ?? 1))).toBeLessThan(2);
  });
});
