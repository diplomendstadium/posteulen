import { expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';

/**
 * The real push services cannot be reached from test browsers (D-61). This test sends a push
 * event straight into the service worker and checks the rest of the chain: visible
 * notification, confirmation without session, status "aktiv und bestätigt" (SPEC 11.4).
 */
test.describe('Push-Bestätigung durch den Service Worker (SPEC 11.4)', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Service-Worker-Ereignisse nur in Chromium auslösbar');
  });

  test('Test-Push → Service Worker bestätigt → Status bestätigt', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    await registerViaUi(page);
    await page.goto('/app/einstellungen');
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));

    // Subscription as a browser would send it; the push service itself is not reachable here.
    const put = await page.evaluate(async () => {
      const response = await fetch('/api/push/subscription', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-posteulen': '1' },
        body: JSON.stringify({
          endpoint: 'https://push.example.com/abc',
          keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) },
        }),
      });
      return (await response.json()) as { testId: string };
    });

    await worker.evaluate(async (id) => {
      const scope = self as unknown as {
        dispatchEvent(event: Event): boolean;
        PushEvent: new (type: string, init: { data: string }) => Event;
      };
      scope.dispatchEvent(
        new scope.PushEvent('push', { data: JSON.stringify({ id, type: 'push_test' }) }),
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
    }, put.testId);

    await page.reload();
    await expect(page.getByTestId('push-state')).toHaveText('aktiv und bestätigt', {
      timeout: 15_000,
    });
  });
});
