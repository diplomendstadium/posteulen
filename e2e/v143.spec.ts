/**
 * Version 1.4.3 in the browser: two-factor sign-in of a player (SPEC 5.11) – switching on with QR
 * code and key, the backup codes, a login with code and switching off with a backup code – and
 * the jump to the message when a letter cannot be sent (SPEC 8.4). „Server der Instanz“ is tested
 * with the admin panel (admin.spec), two wild owls with the rescue centre (stage4, v131).
 */
import { base32Decode, hotp, timeStep } from '../backend/src/auth/totp.ts';
import { expect, test } from './fixtures.ts';
import { borrowViaUi, PASSWORD, registerViaUi } from './account-helpers.ts';

test.describe('Version 1.4.3', () => {
  test('Zwei-Faktor-Anmeldung: einschalten, mit Code anmelden, mit Notfallcode ausschalten', async ({
    page,
    guard,
  }) => {
    test.setTimeout(120_000);
    const me = await registerViaUi(page);
    await page.goto('/app/einstellungen');
    const card = page.getByTestId('two-factor');
    const state = card.getByTestId('two-factor-state');
    await expect(state).toHaveText('Die Zwei-Faktor-Anmeldung ist ausgeschaltet.');
    await expect(card).toContainText('für immer verschlossen');
    await card.locator('#two-factor-password').fill(PASSWORD);
    await card.getByRole('button', { name: 'Einschalten' }).click();
    const secretText = card.getByTestId('two-factor-secret');
    await expect(secretText).toHaveText(/^[A-Z2-7]{32}$/, { timeout: 30_000 });
    const secret = base32Decode((await secretText.textContent()) ?? '');
    const code = (offset = 0): string => hotp(secret, timeStep(Date.now()) + offset);
    await expect(card.getByRole('img', { name: 'QR-Code für die App' })).toBeVisible();
    await card.getByLabel('Code aus der App oder Notfallcode').fill(code());
    await card.getByRole('button', { name: 'Bestätigen und einschalten' }).click();
    const codes = card.getByTestId('backup-codes').locator('li');
    await expect(codes).toHaveCount(10);
    const backup = ((await codes.first().textContent()) ?? '').trim();
    expect(backup).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    await card.getByRole('button', { name: 'Ich habe die Codes sicher aufbewahrt' }).click();
    await expect(codes).toHaveCount(0);
    await expect(state).toHaveText(
      'Die Zwei-Faktor-Anmeldung ist eingeschaltet. Noch 10 Notfallcodes übrig.',
    );
    // The password change now asks for a code as well.
    await expect(page.locator('#password-code')).toBeVisible();

    // Sign out and in again: after the password the code.
    await page.locator('section[aria-labelledby="logout-title"]').getByRole('button').click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByLabel('Nutzername').fill(me.name);
    await page.locator('#login-password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    const ask = page.getByTestId('login-code');
    await expect(ask).toBeVisible({ timeout: 30_000 });
    await expect(ask).toContainText('Gib den Code aus deiner App ein');
    await page.getByLabel('Code aus der App oder Notfallcode').fill('000000');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('alert')).toContainText('Der Code stimmt nicht.', {
      timeout: 30_000,
    });
    // The next time step: the code of the setup is used up.
    await page.getByLabel('Code aus der App oder Notfallcode').fill(code(1));
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 30_000 });

    // Switching off with a backup code (the app is lost).
    await page.goto('/app/einstellungen');
    await card.locator('#two-factor-off-password').fill(PASSWORD);
    await card.locator('#two-factor-off-code').fill(backup);
    await card.getByRole('button', { name: 'Ausschalten' }).click();
    await expect(state).toHaveText('Die Zwei-Faktor-Anmeldung ist ausgeschaltet.', {
      timeout: 30_000,
    });
    await expect(page.locator('#password-code')).toHaveCount(0);
    // The wrong code was answered with 401 on purpose; the browser logs that.
    const keep = guard.consoleErrors.filter((text) => !/responded with a status of 401/.test(text));
    guard.consoleErrors.splice(0, guard.consoleErrors.length, ...keep);
  });

  test('Brief lässt sich nicht senden: die Seite springt zur Meldung', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 520 });
    await registerViaUi(page);
    await borrowViaUi(page);
    await page.goto('/app/briefe');
    await page.getByRole('link', { name: /Erklärbär/ }).click();
    await expect(page.getByText(/Ankunft bei Erklärbär/).first()).toBeVisible({ timeout: 30_000 });
    const send = page.getByRole('button', { name: 'Absenden' });
    await send.scrollIntoViewIfNeeded();
    // Nothing written: the message is far above the button and comes into view.
    await send.click();
    const alert = page.getByRole('alert').filter({ hasText: 'Bitte schreib etwas.' });
    await expect(alert).toBeVisible();
    await expect(alert).toBeInViewport();
  });
});
