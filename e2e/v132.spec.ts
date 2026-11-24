import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ADMIN_URL, BOTS_URL, expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';
import { addOwls, setGold } from './db-helpers.ts';

/**
 * Version 1.3.2: the top bar with the bare balance and the power button (SPEC 8.3), long
 * conversations with "Ältere Briefe im Keller suchen" (8.4), the cursor in the first login field
 * on devices without a touchscreen (8.1, 10.12, 13), "Über diese Instanz" on the start page
 * (8.1), the gap above "Gold und Buchungen" (8.10) and the Northern Hawk Owl's cranberries.
 */

function run(sql: string, ...params: (string | number | null)[]): void {
  const dir = process.env['POSTEULEN_E2E_DIR'];
  if (!dir) throw new Error('POSTEULEN_E2E_DIR is not set');
  const db = new DatabaseSync(path.join(dir, 'main', 'posteulen.sqlite'));
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    db.prepare(sql).run(...params);
  } finally {
    db.close();
  }
}

test.describe('Version 1.3.2', () => {
  test('Kopfzeile: Betrag ohne „Gold“, Abmelden über den Power-Knopf mit Rückfrage', async ({
    page,
  }) => {
    const me = await registerViaUi(page);
    setGold(me.name, 139);
    await page.goto('/app');
    const gold = page.getByTestId('topbar-gold');
    await expect(gold.locator('span').nth(1)).toHaveText('13,9');
    await expect(gold).not.toHaveText(/13,9 Gold/);
    const power = page.getByTestId('logout-button');
    await expect(power).toHaveAccessibleName('Abmelden');
    // The power button is the last thing in the top bar, right of the question mark.
    const help = (await page.getByTestId('help-link').boundingBox())!;
    const button = (await power.boundingBox())!;
    expect(button.x).toBeGreaterThan(help.x);
    // Cancelling keeps the user signed in.
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Möchtest du dich wirklich abmelden?');
      void dialog.dismiss();
    });
    await power.click();
    await expect(page).toHaveURL(/\/app$/);
    page.once('dialog', (dialog) => void dialog.accept());
    await power.click();
    await expect(page.locator('#login-name')).toBeVisible();
  });

  test('Lange Verläufe: erst die letzten 25, ältere aus dem Keller', async ({ page }) => {
    const me = await registerViaUi(page);
    const start = Date.now() - 100 * 60_000;
    for (let i = 0; i < 40; i++) {
      run(
        `INSERT INTO system_messages (id, user_id, type, params, created_at, seen)
         SELECT ?, id, 'broadcast', ?, ?, 1 FROM users WHERE name_display = ?`,
        crypto.randomUUID().replace(/-/g, '').slice(0, 22),
        JSON.stringify({ text: `Rundbrief ${i + 1}` }),
        start + i * 60_000,
        me.name,
      );
    }
    await page.goto('/app/briefe/system');
    const items = page.locator('.messages > li');
    await expect(items).toHaveCount(25);
    const older = page.getByTestId('older-letters');
    await expect(older).toHaveText('Ältere Briefe im Keller suchen');
    await older.click();
    await expect(older).toHaveCount(0);
    expect(await items.count()).toBeGreaterThanOrEqual(40);
    await expect(items.filter({ hasText: 'Rundbrief 1' }).first()).toBeAttached();
  });

  test('Startseite: Cursor im Nutzernamen, Box „Über diese Instanz“', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    const box = page.getByTestId('instance');
    await expect(box.getByRole('heading', { name: 'Über diese Instanz' })).toBeVisible();
    for (const label of [
      'Konten insgesamt erstellt',
      'Konten vorhanden',
      'In den letzten 30 Tagen aktiv',
      'Briefe zwischen Menschen',
      'Eulen im Besitz der Spieler',
    ]) {
      await expect(box.getByText(label, { exact: true })).toBeVisible();
    }
    // Below "Über PostEulen".
    const about = (await page.getByTestId('about').boundingBox())!;
    expect((await box.boundingBox())!.y).toBeGreaterThan(about.y);
    if (testInfo.project.name === 'chromium-desktop') {
      await expect(page.locator('#login-name')).toBeFocused();
    } else {
      // Phones and tablets: no keyboard popping up.
      await expect(page.locator('#login-name')).not.toBeFocused();
    }
  });

  test('Adminpanel und Kontrollzentrum: Cursor im Passwortfeld', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'only without a touchscreen');
    await page.goto(ADMIN_URL);
    await expect(page.locator('#admin-password')).toBeFocused();
    await page.goto(BOTS_URL);
    await expect(page.locator('#centre-password')).toBeFocused();
  });

  test('Einstellungen: Abstand über „Gold und Buchungen“; Moosbeeren für die Sperbereule', async ({
    page,
  }) => {
    const me = await registerViaUi(page);
    setGold(me.name, 500);
    addOwls(me.name, 'sperbereule', 1);
    await page.goto('/app/einstellungen');
    const stats = (await page.getByTestId('stats').boundingBox())!;
    await expect(page.getByTestId('finance')).toBeVisible();
    const finance = (await page.getByTestId('finance').boundingBox())!;
    expect(finance.y - (stats.y + stats.height)).toBeGreaterThanOrEqual(20);
    await page.goto('/app/eulen');
    const card = page.getByTestId('owl-card').first();
    await expect(card.getByRole('button', { name: /^Moosbeeren geben/ })).toBeVisible();
  });
});
