import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { borrowViaUi, PASSWORD, registerViaUi } from './account-helpers.ts';

/** Security review v0.6.1 (SPEC Anhang O). */

async function addContact(page: Page, name: string): Promise<void> {
  await page.goto('/app/adressbuch');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText(/^Anfrage gespeichert\./)).toBeVisible();
}

test.describe('Sicherheitsprüfung v0.6.1', () => {
  test('eine verkleidete Adresse erscheint als Punycode mit Warnhinweis (SPEC 6)', async ({
    page,
  }) => {
    await registerViaUi(page);
    await borrowViaUi(page);
    await page.goto('/app/briefe');
    await page.getByRole('link', { name: /Erklärbär/ }).click();
    // Cyrillic "\u0430" (U+0430) in the host, an ordinary link next to it.
    await page
      .getByLabel('Text')
      .fill('Schau mal: https://p\u0430ypal.com/login und https://example.org/eule');
    await page.getByRole('button', { name: 'Eule wählen' }).click();
    await page.getByRole('button', { name: 'Absenden' }).click();
    const disguised = page.getByRole('link', { name: 'https://xn--pypal-4ve.com/login' });
    await expect(disguised).toBeVisible({ timeout: 30_000 });
    await expect(disguised).toHaveAttribute('href', 'https://xn--pypal-4ve.com/login');
    await expect(page.getByText(/Ungewöhnliche Zeichen in der Adresse/)).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'https://example.org/eule' })).toBeVisible();
  });

  test('nach dem Abmelden vergisst der Tab den Kontakt-Tresor des vorigen Kontos (SPEC 5.5)', async ({
    browser,
    page,
  }) => {
    test.slow();
    const contexts = await Promise.all([
      browser.newContext({ locale: 'de-DE' }),
      browser.newContext({ locale: 'de-DE' }),
    ]);
    const [benPage, carlaPage] = await Promise.all(contexts.map((context) => context.newPage()));
    const anna = await registerViaUi(page);
    const ben = await registerViaUi(benPage!);
    const carla = await registerViaUi(carlaPage!);
    // Anna and Ben are both coupled with Carla.
    await addContact(page, carla.name);
    await addContact(carlaPage!, anna.name);
    await addContact(benPage!, carla.name);
    await addContact(carlaPage!, ben.name);

    // Anna confirms the safety number with Carla …
    await page.goto('/app/adressbuch');
    await page.getByRole('button', { name: 'Sicherheitsnummer anzeigen' }).click();
    await page.getByRole('button', { name: /außerhalb der App verglichen/ }).click();
    await expect(page.getByText('Sicherheitsnummer verglichen')).toBeVisible();

    // … and signs out; Ben signs in in the same tab, without reloading the page.
    // An app link (no page load): the settings live behind the push hint and the menu.
    await page.locator('a[href="/app/einstellungen"]').first().click();
    await expect(page).toHaveURL(/\/app\/einstellungen$/);
    await page.getByRole('button', { name: 'Abmelden' }).last().click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByLabel('Nutzername').fill(ben.name);
    await page.getByLabel('Passwort').fill(PASSWORD);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 30_000 });
    await page.getByRole('link', { name: 'Adressbuch' }).first().click();
    await expect(page.getByText(carla.name, { exact: true })).toBeVisible();
    // Before v0.6.1 Ben saw Anna's "compared" status here.
    await expect(page.getByText('Sicherheitsnummer nicht verglichen')).toBeVisible();
    await expect(page.getByText('Sicherheitsnummer verglichen')).toHaveCount(0);
    await Promise.all(contexts.map((context) => context.close()));
  });
});
