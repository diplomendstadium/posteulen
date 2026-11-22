import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { registerViaUi, uniqueName } from './account-helpers.ts';
import { addOwls, setGold } from './db-helpers.ts';

/**
 * Version 1.3.1: the pouch with owl biscuits and treats (SPEC 9.1.6), the special status
 * (9.1.7), the buttons under an owl as a neat rectangle (8.5), the help page without its own
 * help link (8.11) and passwords that are too easy to guess (7.2).
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

/** Every row of buttons fills the width of its box (left and right edges line up). */
async function expectRectangle(box: Locator): Promise<void> {
  const outer = (await box.boundingBox())!;
  const buttons = await box.locator(':scope > .button').all();
  expect(buttons.length).toBeGreaterThan(0);
  const rows = new Map<number, { left: number; right: number }>();
  for (const button of buttons) {
    const rect = (await button.boundingBox())!;
    const key = Math.round(rect.y);
    const row = rows.get(key) ?? { left: Infinity, right: -Infinity };
    rows.set(key, {
      left: Math.min(row.left, rect.x),
      right: Math.max(row.right, rect.x + rect.width),
    });
  }
  for (const row of rows.values()) {
    expect(Math.abs(row.left - outer.x)).toBeLessThan(2);
    expect(Math.abs(row.right - (outer.x + outer.width))).toBeLessThan(2);
  }
}

test.describe('Version 1.3.1', () => {
  test('Beutel mit Eulenkeksen und Leckerlis, Knöpfe als Rechteck', async ({ page }) => {
    const me = await registerViaUi(page);
    setGold(me.name, 500);
    addOwls(me.name, 'waldkauz', 1);
    run('UPDATE users SET bag_biscuits = 3, bag_treats = 1 WHERE name_display = ?', me.name);
    await page.goto('/app/eulen');
    const bag = page.getByTestId('bag-notice');
    await expect(bag).toContainText(
      'In deinem Beutel befinden sich noch 3 Eulenkekse und 1 Leckerli.',
    );
    const card = page.getByTestId('owl-card').first();
    await expect(card.getByRole('button', { name: 'Eulenkeks (aus dem Beutel)' })).toBeVisible();
    await expectRectangle(card.locator('.owl-actions').last());
    await page.goto('/app/postamt');
    await expect(page.getByTestId('bag-notice')).toBeVisible();
    await page.goto('/app/rettungsstation/innen');
    await expect(page.getByTestId('bag-notice')).toBeVisible();
    const wild = page.getByTestId('rescue-wild');
    await expect(wild).toHaveCount(1);
    await expectRectangle(wild.locator('.owl-actions'));
    await wild.getByRole('button', { name: /^Füttern \(Eulenkeks, aus dem Beutel\)$/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('bag-notice')).toContainText(
      'In deinem Beutel befinden sich noch 2 Eulenkekse und 1 Leckerli.',
    );
    // Without anything in the pouch the box is gone.
    run('UPDATE users SET bag_biscuits = 0, bag_treats = 0 WHERE name_display = ?', me.name);
    await page.goto('/app/eulen');
    await expect(page.getByRole('heading', { name: 'Bereit für Post' })).toBeVisible();
    await expect(page.getByTestId('bag-notice')).toHaveCount(0);
  });

  test('Sonderstatus: unbegrenzt Gold', async ({ page }) => {
    const me = await registerViaUi(page);
    run(
      'INSERT INTO privileged_users (user_id, since_at, until_at) SELECT id, ?, NULL FROM users WHERE name_display = ?',
      Date.now(),
      me.name,
    );
    await page.goto('/app/einstellungen');
    await expect(page.locator('.gold')).toContainText('∞ Gold');
    await expect(page.getByTestId('privileged')).toContainText('Sonderstatus');
  });

  test('Hilfeseite ohne eigenen Hilfe-Link', async ({ page }) => {
    await page.goto('/datenschutz');
    await expect(page.getByTestId('help-link')).toHaveCount(1);
    await page.goto('/hilfe');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('help-link')).toHaveCount(0);
  });

  test('Passwort: nicht der Nutzername, keine bekannten Passwörter', async ({ page }) => {
    const name = uniqueName('Lotta');
    await page.goto('/konto-erstellen');
    await page.getByLabel('Nutzername').fill(name);
    const tryPassword = async (password: string) => {
      await page.getByLabel('Passwort', { exact: true }).fill(password);
      await page.getByLabel('Passwort wiederholen').fill(password);
      await page.getByRole('application', { name: 'Karte von Westeuropa' }).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Konto erstellen' }).click();
    };
    await tryPassword(`${name} hat ein Passwort`);
    await expect(page.getByRole('alert')).toContainText('Nutzernamen nicht enthalten');
    await tryPassword('123456789012345');
    await expect(page.getByRole('alert')).toContainText('öffentlichen Listen');
    await tryPassword('qwertzuiopasdfgh');
    await expect(page.getByRole('alert')).toContainText('zu leicht zu erraten');
    await expect(page).toHaveURL(/\/konto-erstellen$/);
  });
});
