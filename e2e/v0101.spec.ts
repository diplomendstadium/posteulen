/**
 * v0.10.1: the post office shows the borrowed owls above the offer, the owl choice offers loan
 * owls of the day only when no other owl can carry the letter, letters say when they arrived or
 * were sent off, owls on their way do not show what they carry, headings and place pictures span
 * the width of the contents.
 */
import type { Browser, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { borrowViaUi, registerViaUi } from './account-helpers.ts';
import { setGold } from './db-helpers.ts';

async function addContact(page: Page, name: string): Promise<void> {
  await page.goto('/app/adressbuch');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText(/^Anfrage gespeichert\./)).toBeVisible();
}

async function pair(browser: Browser, page: Page) {
  const anna = await registerViaUi(page);
  const otherContext = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const other = await otherContext.newPage();
  const ben = await registerViaUi(other);
  await addContact(page, ben.name);
  await addContact(other, anna.name);
  return { anna, ben, other, otherContext };
}

test.describe('Version 0.10.1', () => {
  test('Postamt: geliehene Eulen über dem Angebot, Überschriften und Bild in voller Breite', async ({
    page,
  }) => {
    await registerViaUi(page);
    await page.goto('/app/postamt');
    // Nothing borrowed yet: no section for it.
    await expect(page.getByRole('heading', { name: 'Deine Leiheulen' })).toHaveCount(0);
    const owl = await borrowViaUi(page);
    const borrowed = page.getByRole('heading', { name: 'Deine Leiheulen' });
    const offer = page.getByRole('heading', { name: 'Eulen leihen' });
    const intro = page.getByText(/^Das Eulenpostamt: Hier leihst du Eulen/);
    await expect(borrowed).toBeVisible();
    await expect(page.getByTestId('owl-card').filter({ hasText: owl })).toBeVisible();
    const y = async (locator: typeof borrowed) => (await locator.boundingBox())!.y;
    expect(await y(page.getByTestId('place-image'))).toBeLessThan(await y(intro));
    expect(await y(intro)).toBeLessThan(await y(borrowed));
    expect(await y(borrowed)).toBeLessThan(await y(offer));

    // Title, subheading and picture as wide as the contents; the headings centred.
    const width = async (locator: typeof borrowed) => (await locator.boundingBox())!.width;
    const content = await width(intro);
    for (const element of [
      page.getByRole('heading', { level: 1 }),
      borrowed,
      page.getByTestId('place-image').locator('img'),
    ]) {
      expect(Math.abs((await width(element)) - content)).toBeLessThan(2);
    }
    expect(
      await page
        .getByRole('heading', { level: 1 })
        .evaluate((element) => getComputedStyle(element).textAlign),
    ).toBe('center');
  });

  test('Eulenwahl ohne Leihangebot, solange eine eigene Eule passt; Briefkopf mit Empfang und Versand', async ({
    browser,
    page,
  }) => {
    const { anna, ben, other, otherContext } = await pair(browser, page);
    // A burrowing owl only carries the short parchment.
    setGold(anna.name, 300);
    await page.goto('/app/menagerie');
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Kanincheneule kaufen' }).click();
    await page.getByLabel('Name (2–20 Zeichen)').fill('Elfi');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('heading', { name: 'Elfi', exact: true })).toBeVisible();

    await page.goto('/app/adressbuch');
    await page
      .getByTestId('person-contact')
      .filter({ hasText: ben.name })
      .getByRole('link', { name: 'Brief schreiben' })
      .click();
    await page.getByLabel('Text').fill('Hallo Ben!');
    const choice = page.getByRole('group', { name: 'Welche Eule soll fliegen?' });
    // Elfi can carry a short letter: no loan owls of the day.
    await expect(choice.getByRole('radio', { name: /Elfi/ })).toBeChecked();
    await expect(choice.locator('.hint.offer')).toHaveCount(0);
    // A long letter: Elfi cannot carry it – now the loan owls of the day are offered.
    await page.getByLabel(/Lang – bis 15 000 Zeichen/).check();
    await expect(choice.getByRole('radio', { name: /Elfi/ })).toBeDisabled();
    await expect(choice.locator('.hint.offer').first()).toBeVisible();
    await expect(page.getByText(/Du kannst eine Leiheule des Tages nehmen/)).toBeVisible();
    // Back to the short letter and send it with Elfi.
    await page.getByLabel(/Kurz – bis 800 Zeichen/).check();
    await choice.getByRole('radio', { name: /Elfi/ }).check();
    await page.getByRole('button', { name: 'Absenden' }).click();
    await expect(page.getByText('Die Eule ist losgeflogen.')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('li.letter.mine .meta').first()).toContainText(
      /^Abgeschickt am \d{2}\.\d{2}\.\d{4} um \d{2}:\d{2}/,
    );

    // On its way the card does not say what the owl carries.
    await page.goto('/app/eulen');
    const elfi = page.getByTestId('owl-card').filter({ hasText: 'Elfi' });
    await expect(elfi).toContainText(/Fliegt gerade|Schläft auf dem|Rastet bei/);
    await expect(elfi.getByTestId('owl-cargo')).toHaveCount(0);

    // Ben sees when the letter arrived, not when it was written.
    await other.goto('/app/briefe');
    await other.getByRole('link', { name: new RegExp(anna.name) }).click({ timeout: 60_000 });
    const received = other.locator('li.letter').filter({ hasText: 'Hallo Ben!' }).locator('.meta');
    await expect(received).toContainText(/^Empfangen am \d{2}\.\d{2}\.\d{4} um \d{2}:\d{2}/, {
      timeout: 60_000,
    });
    await otherContext.close();
  });
});
