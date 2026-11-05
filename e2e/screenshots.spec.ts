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
