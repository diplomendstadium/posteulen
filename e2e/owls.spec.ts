import type { Browser, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';
import { looksActive, setGold, setOwlEnergy } from './db-helpers.ts';

async function addContact(page: Page, name: string): Promise<void> {
  await page.goto('/app/adressbuch');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText(/^Anfrage gespeichert\./)).toBeVisible();
}

/** Two coupled accounts; Anna gets gold. */
async function pair(browser: Browser, page: Page, options: { benKeys?: string[] } = {}) {
  const anna = await registerViaUi(page);
  const otherContext = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const other = await otherContext.newPage();
  const ben = await registerViaUi(other, options.benKeys ? { mapKeys: options.benKeys } : {});
  await addContact(page, ben.name);
  await addContact(other, anna.name);
  setGold(anna.name, 300);
  // v1.3: only active players give gold or owls (SPEC 9.1.5).
  looksActive(anna.name);
  await page.goto('/app');
  return { anna, ben, other, otherContext };
}

async function buyAndName(page: Page, species: string, name: string): Promise<void> {
  await page.goto('/app/menagerie/innen');
  // v0.7.1: a purchase is confirmed first.
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: `${species} kaufen` }).click();
  await expect(page).toHaveURL(/\/app\/eulen$/);
  await expect(
    page.getByRole('heading', { name: new RegExp(`Neuzugang heißen\\? \\(${species}\\)`) }),
  ).toBeVisible();
  await page.getByLabel('Name (2–20 Zeichen)').fill(name);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

