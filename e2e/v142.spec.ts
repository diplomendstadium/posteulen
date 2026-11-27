import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';
import { addOwls } from './db-helpers.ts';

/**
 * Version 1.4.2: the second look of owls of the same species (SPEC 9.2.6) with short picture
 * descriptions (14), the door of the rescue centre right below its picture (8.13, tested with the
 * other places in v140) and the kind of instance for the pages (16.6).
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

test.describe('Version 1.4.2', () => {
  test('Zweitbild: die zweite Eule einer Art sieht anders aus', async ({ page }) => {
    // No nap (the overview rolls it with Math.random): the standard pictures are shown.
    await page.addInitScript(() => {
      Math.random = () => 0.9;
    });
    const me = await registerViaUi(page);
    addOwls(me.name, 'bartkauz', 2);
    run(
      `UPDATE owls SET look = 1
        WHERE name = 'Helfer 2' AND owner_id = (SELECT id FROM users WHERE name_display = ?)`,
      me.name,
    );
    await page.goto('/app/eulen');
    const first = page.getByTestId('owl-card').filter({ hasText: 'Helfer 1' });
    const second = page.getByTestId('owl-card').filter({ hasText: 'Helfer 2' });
    await expect(first.locator('.picture img')).toHaveAttribute(
      'src',
      /Bartkauz-(normal|night|xmasDay|xmasNight)-/,
    );
    await expect(second.locator('.picture img')).toHaveAttribute('src', /Bartkauz-second(Night)?-/);
    await expect(second.locator('.picture img')).toHaveAttribute('alt', 'Helfer 2, Bartkauz');
  });

  test('Die Seiten kennen die Art der Instanz', async ({ page }) => {
    await page.goto('/');
    expect(await (await page.request.get('/api/edition')).json()).toEqual({ torOnly: false });
    await expect(page.locator('html')).not.toHaveClass(/tor-only/);
  });
});
