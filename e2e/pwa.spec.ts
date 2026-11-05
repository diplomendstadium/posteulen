import { expect, settle, test } from './fixtures.ts';

test.describe('PWA (SPEC 15)', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Service-Worker-Details nur in Chromium geprüft',
  );

  test('registriert den Service Worker und startet offline aus dem Cache', async ({
    page,
    context,
    guard,
  }) => {
    await page.goto('/');
    await settle(page);
    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.active?.state;
    });
    expect(state).toBe('activated');
    const caches = await page.evaluate(async () => {
      const keys = await window.caches.keys();
      const name = keys.find((key) => key.startsWith('posteulen-shell'));
      if (name === undefined) return [];
      const shell = await window.caches.open(name);
      return (await shell.keys()).map((request) => new URL(request.url).pathname);
    });
    expect(caches).toContain('/');
    expect(caches.some((path) => path.startsWith('/assets/main-'))).toBe(true);
    expect(caches.some((path) => path.includes('owl-'))).toBe(false);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Willkommen bei PostEulen');
    await expect(page.getByRole('status')).toContainText('Keine Verbindung');
    await context.setOffline(false);
    // Images that were never displayed online are not cached (SPEC 9.2.6); their failed
    // loads while offline are expected.
    const expected = (text: string): boolean => text.includes('ERR_INTERNET_DISCONNECTED');
    const unexpected = guard.consoleErrors.filter((text) => !expected(text));
    guard.consoleErrors.splice(0, guard.consoleErrors.length, ...unexpected);
  });

  test('liefert ein gültiges Manifest', async ({ page }) => {
    const response = await page.request.get('/manifest.webmanifest');
    const manifest = (await response.json()) as Record<string, unknown>;
    expect(manifest['display']).toBe('standalone');
    expect(JSON.stringify(manifest['icons'])).toContain('maskable');
  });
});
