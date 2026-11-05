import { ADMIN_URL, expect, settle, test } from './fixtures.ts';

const PAGES = ['/', '/app', '/app/briefe', '/hilfe', '/datenschutz', '/impressum'];

test.describe('App-Hülle (Stufe 0)', () => {
  for (const path of PAGES) {
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

  test('navigiert ohne Neuladen und mit Zurück-Taste', async ({ page }) => {
    await page.goto('/app');
    await page.getByRole('link', { name: 'Eulen', exact: true }).first().click();
    await expect(page).toHaveURL(/\/app\/eulen$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Eulen');
    await page.goBack();
    await expect(page).toHaveURL(/\/app$/);
  });

  test('zeigt den Offline-Hinweis (SPEC 15)', async ({ page, context }) => {
    await page.goto('/app');
    await settle(page);
    await context.setOffline(true);
    await expect(page.getByRole('status')).toContainText('Keine Verbindung – Eulen brauchen Netz.');
    await context.setOffline(false);
    await expect(page.getByText('Keine Verbindung')).toHaveCount(0);
  });

  test('Bedienelemente sind mindestens 44 px groß (SPEC 14)', async ({ page }) => {
    for (const path of ['/', '/app']) {
      await page.goto(path);
      await settle(page);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('main a, main button, main input, nav a')]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({
            text: el.textContent?.trim() ?? el.id,
            rect: el.getBoundingClientRect(),
          }))
          .filter(({ rect }) => rect.height < 44 || rect.width < 44)
          .map(({ text, rect }) => `${text}: ${Math.round(rect.width)}×${Math.round(rect.height)}`),
      );
      expect(small, path).toEqual([]);
    }
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
