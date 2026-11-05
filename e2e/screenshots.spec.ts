import { ADMIN_URL, test } from './fixtures.ts';
import { shoot } from './screenshot-helpers.ts';
import { registerViaUi } from './account-helpers.ts';

test.describe('Screenshots', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Screenshots für den Bericht nur aus Chromium');
  });

  test('öffentliche Seiten', async ({ page }, info) => {
    await page.goto('/');
    await shoot(page, info, 'start');
    await page.goto('/konto-erstellen');
    await shoot(page, info, 'registrierung', true);
    await page.goto(ADMIN_URL);
    await shoot(page, info, 'verwaltung-login');
  });

  test('angemeldet', async ({ page }, info) => {
    await registerViaUi(page);
    await shoot(page, info, 'willkommen');
    await page.goto('/app');
    await shoot(page, info, 'uebersicht', true);
    await page.goto('/app/einstellungen');
    await shoot(page, info, 'einstellungen');
  });
});

test.describe('Screenshots Briefwechsel', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Screenshots für den Bericht nur aus Chromium');
  });

  test('Adressbuch, Brief, Systemchat', async ({ browser, page }, info) => {
    const anna = await registerViaUi(page);
    const other = await (await browser.newContext({ locale: 'de-DE' })).newPage();
    const ben = await registerViaUi(other);
    for (const [p, name] of [
      [page, ben.name],
      [other, anna.name],
    ] as const) {
      await p.goto('/app/adressbuch');
      await p.getByLabel('Name', { exact: true }).fill(name);
      await p.getByRole('button', { name: 'Hinzufügen' }).click();
      await p.getByText(/^Anfrage gespeichert\./).waitFor();
    }
    await page.reload();
    await page.getByRole('button', { name: 'Sicherheitsnummer anzeigen' }).click();
    await page.getByTestId('safety-number').waitFor();
    await shoot(page, info, 'adressbuch', true);
    await page.getByRole('link', { name: 'Brief schreiben' }).click();
    await page
      .getByLabel('Text')
      .fill('Liebe Grüße aus dem Eulenturm! Mehr unter https://example.org');
    await page.getByRole('button', { name: 'Eule und Ankunft anzeigen' }).click();
    await page.getByText(/Ankunft bei/).waitFor();
    await shoot(page, info, 'brief-schreiben');
    await page.getByRole('button', { name: 'Absenden' }).click();
    await page.getByText('Die Eule ist losgeflogen.').waitFor();
    await other.goto('/app/briefe');
    await other.getByRole('link', { name: new RegExp(anna.name) }).click({ timeout: 30_000 });
    await other.getByText(/Liebe Grüße/).waitFor({ timeout: 30_000 });
    await shoot(other, info, 'chat-empfaenger');
    await page.locator('p.status', { hasText: 'gelesen' }).waitFor({ timeout: 30_000 });
    await shoot(page, info, 'chat-absender', true);
    await page.goto('/app/briefe');
    await shoot(page, info, 'briefwechsel');
    await page.goto('/app/briefe/system');
    await shoot(page, info, 'systemnachrichten');
  });
});
