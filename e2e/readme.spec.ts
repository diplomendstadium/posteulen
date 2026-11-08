/**
 * Screenshots for README.md (docs/readme/). Not part of the normal test run:
 *   POSTEULEN_README_SHOTS=1 npx playwright test e2e/readme.spec.ts --project=chromium-mobile
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { expect, settle, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';
import { setGold } from './db-helpers.ts';

const OUT = path.resolve('docs/readme');

test.skip(!process.env['POSTEULEN_README_SHOTS'], 'only on request');

function sql(query: string, ...params: (string | number)[]): void {
  const dir = process.env['POSTEULEN_E2E_DIR'] ?? '';
  const db = new DatabaseSync(path.join(dir, 'main', 'posteulen.sqlite'));
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    db.prepare(query).run(...params);
  } finally {
    db.close();
  }
}

async function addContact(page: Page, name: string): Promise<void> {
  await page.goto('/app/adressbuch');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText(/^Anfrage gespeichert\./)).toBeVisible();
}

async function write(page: Page, text: string, owl?: RegExp): Promise<void> {
  await page.goto('/app/adressbuch');
  await page.getByTestId('person-contact').getByRole('link', { name: 'Brief schreiben' }).click();
  await page.getByLabel('Text').fill(text);
  await page.getByRole('button', { name: 'Eule wählen' }).click();
  const group = page.getByRole('group', { name: 'Welche Eule soll fliegen?' });
  await (owl ? group.getByRole('radio', { name: owl }) : group.getByRole('radio')).first().check();
  await page.getByRole('button', { name: 'Absenden' }).click();
  await expect(page.getByText('Die Eule ist losgeflogen.')).toBeVisible({ timeout: 30_000 });
}

async function shot(page: Page, file: string): Promise<void> {
  await settle(page);
  const image = await page.screenshot();
  const meta = await sharp(image).metadata();
  await sharp(image)
    .extract({ left: 0, top: 0, width: meta.width ?? 0, height: Math.min(meta.height ?? 0, 2600) })
    .resize(780)
    .png({ palette: true, quality: 85, compressionLevel: 9 })
    .toFile(path.join(OUT, file));
}

test('README-Bilder', async ({ browser, page }) => {
  test.setTimeout(420_000);
  fs.mkdirSync(OUT, { recursive: true });
  await sharp('images/Gruppenbild.png')
    .resize(960)
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(path.join(OUT, 'gruppenbild.jpg'));

  const anna = await registerViaUi(page, { name: 'Anna Federkiel' });
  const benContext = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const benPage = await benContext.newPage();
  const ben = await registerViaUi(benPage, {
    name: 'Ben Pergament',
    mapKeys: ['+', '+', 'ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowRight'],
  });
  await addContact(page, ben.name);
  await addContact(benPage, anna.name);
  setGold(anna.name, 300);
  setGold(ben.name, 50);

  await write(
    benPage,
    'Liebe Anna,\ndie Äpfel im Garten sind endlich reif, und meine Leiheule hat heute früh schon zwei davon angepickt. Kommst du am Samstag vorbei? Ich backe Kuchen – mit Streuseln, versprochen!\nHerzlich, Ben',
  );

  // Anna: a loan owl waiting at home, and her own tawny owl, which will set off tired.
  await page.goto('/app/menagerie');
  await page.getByTestId('loan-offer').first().getByRole('button').click();
  // v0.7.1: a purchase is confirmed first.
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Waldkauz kaufen' }).click();
  await page.getByLabel('Name (2–20 Zeichen)').fill('Fiete');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { name: 'Fiete', exact: true })).toBeVisible();
  sql("UPDATE owls SET energy = 90, energy_at = ? WHERE name = 'Fiete'", Date.now());

  // Ben's letter may need a while, even in the time-lapse.
  await expect(async () => {
    await page.goto('/app/briefe');
    await expect(page.getByRole('link', { name: /Ben Pergament/ })).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 150_000 });
  await page.getByRole('link', { name: /Ben Pergament/ }).click();
  await expect(page.locator('li.letter')).toHaveCount(1, { timeout: 30_000 });
  await write(
    page,
    'Lieber Ben,\nSamstag passt wunderbar! Ich bringe Sahne mit und Fiete, meinen Waldkauz – er will sich bei deiner Eule für die angepickten Äpfel entschuldigen.\nBis bald, Anna',
    /Fiete/,
  );
  // The hint about notifications can be hidden until the next login (v0.3).
  await page.getByRole('button', { name: 'Ausblenden bis zur nächsten Anmeldung' }).click();
  await page.goto('/app/briefe');
  await page.getByRole('link', { name: /Ben Pergament/ }).click();
  await expect(page.locator('li.letter')).toHaveCount(2);
  await page.locator('li.letter').first().scrollIntoViewIfNeeded();
  await shot(page, 'briefe.png');

  // Wait until Fiete has slept once and flies on: the map shows the path and a "Zzz".
  await page.goto('/app/karte');
  for (let i = 0; i < 60; i++) {
    await page.reload();
    await page.waitForLoadState('networkidle');
    if ((await page.locator('[data-testid="map-tracks"] text').count()) > 0) break;
    await page.waitForTimeout(2_000);
  }
  await expect(page.locator('[data-testid="map-tracks"] text').first()).toBeAttached();
  // A little further on, so the path behind Fiete is visible; one step closer.
  await page.waitForTimeout(8_000);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Vergrößern' }).click();
  await shot(page, 'karte.png');

  await page.goto('/app/eulen');
  await expect(page.getByRole('heading', { name: 'Leiheulen', level: 2 })).toBeVisible();
  // A tall phone screen, so both groups fit (a full-page shot would repeat the fixed bars).
  await page.setViewportSize({ width: 412, height: 1500 });
  await shot(page, 'eulen.png');
  await benContext.close();
});