test.describe('Eulen (Stufe 3, SPEC 8.5, 8.7, 9.2, 9.3, 17.4)', () => {
  test('kaufen, benennen, streicheln und füttern mit Einblendung', async ({ page }) => {
    const me = await registerViaUi(page);
    await page.goto('/app/menagerie/innen');
    // 3,0 Gold reichen für keine Eule.
    await expect(page.getByRole('button', { name: 'Waldkauz kaufen' })).toBeDisabled();
    setGold(me.name, 100);
    await page.reload();
    await buyAndName(page, 'Waldkauz', 'Waldi');
    await expect(page.locator('.gold')).toContainText('4,0 Gold');
    const card = page.getByTestId('owl-card');
    await expect(card).toContainText('Waldkauz');
    await expect(card).toContainText(/Energie \d+ von 430/);
    // v0.10: full energy – biscuit and snack still once a day each, then the owl is full.
    setOwlEnergy(me.name, 1);
    await page.reload();

    await card.getByRole('button', { name: 'Streicheln' }).click();
    const overlay = page.getByTestId('owl-overlay');
    await expect(overlay).toHaveAttribute('data-kind', 'petting');
    await expect(overlay).toContainText('Waldi genießt das Streicheln');
    await expect(overlay.getByRole('img')).toHaveAttribute('alt', /Waldkauz/);
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();

    await card.getByRole('button', { name: 'Eulenkeks (0,1 Gold)' }).click();
    await expect(overlay).toHaveAttribute('data-kind', 'feeding');
    await overlay.getByRole('button', { name: 'Bild schließen' }).click();
    await expect(overlay).toBeHidden();
    // v1.3.1: the same text, crossed out; the reason is read out.
    const fed = card.getByRole('button', {
      name: 'Eulenkeks (0,1 Gold) – satt, heute schon gefüttert',
    });
    await expect(fed).toBeDisabled();
    await expect(fed).toHaveText('Eulenkeks (0,1 Gold)');
    await expect(fed).toHaveCSS('text-decoration-line', 'line-through');
    await expect(page.locator('.gold')).toContainText('3,9 Gold');

    // v0.5: water and the favourite snack, motivation with its effect on speed and recovery.
    await expect(card.getByTestId('owl-motivation')).toContainText('Motivation 120 %');
    await expect(card).toContainText('Geschwindigkeit 25,0 km/h +20 %');
    await card.getByRole('button', { name: 'Wasser geben' }).click();
    await expect(overlay).toHaveAttribute('data-kind', 'drinking');
    await page.keyboard.press('Escape');
    await expect(
      card.getByRole('button', { name: 'Wasser geben – heute schon getrunken' }),
    ).toBeDisabled();
    await card.getByRole('button', { name: 'Haselnüsse geben (0,2 Gold)' }).click();
    await expect(overlay).toHaveAttribute('data-kind', 'snack');
    await page.keyboard.press('Escape');
    await expect(
      card.getByRole('button', {
        name: 'Haselnüsse geben (0,2 Gold) – satt, heute schon genascht',
      }),
    ).toBeDisabled();
    await expect(page.locator('.gold')).toContainText('3,7 Gold');
    // v0.10: hungry again (e.g. after a flight) – another biscuit, paid again.
    setOwlEnergy(me.name, 0.5);
    await page.reload();
    await card.getByRole('button', { name: 'Eulenkeks (0,1 Gold)' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.gold')).toContainText('3,6 Gold');

    await page.goto('/app/einstellungen');
    await expect(page.getByRole('cell', { name: 'Eulenkauf' })).toBeVisible();
    // v0.10: two biscuits – each one paid.
    await expect(page.getByRole('cell', { name: 'Futter' })).toHaveCount(2);
  });

  test('v0.5.1: Nickerchen bei Tag zu Hause, nicht nach dem Streicheln', async ({ page }) => {
    const me = await registerViaUi(page);
    setGold(me.name, 100);
    await buyAndName(page, 'Schleiereule', 'Schleier');
    // Noon UTC (daylight at the home in France) and a roll that always naps.
    const noon = new Date();
    noon.setUTCHours(12, 0, 0, 0);
    await page.clock.setFixedTime(noon);
    await page.addInitScript(() => {
      Math.random = () => 0.1;
    });
    await page.reload();
    const picture = page.getByTestId('owl-card').first().locator('.picture img');
    await expect(picture).toHaveAttribute('src', /napHome/);
    await expect(picture).toHaveAttribute('alt', /Nickerchen/);
    // Right after an interaction the owl is awake for ten minutes (the server stores the time;
    // the browser compares with its own clock – one minute later here).
    await page.getByRole('button', { name: 'Streicheln' }).click();
    await page.keyboard.press('Escape');
    await page.clock.setFixedTime(new Date(Date.now() + 60_000));
    await page.reload();
    await expect(picture).not.toHaveAttribute('src', /napHome/);
  });

  test('Einblendung ohne Animation bei reduzierter Bewegung, schließt sich selbst', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const me = await registerViaUi(page);
    setGold(me.name, 100);
    await buyAndName(page, 'Schleiereule', 'Schleier');
    await page.getByRole('button', { name: 'Streicheln' }).click();
    const overlay = page.getByTestId('owl-overlay');
    await expect(overlay).toBeVisible();
    expect(await overlay.evaluate((element) => getComputedStyle(element).animationName)).toBe(
      'none',
    );
    // The page stays usable while the picture is shown.
    await page.getByRole('link', { name: 'Übersicht' }).first().click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(overlay).toBeHidden({ timeout: 10_000 });
  });

  test('Gold per Eule: Knopf an der Eule, Abflugbild, Ankunftsbild im Systemchat, Buchungen', async ({
    browser,
    page,
  }) => {
    const { anna, other, otherContext } = await pair(browser, page);
    // Ben is not in the app while the owl lands (help page: no live connection).
    await other.goto('/hilfe');
    // v0.10: only species that carry gold get the button – a tawny owl does not.
    setGold(anna.name, 300);
    await buyAndName(page, 'Waldkauz', 'Waldi');
    await buyAndName(page, 'Bartkauz', 'Bruno');
    const owl = 'Bruno';
    const waldi = page.getByTestId('owl-card').filter({ hasText: 'Waldi' });
    await expect(waldi).toContainText('Trägt kurzes und langes Pergament');
    await expect(waldi.getByRole('button', { name: 'Gold verschicken' })).toHaveCount(0);
    const bruno = page.getByTestId('owl-card').filter({ hasText: owl });
    await expect(bruno).toContainText('Trägt kurzes und langes Pergament sowie Gold');
    await bruno.getByRole('button', { name: 'Gold verschicken' }).click();
    const dialog = page.getByTestId('gold-dialog');
    await dialog.getByLabel('An').selectOption({ index: 1 });
    await dialog.getByLabel('Betrag in Gold (z. B. 1,5)').fill('1,5');
    await dialog.getByRole('button', { name: 'Ankunft berechnen' }).click();
    await dialog.getByRole('button', { name: 'Gold losschicken' }).click();
    await expect(page.getByTestId('owl-overlay')).toHaveAttribute('data-kind', 'departure');
    await expect(page.getByTestId('owl-overlay')).toContainText(`${owl} bringt 1,5 Gold`);
    await page.keyboard.press('Escape');
    await page.goto('/app/einstellungen');
    await expect(page.getByText('Dein Gold: 10,5 Gold')).toBeVisible();

    // Ben opens the system chat: the arrival image is shown once (SPEC 9.2.6).
    await other.goto('/app/briefe/system');
    await expect(
      other.getByText(`${anna.name} hat dir 1,5 Gold geschickt – die Eule ist gelandet.`),
    ).toBeVisible({
      timeout: 30_000,
    });
    const overlay = other.getByTestId('owl-overlay');
    await expect(overlay).toHaveAttribute('data-kind', 'arrival');
    await expect(overlay).toContainText(`${owl} ist gelandet`);
    await other.keyboard.press('Escape');
    await other.reload();
    await expect(other.getByText(/hat dir 1,5 Gold geschickt/)).toBeVisible();
    await expect(overlay).toBeHidden();
    await other.goto('/app/einstellungen');
    await expect(other.getByText('Dein Gold: 4,5 Gold')).toBeVisible();
    await expect(other.getByRole('cell', { name: 'Überweisung erhalten' })).toBeVisible();
    await expect(other.getByRole('cell', { name: anna.name })).toBeVisible();
    await otherContext.close();
  });

  test('Eule verschenken mit Begleitbrief', async ({ browser, page }) => {
    const { anna, other, otherContext } = await pair(browser, page);
    await buyAndName(page, 'Waldohreule', 'Ohrchen');
    // v1.1: Ben has closed the app; the landing waits for his next visit.
    await other.goto('about:blank');
    await page.getByRole('button', { name: 'Verschenken' }).click();
    await page.getByLabel('An').selectOption({ index: 1 });
    await page.getByLabel('Begleitbrief mitgeben (kurzes Pergament, kostenlos)').check();
    await page.getByLabel('Begleitbrief', { exact: true }).fill('Pass gut auf Ohrchen auf!');
    await page.getByRole('button', { name: 'Verschenken' }).last().click();
    await expect(page.getByTestId('owl-overlay')).toHaveAttribute('data-kind', 'departure');
    await expect(page.getByTestId('owl-card')).toHaveCount(0, { timeout: 10_000 });

    // v1.1: the landing appears as soon as Ben opens the app, not only in the chat.
    await expect(page.getByTestId('owl-card')).toHaveCount(0);
    await other.goto('/app');
    await expect(other.getByTestId('owl-overlay')).toHaveAttribute('data-kind', 'arrival', {
      timeout: 60_000,
    });
    await other.goto('/app/briefe');
    await other.getByRole('link', { name: new RegExp(anna.name) }).click({ timeout: 30_000 });
    await expect(other.getByText('Begleitbrief zur Eule Ohrchen')).toBeVisible({ timeout: 30_000 });
    await expect(other.getByText('Pass gut auf Ohrchen auf!')).toBeVisible();
    await other.goto('/app/eulen');
    await expect(other.getByRole('heading', { name: 'Ohrchen', exact: true })).toBeVisible();
    await otherContext.close();
  });

  test('Brief mit eigener Eule: Karte zeigt sie mit Tag und Nacht', async ({ browser, page }) => {
    // Ben lives about 250 km further east: the owl needs a few seconds (time lapse, D-66).
    const { other, otherContext } = await pair(browser, page, { benKeys: ['+', 'ArrowRight'] });
    await buyAndName(page, 'Waldkauz', 'Kartenkauz');
    await page.goto('/app/adressbuch');
    await page.getByTestId('person-contact').getByRole('link', { name: 'Brief schreiben' }).click();
    await page.getByLabel('Text').fill('Ein Brief mit echter Eule');
    // v0.8.5: the owl choice appears by itself.
    await page.getByRole('radio', { name: /Kartenkauz/ }).check();
    await expect(page.getByText(/Wieder zu Hause: ca\./).first()).toBeVisible();
    await page.getByRole('button', { name: 'Absenden' }).click();
    await expect(page.getByTestId('owl-overlay')).toContainText('Kartenkauz fliegt los');
    await page.goto('/app/karte');
    await expect(page.getByTestId('map-owl')).toBeVisible();
    await expect(
      page
        .getByTestId('night-layer')
        .or(page.getByText(/Kartenkauz: Brief/))
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Kartenkauz: Brief – .*nächster Halt|Kartenkauz: Brief – .*zurück/),
    ).toBeVisible();
    await page.goto('/app/eulen');
    await expect(
      page.getByText(/Fliegt gerade einen Brief zu|Fliegt nach Hause|Schläft auf dem|Rastet bei/),
    ).toBeVisible();
    await other.goto('/app/briefe');
    await expect(other.getByRole('link', { name: /Eule/ }).first()).toBeVisible({
      timeout: 60_000,
    });
    await otherContext.close();
  });
});
