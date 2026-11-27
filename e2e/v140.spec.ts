import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';
import { addOwls } from './db-helpers.ts';

/**
 * Version 1.4.0: holiday mode with its banner and the owls on their way to Inchlonaig (SPEC
 * 8.10, 9.12, 12.1), the bored picture (9.2.9), only the buttons that work right now (8.5), the
 * door right below the picture of post office and Menagerie (8.6, 8.7) and the addresses of the
 * instance on the start page (8.1).
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

test.describe('Version 1.4.0', () => {
  test('Urlaubsmodus: Eulen fliegen nach Inchlonaig, Hinweis oben, vorzeitig beenden', async ({
    page,
  }) => {
    const me = await registerViaUi(page);
    addOwls(me.name, 'waldkauz', 2);
    await page.goto('/app/einstellungen');
    const section = page.getByTestId('vacation-settings');
    await expect(section.getByRole('heading', { name: 'Urlaubsmodus' })).toBeVisible();
    await expect(section).toContainText('In diesem Jahr noch möglich: 3.');
    await section.getByRole('button', { name: 'Urlaub beginnen' }).click();
    await expect(section).toContainText('Schöne Ferien!');
    const banner = page.getByTestId('vacation-banner');
    await expect(banner).toContainText(/^🏝\s*Urlaubsmodus bis /);

    await page.goto('/app/eulen');
    const card = page.getByTestId('owl-card').first();
    await expect(card).toContainText('Fliegt in den Urlaub zur Eulenpflegestation auf Inchlonaig');
    await expect(card.getByRole('button', { name: 'Brief schreiben' })).toHaveCount(0);
    await page.goto('/app/karte');
    await expect(page.locator('.flights')).toContainText('Urlaub – fliegt nach Inchlonaig');
    await expect(page.getByTestId('map-owl')).toHaveCount(2);

    await page.goto('/app/einstellungen');
    page.once('dialog', (dialog) => void dialog.accept());
    await section.getByRole('button', { name: 'Urlaub vorzeitig beenden' }).click();
    await expect(section).toContainText('Deine Eulen sind auf dem Heimweg.');
    await expect(banner).toHaveCount(0);
    await expect(section).toContainText('In diesem Jahr noch möglich: 2.');
  });

  test('Gelangweilte Eule, nur klickbare Knöpfe, Tür gleich unter dem Bild', async ({ page }) => {
    const me = await registerViaUi(page);
    addOwls(me.name, 'bartkauz', 2);
    run(
      `UPDATE owls SET bored_at = 1, watered_on = strftime('%Y-%m-%d', 'now')
        WHERE name = 'Helfer 1' AND owner_id = (SELECT id FROM users WHERE name_display = ?)`,
      me.name,
    );
    await page.goto('/app/eulen');
    const bored = page.getByTestId('owl-card').filter({ hasText: 'Helfer 1' });
    await expect(bored.getByRole('img')).toHaveAttribute('src', /bored/);
    await expect(bored.getByRole('img')).toHaveAttribute('alt', /langweilt sich$/);
    // Watered today: the button is left out (v1.4), the other one still has it.
    await expect(bored.getByRole('button', { name: 'Wasser geben' })).toHaveCount(0);
    await expect(bored.getByRole('button', { name: 'Streicheln' })).toBeVisible();
    const other = page.getByTestId('owl-card').filter({ hasText: 'Helfer 2' });
    await expect(other.getByRole('button', { name: 'Wasser geben' })).toBeVisible();
    await expect(
      other.getByRole('button', { name: 'An das Postamt verleihen (7 Tage)' }),
    ).toBeVisible();

    for (const [url, door] of [
      ['/app/postamt', 'Eulenpostamt betreten'],
      ['/app/menagerie', 'Menagerie betreten'],
      // v1.4.2: the rescue centre likewise.
      ['/app/rettungsstation', 'Eintreten'],
    ] as const) {
      await page.goto(url);
      const y = async (locator: ReturnType<typeof page.getByTestId>) =>
        (await locator.boundingBox())!.y;
      const picture = page.getByTestId('place-image');
      const button = page.getByRole('link', { name: door });
      const intro = page.locator('p.card.intro');
      expect(await y(picture)).toBeLessThan(await y(button));
      expect(await y(button)).toBeLessThan(await y(intro));
    }
  });

  test('Startseite: Adressen der Instanz unter der Statistik', async ({ page }) => {
    await page.goto('/');
    const links = page.getByTestId('instance-links');
    // The test instance runs the player's onion site; admin and bots have none here.
    await expect(links.getByRole('term')).toHaveText([
      'Startseite',
      'Startseite im Tor-Netz',
      'Adminpanel',
      'Bots-Kontrollzentrum',
    ]);
    await expect(links.getByRole('link').nth(1)).toHaveAttribute('href', /^http:\/\/.*\/$/);
    await expect(links.getByRole('link').first()).toHaveAttribute('href', /^http/);
  });
});
