import { expect, type Page } from '@playwright/test';

let counter = 0;

/** Unique, valid user name per test run (letters only, 20 chars max). */
export function uniqueName(prefix = 'Eule'): string {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  let suffix = '';
  let n = Date.now() * 100 + counter++ + Math.floor(Math.random() * 100);
  for (let i = 0; i < 8; i++) {
    suffix += letters[n % letters.length];
    n = Math.floor(n / letters.length);
  }
  return `${prefix} ${suffix}`;
}

export const PASSWORD = 'ein langes Passwort fuer Tests';

export async function registerViaUi(
  page: Page,
  options: { base?: string; name?: string; password?: string; inviteCode?: string } = {},
): Promise<{ name: string; password: string }> {
  const name = options.name ?? uniqueName();
  const password = options.password ?? PASSWORD;
  await page.goto(`${options.base ?? ''}/konto-erstellen`);
  if (options.inviteCode) await page.getByLabel('Einladungscode').fill(options.inviteCode);
  await page.getByLabel('Nutzername').fill(name);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByLabel('Passwort wiederholen').fill(password);
  // Keyboard: Enter picks the centre of the map (land in France).
  await page.getByRole('application', { name: 'Karte von Westeuropa' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^Gewählt:/)).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).toHaveURL(/\/willkommen$/, { timeout: 30_000 });
  return { name, password };
}

export async function loginViaUi(
  page: Page,
  name: string,
  password: string,
  base = '',
): Promise<void> {
  await page.goto(`${base}/`);
  await page.getByLabel('Nutzername').fill(name);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
}

/** Decrypts the locally stored keys with the non-extractable key (test only). */
export async function localSecrets(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('posteulen');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise<{
      userId: string;
      key: CryptoKey;
      iv: Uint8Array;
      data: ArrayBuffer;
    }>((resolve, reject) => {
      const request = db.transaction('keys').objectStore('keys').get('account');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: record.iv as BufferSource,
          additionalData: new TextEncoder().encode(record.userId),
        },
        record.key,
        record.data,
      ),
    );
    const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
    const toB64Url = (b: Uint8Array) =>
      toB64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    // ed25519 secret seed (first 32 of 64), x25519 secret, vault key
    const parts = [plain.slice(0, 32), plain.slice(64, 96), plain.slice(160, 192)];
    return parts.flatMap((part) => [
      toHex(part),
      toB64(part).slice(0, 40),
      toB64Url(part).slice(0, 40),
    ]);
  });
}
