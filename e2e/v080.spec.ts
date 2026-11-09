/**
 * Version 0.8 in the browser: the bots control centre (bots.<domain>) – own login with forced
 * password change, a bot from draft to active, an event with a picture, the letter at the player
 * (only after it arrived), deletion with the typed name and the system message for the player.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { BOTS_URL, expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';

test.describe.configure({ mode: 'serial' });

test.describe('Bots-Kontrollzentrum (v0.8)', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'ein Durchlauf genügt (eine gemeinsame Instanz)');
  });

  test('Bot anlegen, aktivieren, Brief mit Bild an alle, löschen', async ({ page, browser }) => {
    test.setTimeout(240_000);
    // The player exists before the event runs (new players do not get past letters).
    const playerContext = await browser.newContext({ locale: 'de-DE' });
    const player = await playerContext.newPage();
    await registerViaUi(player);

    const initial = fs
      .readFileSync(
        path.join(process.env['POSTEULEN_E2E_DIR'] ?? '', 'main', 'bots-erstpasswort.txt'),
        'utf8',
      )
      .trim();
    await page.goto(BOTS_URL);
    await expect(
      page.getByRole('heading', { name: 'Anmeldung im Bots-Kontrollzentrum' }),
    ).toBeVisible();
    await page.getByLabel('Passwort').fill(initial);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('heading', { name: 'Erstpasswort ändern' })).toBeVisible({
      timeout: 30_000,
    });
    expect((await page.request.get(`${BOTS_URL}/api/bots`)).status()).toBe(403);
    const password = 'ein eigenes langes Bots-Passwort';
    await page.getByLabel('Neues Passwort', { exact: true }).fill(password);
    await page.getByLabel('Neues Passwort wiederholen').fill(password);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('heading', { name: 'Bots', exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // English and back.
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('button', { name: 'Create bot' })).toBeVisible();
    await page.getByRole('button', { name: 'Deutsch' }).click();

    // Creating is confirmed; the new bot is an empty draft.
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByLabel('Name des neuen Bots').fill('Kapitän Ahoi');
    await page.getByRole('button', { name: 'Bot anlegen' }).click();
    await expect(page.getByRole('heading', { name: /Kapitän Ahoi/ })).toBeVisible();
    await expect(page.getByText(/Für die Aktivierung fehlt noch/)).toBeVisible();

    await page.getByRole('tab', { name: 'Einstellungen' }).click();
    await page
      .getByLabel('Charakter und Hintergrund (geht an die KI)')
      .fill('Ein freundlicher Seefahrer.');
    await page.getByLabel('Breite in Grad').fill('48.86');
    await page.getByLabel('Länge in Grad').fill('2.35');
    await page.getByLabel('zufällige Leiheulen').check();
    await page.getByLabel(/Motivation der Bot-Eulen/).fill('20');
    await page.getByLabel(/Rast beim Spieler/).fill('0');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByText('Gespeichert.')).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Aktivieren' }).click();
    await expect(page.getByRole('button', { name: 'Pausieren' })).toBeVisible();

    // An event two minutes ahead with a picture; preview first.
    await page.getByRole('tab', { name: 'Geplante Events' }).click();
    await page.getByRole('button', { name: 'Neues Event planen' }).click();
    const due = new Date(Date.now() + 2 * 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    await page
      .getByLabel('Zeitpunkt (Ortszeit dieses Geräts)')
      .fill(
        `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}`,
      );
    await page.getByLabel(/Deutsch – Erstkontakt/).fill('Ahoi! Ich bin neu in eurer Gegend.');
    await page.getByLabel('Deutsch – Folgebrief').fill('Ahoi, da bin ich wieder.');
    await page.getByLabel('Englisch – Erstkontakt').fill('Ahoy! I am new around here.');
    await page.getByLabel('Englisch – Folgebrief').fill('Ahoy, here I am again.');
    const png = await sharp({
      create: { width: 64, height: 48, channels: 3, background: '#3366aa' },
    })
      .png()
      .toBuffer();
    await page
      .getByLabel('Bild hinzufügen')
      .setInputFiles({ name: 'meer.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByRole('button', { name: 'Bild entfernen' })).toBeVisible();
    await page.getByRole('button', { name: 'Vorschau', exact: true }).click();
    await expect(page.getByTestId('letter-preview')).toContainText(
      'Ahoi! Ich bin neu in eurer Gegend.',
    );
    await page.getByRole('button', { name: 'Event speichern' }).click();
    await expect(page.getByTestId('planned-event')).toHaveCount(1);

    // The letter arrives at the player; only then the bot appears in the letters.
    await player.goto('/app/briefe');
    await expect(player.getByRole('link', { name: /Kapitän Ahoi/ })).toBeVisible({
      timeout: 180_000,
    });
    await player.getByRole('link', { name: /Kapitän Ahoi/ }).click();
    await expect(player.getByText('Ahoi! Ich bin neu in eurer Gegend.')).toBeVisible();
    await expect(
      player.getByRole('img', { name: /Bild 1 zum Brief von Kapitän Ahoi/ }),
    ).toBeVisible();
    await expect(player.getByTestId('bot-notice')).toBeVisible();
    await page.getByRole('tab', { name: 'Vergangene Events' }).click();
    await page.reload();
    await page.getByRole('button', { name: /Öffnen.*Kapitän Ahoi/ }).click();
    await page.getByRole('tab', { name: 'Vergangene Events' }).click();
    await expect(page.getByTestId('past-event')).toHaveCount(1);

    // Deleting needs the exact name; the player gets a system message.
    await page.getByRole('tab', { name: 'Einstellungen' }).click();
    await page.getByLabel('Zum Bestätigen den Namen des Bots eintippen').fill('Kapitän Ahoi');
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();
    await expect(page.getByRole('heading', { name: 'Bots', exact: true })).toBeVisible();
    await player.goto('/app/briefe/system');
    await expect(
      player.getByText(/Kapitän Ahoi hat seine Feder für immer niedergelegt/),
    ).toBeVisible({
      timeout: 30_000,
    });
    await playerContext.close();
  });
});
