import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { PASSWORD, registerViaUi } from './account-helpers.ts';

async function addContact(page: Page, name: string): Promise<void> {
  await page.goto('/app/adressbuch');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText(/^Anfrage gespeichert\./)).toBeVisible();
}

test.describe('Kontakte und Briefe (Stufe 2, SPEC 5.7, 5.8, 8.4, 8.8, 17.4)', () => {
  test('Koppeln → Sicherheitsnummer → Brief → Zustellung → Lesebestätigung, ohne Klartext', async ({
    browser,
    page,
  }) => {
    const bodies: string[] = [];
    const record = (p: Page) =>
      p.on('request', (request) => {
        const body = request.postData();
        if (body) bodies.push(body);
      });
    record(page);
    const anna = await registerViaUi(page);
    const otherContext = await browser.newContext({ locale: 'de-DE' });
    const other = await otherContext.newPage();
    record(other);
    const ben = await registerViaUi(other);

    await addContact(page, ben.name);
    await expect(page.getByText(/unbestätigt/)).toBeVisible();
    await addContact(other, anna.name.toUpperCase());
    await expect(other.getByText(anna.name, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(ben.name, { exact: true })).toBeVisible();

    // Both sides see the same safety number (SPEC 5.7).
    await page.getByRole('button', { name: 'Sicherheitsnummer anzeigen' }).click();
    await other.getByRole('button', { name: 'Sicherheitsnummer anzeigen' }).click();
    const mine = await page.getByTestId('safety-number').textContent();
    expect(mine).toMatch(/^(\d{5} ){11}\d{5}$/);
    await expect(other.getByTestId('safety-number')).toHaveText(mine ?? '');
    await page.getByRole('button', { name: /außerhalb der App verglichen/ }).click();
    await expect(page.getByText('Sicherheitsnummer verglichen')).toBeVisible();

    const secret = 'Geheime Nachricht 🦉 an Ben: https://example.org/eule';
    await page.getByRole('link', { name: 'Brief schreiben' }).click();
    await page.getByLabel('Text').fill(secret);
    await expect(page.getByText('Pergament kennt keine Smileys.')).toBeVisible();
    await page.getByRole('button', { name: 'Eule wählen' }).click();
    await expect(page.getByText(/Ankunft bei/)).toBeVisible();
    await expect(page.getByRole('radio', { name: /Postkauz Paul/ })).toBeChecked();
    await page.getByRole('button', { name: 'Absenden' }).click();
    await expect(page.getByText('Die Eule ist losgeflogen.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Eule unterwegs|zugestellt/).first()).toBeVisible();

    await other.goto('/app/briefe');
    await expect(other.getByRole('link', { name: new RegExp(anna.name) })).toBeVisible({
      timeout: 30_000,
    });
    await other.getByRole('link', { name: new RegExp(anna.name) }).click();
    const shown = 'Geheime Nachricht  an Ben: https://example.org/eule';
    await expect(other.getByText(/Geheime Nachricht\s+an Ben/)).toBeVisible({ timeout: 30_000 });
    const link = other.getByRole('link', { name: 'https://example.org/eule' });
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    await expect(other.getByText(/Gebracht von Postkauz Paul/)).toBeVisible();

    await expect(page.locator('p.status', { hasText: 'gelesen' })).toBeVisible({ timeout: 30_000 });

    for (const body of bodies) {
      expect(body).not.toContain('Geheime Nachricht');
      expect(body).not.toContain(PASSWORD);
    }
    expect(shown).toContain('an Ben');
    await otherContext.close();
  });
});

test.describe('Schlüsselwarnung (SPEC 5.7)', () => {
  // page.route only sees requests that do not pass a service worker (WebKit).
  test.use({ serviceWorkers: 'block' });

  test('ein Server, der falsche Schlüssel liefert, löst die Schlüsselwarnung aus (SPEC 5.7)', async ({
    browser,
    page,
  }) => {
    const anna = await registerViaUi(page);
    const otherContext = await browser.newContext({ locale: 'de-DE' });
    const other = await otherContext.newPage();
    const ben = await registerViaUi(other);
    await addContact(page, ben.name);
    await addContact(other, anna.name);
    await page.goto('/app/adressbuch');
    await expect(page.getByRole('link', { name: 'Brief schreiben' })).toBeVisible();

    // Simulated attack: the server swaps Ben's key when preparing a letter.
    await page.route('**/api/letters/prepare', async (route) => {
      const response = await route.fetch();
      const json = (await response.json()) as { keys: { x25519: string }[] };
      json.keys[0]!.x25519 = 'A'.repeat(43);
      await route.fulfill({ response, json });
    });
    await page.getByRole('link', { name: 'Brief schreiben' }).click();
    await page.getByLabel('Text').fill('Das darf nicht ankommen');
    await page.getByRole('button', { name: 'Eule wählen' }).click();
    await page.getByRole('button', { name: 'Absenden' }).click();
    await expect(page.getByRole('alert').first()).toContainText('Schlüssel', { timeout: 30_000 });
    await page.unroute('**/api/letters/prepare');
    await page.goto('/app/adressbuch');
    await expect(page.locator('li.contact', { hasText: 'Schlüsselwarnung' })).toBeVisible();
    await page.goto('/app/briefe/system');
    await expect(page.getByText(/Schlüsselwarnung für/)).toBeVisible();
    await otherContext.close();
  });
});
