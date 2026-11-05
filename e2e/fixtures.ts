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
    async ({ page }, use) => {
      const guard: Guard = { foreignRequests: [], consoleErrors: [] };
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.protocol === 'data:' || url.protocol === 'blob:') return;
        if (!ALLOWED_HOSTS.has(url.host)) guard.foreignRequests.push(request.url());
      });
      page.on('console', (message) => {
        if (message.type() === 'error') guard.consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => guard.consoleErrors.push(error.message));
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
