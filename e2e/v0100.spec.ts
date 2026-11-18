/**
 * v0.10.0: the post office with the loan owls (and their full controls), pictures of the places,
 * what owls carry (purchase, offers, owl choice), the grumpy owl at 80 % motivation and the new
 * order of the settings.
 */
import type { Browser, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';
import { setGold, setOwlEnergy } from './db-helpers.ts';

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
  return { anna, ben, otherContext };
}

async function buyAndName(page: Page, species: string, name: string): Promise<void> {
  await page.goto('/app/menagerie/innen');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: `${species} kaufen` }).click();
  await page.getByLabel('Name (2–20 Zeichen)').fill(name);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

test.describe('Version 0.10', () => {
  test('Postamt: Ortsbild, Leiheulen mit Werten und Preis, geliehene Eulen mit allen Knöpfen', async ({
    page,
  }) => {
    await registerViaUi(page);
    // The overview has the post office instead of the finance page.
    await page.goto('/app');
    await expect(page.getByRole('link', { name: /Postamt/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Finanzen/ })).toHaveCount(0);

    await page.goto('/app/postamt');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Postamt');
    const picture = page.getByTestId('place-image');
    await expect(picture.locator('img')).toHaveAttribute('alt', /Eulenpostamt bei (Tag|Nacht)/);
    // v1.2: the loan owls are inside.
    await page.getByRole('link', { name: 'Eulenpostamt betreten' }).click();
    await expect(picture.locator('img')).toHaveAttribute('alt', /^Im Eulenpostamt bei (Tag|Nacht)/);
    const offer = page.getByTestId('loan-offer').first();
    await expect(offer.getByTestId('loan-stats')).toContainText(/Energie .* · Trägt kurzes/);
    await expect(offer).toContainText(/Leihgebühr: 0,[12] Gold/);
    const name = ((await offer.locator('h3').textContent()) ?? '').trim();
    await offer.getByRole('button').click();
    await expect(page.getByText(/wartet jetzt hier und bei deinen Eulen/)).toBeVisible();
    const card = page.getByTestId('owl-card').filter({ hasText: name });
    await expect(card.getByRole('button', { name: 'Brief schreiben' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Streicheln' })).toBeVisible();
    await expect(card.getByTestId('owl-cargo')).toContainText('Trägt kurzes');

    // The Menagerie is for buying only now – with its own picture and the carrying capacity.
    // v1.2.1: outside the picture of the place, inside the picture of the inside.
    await page.goto('/app/menagerie');
    await expect(page.getByTestId('place-image').locator('img')).toHaveAttribute(
      'alt',
      /Menagerie .* bei (Tag|Nacht)/,
    );
    await page.getByRole('link', { name: 'Menagerie betreten' }).click();
    await expect(page).toHaveURL(/\/app\/menagerie\/innen$/);
    await expect(page.getByTestId('place-image').locator('img')).toHaveAttribute(
      'alt',
      /^In der .*Menagerie bei (Tag|Nacht):/,
    );
    await expect(page.getByTestId('loan-offer')).toHaveCount(0);
    const elf = page.locator('ul.for-sale > li').filter({ hasText: 'Elfenkauz' });
    await expect(elf).toContainText('Trägt kurzes Pergament');
    await expect(elf).not.toContainText('langes');
    const great = page.locator('ul.for-sale > li').filter({ hasText: 'Virginiauhu' });
    await expect(great).toContainText('Preis: 68,0 Gold');
    await expect(great).toContainText('Trägt kurzes und langes Pergament sowie Gold');
  });

  test('Eulenwahl sperrt Eulen ohne langes Pergament; grummelig bei 80 % Motivation', async ({
    browser,
    page,
  }) => {
    const { anna, ben, otherContext } = await pair(browser, page);
    setGold(anna.name, 600);
    await buyAndName(page, 'Elfenkauz', 'Elfi');
    await buyAndName(page, 'Waldkauz', 'Waldi');
    setOwlEnergy(anna.name, 1, 8);
    await page.reload();
    const elfCard = page.getByTestId('owl-card').filter({ hasText: 'Elfi' });
    await expect(elfCard.locator('.picture img')).toHaveAttribute('src', /grumpy/);
    await expect(elfCard.locator('.picture img')).toHaveAttribute('alt', /grummelig/);

    await page.goto('/app/adressbuch');
    await page
      .getByTestId('person-contact')
      .filter({ hasText: ben.name })
      .getByRole('link', { name: 'Brief schreiben' })
      .click();
    await page.getByLabel('Text').fill('Ein langer Brief.');
    const elf = page.getByRole('radio', { name: /Elfi/ });
    await expect(elf).toBeEnabled();
    await page.getByLabel(/Lang – bis 15 000 Zeichen/).check();
    await expect(elf).toBeDisabled();
    await expect(page.getByText('Trägt kein langes Pergament.').first()).toBeVisible();
    await expect(page.getByRole('radio', { name: /Waldi/ })).toBeEnabled();
    await otherContext.close();
  });

  test('Einstellungen: Abmelden ganz oben, darunter Gold und Buchungen', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/app/einstellungen');
    const headings = page.locator('main h2');
    await expect(headings.nth(0)).toHaveText('Abmelden');
    await expect(headings.nth(1)).toHaveText('Gold und Buchungen');
    await expect(page.getByTestId('finance')).toContainText('Dein Gold: 3,0 Gold');
    await expect(page.getByTestId('finance')).toContainText(/Jeden Tag um .* Uhr bekommst du/);
  });
});
