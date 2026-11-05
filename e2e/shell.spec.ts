import { ADMIN_URL, expect, settle, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';

const PUBLIC_PAGES = ['/', '/konto-erstellen', '/hilfe', '/datenschutz', '/impressum'];

test.describe('App-Hülle', () => {
  for (const path of PUBLIC_PAGES) {
    test(`lädt ${path} nur vom eigenen Host und ohne CSP-Verstöße`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await settle(page);
      await expect(page.locator('h1')).toHaveCount(1);
    });
  }

  test('sendet CSP und Sicherheits-Header (SPEC 6, 17.4)', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() ?? {};
    expect(headers['content-security-policy']).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(headers['content-security-policy']).toContain("require-trusted-types-for 'script'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
  });

  test('angemeldete Bereiche: Navigation, Offline-Hinweis, Touch-Ziele (SPEC 8.3, 14, 15)', async ({
    page,
    context,
  }) => {
    await registerViaUi(page);
    for (const path of ['/app', '/app/briefe', '/app/einstellungen']) {
      await page.goto(path);
      await settle(page);
      await expect(page.locator('h1')).toHaveCount(1);
    }

    await page.goto('/app');
    await page.getByRole('link', { name: 'Eulen', exact: true }).first().click();
    await expect(page).toHaveURL(/\/app\/eulen$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Eulen');
    await page.goBack();
    await expect(page).toHaveURL(/\/app$/);

    for (const path of ['/', '/app', '/app/einstellungen']) {
      await page.goto(path);
      await settle(page);
      const small = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            'main a, main button, main input, main select, nav a',
          ),
        ]
          .filter((el) => el.offsetParent !== null && el.getAttribute('type') !== 'checkbox')
          .map((el) => ({
            text: el.textContent?.trim() || el.id,
            rect: el.getBoundingClientRect(),
          }))
          .filter(({ rect }) => rect.height < 44 || rect.width < 44)
          .map(({ text, rect }) => `${text}: ${Math.round(rect.width)}×${Math.round(rect.height)}`),
      );
      expect(small, path).toEqual([]);
    }

    await page.goto('/app');
    await settle(page);
    await context.setOffline(true);
    await expect(page.getByRole('status').first()).toContainText(
      'Keine Verbindung – Eulen brauchen Netz.',
    );
    await context.setOffline(false);
    await expect(page.getByText('Keine Verbindung')).toHaveCount(0);
  });

  test('Verwaltung läuft auf eigenem Origin', async ({ page }) => {
    const response = await page.goto(ADMIN_URL);
    expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Anmeldung für die Verwaltung',
    );
    const health = await page.request.get(`${ADMIN_URL}/api/health`);
    expect(await health.json()).toMatchObject({ api: 'admin' });
  });
});
