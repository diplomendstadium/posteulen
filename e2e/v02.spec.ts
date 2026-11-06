import type { Browser, Page } from '@playwright/test';
import { VERSION } from '@posteulen/shared/version.ts';
import { expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';
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

test.describe('Version 0.2', () => {
  test('ohne eigene Eule: Leiheule direkt in der Eulenwahl, geliehen erst beim Abschicken', async ({
    browser,
    page,
  }) => {
    const { anna, ben, other, otherContext } = await pair(browser, page);
    setGold(anna.name, 50);
    await page.goto('/app/adressbuch');
    await page.getByTestId('person-contact').getByRole('link', { name: 'Brief schreiben' }).click();
    await page.getByLabel('Text').fill('Mit einer Leiheule, ohne Umweg über die Menagerie.');
    await page.getByRole('button', { name: 'Eule wählen' }).click();
    await expect(page.getByText(/Du kannst eine Leiheule des Tages nehmen/)).toBeVisible();
    const offers = page
      .getByRole('group', { name: 'Welche Eule soll fliegen?' })
      .getByRole('radio');
    await expect(offers).toHaveCount(3);
    // Nothing is preselected – borrowing costs gold.
    for (const offer of await offers.all()) await expect(offer).not.toBeChecked();
    await expect(page.getByText('Leiheule des Tages: 0,1 Gold, erst beim Abschicken.')).toHaveCount(
      3,
    );
    await offers.first().check();
    await page.getByRole('button', { name: 'Absenden' }).click();
    await expect(page.getByText('Die Eule ist losgeflogen.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/4,9 Gold/).first()).toBeVisible();
    // (In the test time-lapse the loan owl may already have delivered and vanished.)

    // The letter arrives as a scroll in handwriting; Ben's top bar says "Neue Post!".
    await other.goto('/app');
    await expect(other.getByRole('link', { name: /Neue Post!/ })).toBeVisible({ timeout: 30_000 });
    await other.getByRole('link', { name: /Neue Post!/ }).click();
    await other.getByRole('link', { name: new RegExp(anna.name) }).click();
    const scroll = other.locator('li.scroll').filter({ hasText: 'Leiheule' });
    await expect(scroll).toBeVisible({ timeout: 30_000 });
    expect(
      await scroll.locator('p.text').evaluate((el) => getComputedStyle(el).fontFamily),
    ).toMatch(/Caveat/);
    await expect(other.getByText(/ein Jahr nach der Zustellung automatisch/)).toBeVisible();
    expect(ben.name).not.toBe(anna.name);
    await otherContext.close();
  });

  test('Einstellungen: Löschfrist und Druckschrift; Versionsnummer', async ({ page }) => {
    await page.goto('/');
    const version = page.getByRole('link', {
      name: new RegExp(`v${VERSION.replace(/\./g, '\\.')}`),
    });
    await expect(version).toHaveAttribute('href', 'https://github.com/diplomendstadium/posteulen');
    await expect(version).toHaveAttribute('target', '_blank');
    await registerViaUi(page);
    await page.goto('/app');
    await expect(page.locator('header .version')).toHaveText(`v${VERSION}`);
    await expect(page.locator('header').getByRole('link', { name: `v${VERSION}` })).toHaveCount(0);

    await page.goto('/app/einstellungen');
    await expect(page.getByRole('radio', { name: 'einem Jahr (Standard)' })).toBeChecked();
    await page.getByRole('radio', { name: '90 Tagen' }).check();
    await page.getByLabel('Briefe in Druckschrift statt Handschrift anzeigen').check();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Gespeichert.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('radio', { name: '90 Tagen' })).toBeChecked();
    await expect(
      page.getByLabel('Briefe in Druckschrift statt Handschrift anzeigen'),
    ).toBeChecked();
  });

  test('Karte: Städte, getrennte Landesteile Großbritanniens', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/app/karte');
    const cities = page.getByTestId('map-cities');
    await expect(cities.locator('text').first()).toBeVisible();
    await expect(page.locator('svg text', { hasText: 'Vereinigtes Königreich' })).toHaveCount(0);
  });
});
