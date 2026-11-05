import { test as base, expect, type Page } from '@playwright/test';

export const ADMIN_URL = 'http://localhost:18081';
/** Second instance for admin tests (ARCHITECTURE: E2E). */
export const ISOLATED_WEB_URL = 'http://localhost:18090';
export const ISOLATED_ADMIN_URL = 'http://localhost:18091';
const ALLOWED_HOSTS = new Set([
  'localhost:18080',
  'localhost:18081',
  'localhost:18090',
  'localhost:18091',
]);

interface Guard {
  /** Requests to any other host (SPEC 2.2, 17.4). */
  readonly foreignRequests: string[];
  readonly consoleErrors: string[];
}

/**
 * Every test page records foreign requests, console errors and CSP violations; the fixture
 * fails the test if any occurred.
 */
export const test = base.extend<{ guard: Guard }>({
  guard: [
    async ({ page, browserName }, use) => {
      const guard: Guard = { foreignRequests: [], consoleErrors: [] };
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.protocol === 'data:' || url.protocol === 'blob:') return;
        if (!ALLOWED_HOSTS.has(url.host)) guard.foreignRequests.push(request.url());
      });
      // WebKit reports same-origin fetches that are aborted by a navigation (e.g. logout) as
      // "access control" failures, as console error or page error. Same-origin requests cannot
      // fail CORS, so this is noise (D-62).
      const abortedInWebkit = (text: string): boolean =>
        browserName === 'webkit' &&
        /localhost:180\d\d\/api\/\S* due to access control checks/.test(text);
      // Firefox reports a same-origin asset request that a navigation aborts while the service
      // worker answers it as "intercepted … unexpected error" (D-75). Only for /assets/.
      const abortedInFirefox = (text: string): boolean =>
        browserName === 'firefox' &&
        /localhost:180\d\d\/assets\/\S+’\. A ServiceWorker intercepted the request and encountered an unexpected error/.test(
          text,
        );
      page.on('console', (message) => {
        if (
          message.type() !== 'error' ||
          abortedInWebkit(message.text()) ||
          abortedInFirefox(message.text())
        )
          return;
        guard.consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => {
        if (!abortedInWebkit(error.message)) guard.consoleErrors.push(error.message);
      });
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
        });
      });
      await use(guard);
      expect(guard.foreignRequests, 'Anfragen an fremde Hosts').toEqual([]);
      expect(guard.consoleErrors, 'Konsolenfehler oder CSP-Verstöße').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
