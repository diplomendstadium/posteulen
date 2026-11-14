/**
 * v0.9.0: the same app over the onion service (SPEC 16.5). The local preview stands in for the
 * onion site on 127.0.0.1 (own host, own cookie) with the API behind the Tor listener: one
 * account works on both addresses in turn, and one active session counts for the whole instance.
 */
import { expect, test, TOR_WEB_URL } from './fixtures.ts';
import { loginViaUi, registerViaUi } from './account-helpers.ts';

test.describe('Tor-Netz (v0.9)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName !== 'chromium' || testInfo.project.name !== 'chromium-desktop',
      'ein Durchlauf',
    );
  });

  test('Footer-Link und Anmeldung im Wechsel über Clearnet und Onion-Seite', async ({
    page,
    browser,
  }) => {
    await page.goto('/');
    const link = page.getByTestId('tor-link');
    await expect(link).toHaveAttribute('href', `${TOR_WEB_URL}/`);
    await expect(link).toHaveAccessibleName(/Tor-Netz/);

    const { name, password } = await registerViaUi(page);
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The onion site: same account, its own login (its own cookie on its own host).
    const onion = await browser.newPage();
    await loginViaUi(onion, name, password, TOR_WEB_URL);
    await expect(onion).toHaveURL(/\/app/, { timeout: 30_000 });
    await expect(onion.getByRole('heading', { level: 1 })).toBeVisible();
    // No link to itself on the onion site (seen by a visitor who is not signed in there).
    const guest = await browser.newPage();
    await guest.goto(`${TOR_WEB_URL}/`);
    await expect(guest.getByRole('link', { name: /Quelltext/ })).toBeVisible();
    await expect(guest.getByTestId('tor-link')).toHaveCount(0);
    await guest.close();

    // One active session per account: the clearnet session has ended.
    await page.goto('/app/einstellungen');
    await expect(page).toHaveURL(/localhost:18080\/$/, { timeout: 30_000 });
    await onion.close();
  });
});
