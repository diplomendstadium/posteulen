import fs from 'node:fs';
import path from 'node:path';
import { expect, ISOLATED_ADMIN_URL, ISOLATED_WEB_URL, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';
import { shoot } from './screenshot-helpers.ts';

test.describe.configure({ mode: 'serial' });

test.describe('Adminpanel (Stufe 1, SPEC 13)', () => {
  // Own server instance, one run is enough (state changes would collide across browsers).
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== 'chromium' || testInfo.project.name !== 'chromium-desktop',
      'ein Durchlauf',
    );
  });

  test('Erstpasswort → Pflichtwechsel → Modus → Einladung → Registrierung mit Code', async ({
    page,
    context,
  }) => {
    const initial = fs
      .readFileSync(
        path.join(process.env['POSTEULEN_E2E_DIR'] ?? '', 'admin', 'admin-erstpasswort.txt'),
        'utf8',
      )
      .trim();

    await page.goto(`${ISOLATED_WEB_URL}/konto-erstellen`);
    await expect(page.getByText('Neue Konten können gerade nicht erstellt werden.')).toBeVisible();

    await page.goto(ISOLATED_ADMIN_URL);
    await page.getByLabel('Passwort').fill('falsches Passwort fuer den Test');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('alert')).toContainText('Das Passwort stimmt nicht.', {
      timeout: 30_000,
    });

    await page.getByLabel('Passwort').fill(initial);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('heading', { name: 'Erstpasswort ändern' })).toBeVisible({
      timeout: 30_000,
    });
    await shoot(page, test.info(), 'verwaltung-erstpasswort');
    const response = await page.request.get(`${ISOLATED_ADMIN_URL}/api/settings/registration`);
    expect(response.status()).toBe(403);

    const adminPassword = 'ein eigenes langes Adminpasswort';
    await page.getByLabel('Neues Passwort', { exact: true }).fill(adminPassword);
    await page.getByLabel('Neues Passwort wiederholen').fill(adminPassword);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('heading', { name: 'Registrierung' })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('combobox', { name: 'Registrierung' }).selectOption('invite');
    await expect(page.getByText('Gespeichert.')).toBeVisible();
    await page.getByRole('button', { name: 'Neuen Code erzeugen' }).click();
    const text = await page.getByText(/^Neuer Code:/).textContent();
    const code = /([A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4})/.exec(text ?? '')?.[1];
    expect(code).toBeDefined();

    const user = await context.newPage();
    await registerViaUi(user, { base: ISOLATED_WEB_URL, inviteCode: code ?? '' });

    await page.reload();
    await expect(page.getByText('Keine offenen Codes.')).toBeVisible();
    await shoot(page, test.info(), 'verwaltung-uebersicht', true);

    // Statistics, deletion period and a broadcast (Stufe 4, SPEC 13 items 1, 4, 6).
    await expect(page.getByTestId('admin-stats')).toContainText('Konten insgesamt erstellt: 1');
    // Less than 60 days is not accepted (the server checks it as well).
    await page.getByLabel('Tage', { exact: true }).fill('59');
    expect(
      await page
        .getByLabel('Tage', { exact: true })
        .evaluate((input) => (input as HTMLInputElement).checkValidity()),
    ).toBe(false);
    await page.getByLabel('Tage', { exact: true }).fill('90');
    await page.getByRole('button', { name: 'Speichern' }).first().click();
    await expect(page.getByText('Gespeichert.').first()).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByLabel('Text').fill('Heute Abend fliegen die Eulen später.');
    await page.getByRole('button', { name: 'An alle senden' }).click();
    await expect(page.getByText('Gesendet an 1 Konten.')).toBeVisible();
    // OpenAI: the key is write-only; without network the connection test reports the failure.
    await page.getByLabel('Neuer API-Key').fill('sk-test-0123456789abcdefghij');
    await page.getByRole('button', { name: 'Key speichern' }).click();
    await expect(page.getByText(/Key hinterlegt seit/)).toBeVisible();
    await expect(page.getByLabel('Neuer API-Key')).toHaveValue('');
    await user.goto(`${ISOLATED_WEB_URL}/app/briefe/system`);
    await expect(user.getByText('Heute Abend fliegen die Eulen später.')).toBeVisible();
    // v0.7: a voucher for gold, redeemed once in the settings of the app.
    await page.getByLabel('Betrag in Gold (0,1 bis 100)').fill('2,5');
    await page.getByRole('button', { name: 'Gutschein erzeugen' }).click();
    const voucherText = await page.getByText(/^Neuer Gutschein:/).textContent();
    const voucher = /([A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4})/.exec(voucherText ?? '')?.[1] ?? '';
    expect(voucher).not.toBe('');
    await user.goto(`${ISOLATED_WEB_URL}/app/einstellungen`);
    await user.getByLabel('Gutscheincode').fill(voucher);
    await user.getByRole('button', { name: 'Einlösen' }).click();
    await expect(
      user.getByText('Eingelöst: 2,5 Gold sind deinem Konto gutgeschrieben.'),
    ).toBeVisible();
    await user.getByLabel('Gutscheincode').fill(voucher);
    await user.getByRole('button', { name: 'Einlösen' }).click();
    await expect(
      user.getByText('Dieser Gutschein ist ungültig, abgelaufen oder schon eingelöst.'),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Gutschein …\w{4}: 2,5 Gold – eingelöst/)).toBeVisible();
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page.getByRole('heading', { name: 'Anmeldung für die Verwaltung' })).toBeVisible();
  });
});
