/**
 * Version 0.8.5 in the browser: "Brief schreiben" on an owl card, the owl choice that appears by
 * itself and stays while typing, the rest preselected by the kind of owl, the little owl in the
 * chat list of the host, and the start page link "Quelltext".
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { borrowViaUi, registerViaUi } from './account-helpers.ts';

async function addContact(page: Page, name: string): Promise<void> {
  await page.goto('/app/adressbuch');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText(/^Anfrage gespeichert\./)).toBeVisible();
}

test.describe('Version 0.8.5', () => {
  test('Brief schreiben von der Eulenkarte, Eulenwahl bleibt beim Tippen, Eule in der Chatliste', async ({
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

    const owl = await borrowViaUi(page);
    await page.goto('/app/eulen');
    const card = page.getByTestId('owl-card').filter({ hasText: owl });
    await card.getByRole('button', { name: 'Brief schreiben' }).click();
    const dialog = page.getByRole('dialog', { name: `Brief mit ${owl} schicken` });
    await dialog.getByRole('checkbox', { name: ben.name }).check();
    await dialog.getByRole('button', { name: 'Weiter zum Brief' }).click();
    await expect(page).toHaveURL(/\/app\/briefe\//);

    // The choice is there before a word is written – with this owl chosen.
    const chosen = page.getByRole('radio', { name: new RegExp(owl) });
    await expect(chosen).toBeChecked();
    // A loan owl rests 24 hours unless the writer picks another rest.
    await expect(page.getByLabel('Rast bei jedem Empfänger')).toHaveValue('24');
    await expect(page.getByText(/Vorgewählt für Leiheulen: 24 Std\./)).toBeVisible();
    await page.getByLabel('Text').fill('Ein Brief, und die Eule bleibt gewählt.');
    await expect(chosen).toBeChecked();
    await page.getByRole('button', { name: 'Absenden' }).click();
    await expect(page.getByText('Die Eule ist losgeflogen.')).toBeVisible({ timeout: 30_000 });

    // Ben: the owl rests with him – a little owl behind Anna's name, no system message.
    await other.goto('/app/briefe');
    await expect(other.locator('.chats .resting')).toBeVisible({ timeout: 60_000 });
    await other.goto('/app/briefe/system');
    await expect(other.getByText(/ist zu Besuch und rastet bei dir/)).toHaveCount(0);
    await otherContext.close();
  });

  test('Startseite: „Quelltext“ statt der Versionsnummer', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: /^Quelltext/ });
    await expect(link).toHaveAttribute('href', /github\.com/);
    await expect(link).toHaveAttribute('target', '_blank');
  });
});
