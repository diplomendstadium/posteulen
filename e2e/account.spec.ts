import { expect, settle, test } from './fixtures.ts';
import { localSecrets, loginViaUi, PASSWORD, registerViaUi } from './account-helpers.ts';

test.describe('Konto (Stufe 1, SPEC 5, 17.1, 17.4)', () => {
  test('Registrierung → Abmelden → Login → Passwortwechsel, ohne Klartext an den Server', async ({
    page,
  }) => {
    const bodies: string[] = [];
    page.on('request', (request) => {
      const body = request.postData();
      if (body) bodies.push(body);
    });

    const { name } = await registerViaUi(page);
    await page.getByRole('link', { name: 'Weiter zur Übersicht' }).click();
    await expect(page.getByText('3,0 Gold')).toBeVisible();

    const secrets = await localSecrets(page);
    expect(secrets.length).toBeGreaterThan(0);

    // Reload: the session and the local keys survive (SPEC 5.5).
    await page.reload();
    await expect(page.getByText('3,0 Gold')).toBeVisible();

    await page.goto('/app/einstellungen');
    const newPassword = 'ein neues langes Passwort fuer Tests';
    await page.getByLabel('Bisheriges Passwort').fill(PASSWORD);
    await page.getByLabel('Neues Passwort', { exact: true }).fill(newPassword);
    await page.getByLabel('Neues Passwort wiederholen').fill(newPassword);
    await page.getByRole('button', { name: 'Passwort ändern' }).click();
    await expect(page.getByText('Dein Passwort wurde geändert.')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Abmelden' }).last().click();
    await expect(page).toHaveURL(/\/$/);
    expect(
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const request = indexedDB.open('posteulen');
            request.onsuccess = () => {
              const count = request.result.transaction('keys').objectStore('keys').count();
              count.onsuccess = () => resolve(count.result);
            };
          }),
      ),
    ).toBe(0);

    await loginViaUi(page, name.toUpperCase(), PASSWORD);
    await expect(page.getByRole('alert')).toContainText('Name oder Passwort stimmen nicht.', {
      timeout: 30_000,
    });
    await loginViaUi(page, name, newPassword);
    await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
    expect(await localSecrets(page)).toEqual(secrets);

    // SPEC 17.1: neither passwords nor unencrypted private keys reached the server.
    for (const body of bodies) {
      expect(body).not.toContain(PASSWORD);
      expect(body).not.toContain(newPassword);
      for (const secret of secrets) expect(body).not.toContain(secret);
    }
    expect(bodies.length).toBeGreaterThan(5);
  });

  test('Wohnort im Wasser wird abgelehnt (SPEC 12.4)', async ({ page }) => {
    await page.goto('/konto-erstellen');
    const map = page.getByRole('application', { name: 'Karte von Westeuropa' });
    const box = await map.boundingBox();
    if (!box) throw new Error('no map');
    await page.mouse.click(box.x + box.width * 0.08, box.y + box.height * 0.35);
    await expect(page.getByText('Dort ist Wasser. Eulen wohnen lieber an Land.')).toBeVisible();
  });

  test('Ohne Anmeldung leitet /app zur Startseite', async ({ page }) => {
    await page.goto('/app/eulen');
    await expect(page).toHaveURL(/\/$/);
    await settle(page);
  });
});
