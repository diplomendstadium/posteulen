import { ADMIN_URL, test } from './fixtures.ts';
import { shoot } from './screenshot-helpers.ts';
import { registerViaUi } from './account-helpers.ts';
import { setGold } from './db-helpers.ts';

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
    await page.getByRole('button', { name: 'Eule wählen' }).click();
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

test.describe('Screenshots Eulen, Finanzen, Karte (Stufe 3)', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Screenshots für den Bericht nur aus Chromium');
  });

  test('Menagerie, Eulen, Einblendung, Finanzen, Karte', async ({ browser, page }, info) => {
    const anna = await registerViaUi(page);
    const other = await (await browser.newContext({ locale: 'de-DE' })).newPage();
    const ben = await registerViaUi(other, { mapKeys: ['+', 'ArrowRight'] });
    for (const [p, name] of [
      [page, ben.name],
      [other, anna.name],
    ] as const) {
      await p.goto('/app/adressbuch');
      await p.getByLabel('Name', { exact: true }).fill(name);
      await p.getByRole('button', { name: 'Hinzufügen' }).click();
      await p.getByText(/^Anfrage gespeichert\./).waitFor();
    }
    setGold(anna.name, 600);
    await page.goto('/app/menagerie');
    await shoot(page, info, 'menagerie', true);
    await page.getByRole('button', { name: 'Schneeeule kaufen' }).click();
    await page.getByLabel('Name (2–20 Zeichen)').waitFor();
    await shoot(page, info, 'eule-benennen');
    await page.getByLabel('Name (2–20 Zeichen)').fill('Hedwig');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.goto('/app/menagerie');
    await page.getByRole('button', { name: 'Waldkauz kaufen' }).click();
    await page.getByLabel('Name (2–20 Zeichen)').fill('Waldi');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.getByRole('heading', { name: 'Waldi', exact: true }).waitFor();
    await page.getByTestId('owl-card').first().getByRole('button', { name: 'Streicheln' }).click();
    await page.getByTestId('owl-overlay').waitFor();
    await shoot(page, info, 'eulen-streicheln', true);
    await page.keyboard.press('Escape');

    await page.goto('/app/adressbuch');
    await page.getByRole('link', { name: 'Brief schreiben' }).click();
    await page.getByLabel('Text').fill('Hedwig bringt dir diesen Brief.');
    await page.getByRole('button', { name: 'Eule wählen' }).click();
    await page.getByRole('radio', { name: /Hedwig/ }).check();
    await shoot(page, info, 'eule-waehlen');
    await page.getByRole('button', { name: 'Absenden' }).click();
    await page.getByTestId('owl-overlay').waitFor();
    await shoot(page, info, 'abflug');
    await page.goto('/app/karte');
    await page.getByTestId('map-owl').waitFor();
    await shoot(page, info, 'karte', true);
    await page.goto('/app/eulen');
    await page.getByText(/Fliegt gerade einen Brief zu|Fliegt nach Hause/).waitFor();
    await shoot(page, info, 'eulen-unterwegs');

    await page.goto('/app/finanzen');
    await page.getByLabel('An').selectOption({ index: 1 });
    await page.getByLabel('Betrag in Gold (z. B. 1,5)').fill('2,5');
    await page.getByRole('button', { name: 'Eule wählen' }).click();
    await page.getByRole('radio', { name: /Waldi/ }).check();
    await page.getByRole('button', { name: 'Gold losschicken' }).click();
    await page.getByText(/Waldi bringt 2,5 Gold/).waitFor();
    await page.keyboard.press('Escape');
    await shoot(page, info, 'finanzen', true);
  });
});
