import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Browser, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { PASSWORD, registerViaUi } from './account-helpers.ts';
import { addOwls, setGold } from './db-helpers.ts';

/**
 * Version 1.3.0: account switch without reload (SPEC 5.5) – the iPad case. A valid letter of
 * about 680 characters on long parchment from Carla to Ben stays readable for Ben, although
 * account Anna was signed in before in the same tab and late answers of Anna's session arrive
 * after Ben signed in. No "wet" letter, no key warning.
 */

const LETTER = (
  'Lieber Ben, heute Morgen saß eine Waldohreule auf dem Gartenzaun und schaute mich an, als ' +
  'wüsste sie schon, dass ich dir schreiben will. Der Herbst ist hier ganz golden, die Äpfel ' +
  'liegen im Gras und die Igel sind ständig unterwegs. '
)
  .repeat(4)
  .slice(0, 680);

function query<T>(sql: string, ...params: (string | number)[]): T[] {
  const dir = process.env['POSTEULEN_E2E_DIR'];
  if (!dir) throw new Error('POSTEULEN_E2E_DIR is not set');
  const db = new DatabaseSync(path.join(dir, 'main', 'posteulen.sqlite'));
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    return db.prepare(sql).all(...params) as T[];
  } finally {
    db.close();
  }
}

const idOf = (name: string): string =>
  query<{ id: string }>('SELECT id FROM users WHERE name_display = ?', name)[0]!.id;

async function addContact(page: Page, name: string): Promise<void> {
  await page.goto('/app/adressbuch');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText(/^Anfrage gespeichert\./)).toBeVisible();
}

/** Anna and Ben are both coupled with Carla; Carla sends Ben the long letter. */
async function setUp(browser: Browser, page: Page) {
  const contexts = await Promise.all([
    browser.newContext({ locale: 'de-DE' }),
    browser.newContext({ locale: 'de-DE' }),
  ]);
  const [benPage, carlaPage] = await Promise.all(contexts.map((context) => context.newPage()));
  const anna = await registerViaUi(page);
  const ben = await registerViaUi(benPage!);
  const carla = await registerViaUi(carlaPage!);
  await addContact(page, carla.name);
  await addContact(carlaPage!, anna.name);
  await addContact(benPage!, carla.name);
  await addContact(carlaPage!, ben.name);
  addOwls(carla.name, 'waldkauz', 1);
  // Carla writes the long letter to Ben.
  await carlaPage!.goto(`/app/briefe/${idOf(ben.name)}`);
  await carlaPage!.getByLabel('Lang – bis 15.000 Zeichen').check();
  await carlaPage!.getByLabel('Text').fill(LETTER);
  const group = carlaPage!.getByRole('group', { name: 'Welche Eule soll fliegen?' });
  await group.getByRole('radio', { name: /Helfer 1/ }).check();
  await carlaPage!.getByRole('button', { name: 'Absenden' }).click();
  await expect(carlaPage!.getByText('Die Eule ist losgeflogen.')).toBeVisible({
    timeout: 30_000,
  });
  // Delivered (the preview flies 2000 times faster).
  await expect
    .poll(
      () =>
        query<{ status: string }>(
          'SELECT status FROM letters WHERE sender_id = ? AND recipient_id = ?',
          idOf(carla.name),
          idOf(ben.name),
        )[0]?.status,
      { timeout: 60_000 },
    )
    .toBe('delivered');
  return { anna, ben, carla, contexts, benPage: benPage!, carlaPage: carlaPage! };
}

/**
 * The ended session of Anna answers 401 and the server refuses her old tab's requests with 409
 * (account binding): both are expected here and logged by the browser as failed resources.
 */
function expectedFailures(errors: string[]): void {
  const keep = errors.filter((text) => !/responded with a status of (401|409)/.test(text));
  errors.splice(0, errors.length, ...keep);
}

function damage(carla: string, ben: string) {
  const letter = query<{ unreadable: number; read: number }>(
    'SELECT unreadable, read FROM letters WHERE sender_id = ? AND recipient_id = ?',
    idOf(carla),
    idOf(ben),
  )[0];
  const warnings = query<{ n: number }>(
    'SELECT COUNT(*) AS n FROM contacts WHERE warn_lo = 1 OR warn_hi = 1',
  )[0]!.n;
  return { unreadable: letter?.unreadable ?? -1, warnings };
}

test.describe('Kontowechsel ohne Neuladen (SPEC 5.5)', () => {
  test('späte Antworten von Anna ändern nichts an Ben; der lange Brief bleibt lesbar', async ({
    browser,
    page,
    guard,
  }) => {
    test.slow();
    const { anna, ben, carla, contexts } = await setUp(browser, page);
    const annaId = idOf(anna.name);
    const carlaId = idOf(carla.name);

    // Anna's tab opens her chat with Carla; from now on Anna's answers come late: they are
    // fetched with Anna's cookie, but handed to the page only after Ben has signed in.
    await page.goto(`/app/briefe/${carlaId}`);
    await expect(page.getByLabel('Text')).toBeVisible();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const late = async (route: Route) => {
      const response = await route.fetch().catch(() => null);
      await gate;
      if (response) await route.fulfill({ response }).catch(() => undefined);
      else await route.abort().catch(() => undefined);
    };
    await page.route(/\/api\/(chats|contacts|vault|homecomings|arrivals)(\/|$|\?)/, late);
    // Leave the chat and come back (app links, no page load): the loads start and hang.
    await page.locator('a[href="/app/adressbuch"]').first().click();
    await page.locator('a[href="/app/briefe"]').first().click();

    // Anna's session ends on the server (e.g. signed in elsewhere); her next request sees it.
    query('DELETE FROM sessions WHERE user_id = ?', annaId);
    await page.locator('a[href="/app/eulen"]').first().click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

    // Ben signs in in the same tab – without reloading the page.
    await page.unroute(/\/api\/(chats|contacts|vault|homecomings|arrivals)(\/|$|\?)/, late);
    await page.getByLabel('Nutzername').fill(ben.name);
    await page.getByLabel('Passwort').fill(PASSWORD);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page).toHaveURL(/\/app/, { timeout: 30_000 });
    // Now Anna's late answers (and late 401s) arrive.
    release();

    await page.locator('a[href="/app/briefe"]').first().click();
    await page
      .getByRole('link', { name: new RegExp(carla.name) })
      .first()
      .click();
    await expect(page.getByText(LETTER.slice(0, 60))).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/so nass geworden/)).toHaveCount(0);
    await expect(page.getByText(/haben sich geändert/)).toHaveCount(0);
    // Ben is still signed in (no late 401 of Anna signed him out).
    await page.locator('a[href="/app/adressbuch"]').first().click();
    await expect(page.getByText(carla.name, { exact: true })).toBeVisible();
    await expect(page.getByText('Schlüsselwarnung')).toHaveCount(0);
    expect(damage(carla.name, ben.name)).toEqual({ unreadable: 0, warnings: 0 });
    expectedFailures(guard.consoleErrors);
    await Promise.all(contexts.map((context) => context.close()));
  });

  test('ein zweiter Tab meldet Ben an: Annas alter Tab richtet keinen Schaden an', async ({
    browser,
    page,
    guard,
  }) => {
    test.slow();
    const { anna, ben, carla, contexts } = await setUp(browser, page);
    const carlaId = idOf(carla.name);
    // Anna's tab shows her chat with Carla.
    await page.goto(`/app/briefe/${carlaId}`);
    await expect(page.getByLabel('Text')).toBeVisible();
    // Anna's session ends on the server – her tab does not know yet.
    query('DELETE FROM sessions WHERE user_id = ?', idOf(anna.name));
    // In a second tab of the same browser Ben signs in (the cookie and the stored keys change).
    const second = await page.context().newPage();
    await second.goto('/');
    await second.getByLabel('Nutzername').fill(ben.name);
    await second.getByLabel('Passwort').fill(PASSWORD);
    await second.getByRole('button', { name: 'Anmelden' }).click();
    await expect(second).toHaveURL(/\/app/, { timeout: 30_000 });
    // Anna's old tab keeps working: whatever it does is either refused (other account) or
    // done for Ben with Ben's keys – it follows the switch.
    await page.locator('a[href="/app/adressbuch"]').first().click();
    await page.locator('a[href="/app/briefe"]').first().click();
    await expect(page.getByRole('link', { name: new RegExp(carla.name) }).first()).toBeVisible({
      timeout: 30_000,
    });
    await page
      .getByRole('link', { name: new RegExp(carla.name) })
      .first()
      .click();
    await expect(page.getByText(LETTER.slice(0, 60))).toBeVisible({ timeout: 30_000 });
    // Ben reads the letter in his own tab as well.
    await second.goto(`/app/briefe/${carlaId}`);
    await expect(second.getByText(LETTER.slice(0, 60))).toBeVisible({ timeout: 30_000 });
    await expect(second.getByText(/so nass geworden/)).toHaveCount(0);
    expect(damage(carla.name, ben.name)).toEqual({ unreadable: 0, warnings: 0 });
    expectedFailures(guard.consoleErrors);
    await Promise.all(contexts.map((context) => context.close()));
  });
});

test.describe('Version 1.3.0: Oberfläche', () => {
  test('Übersicht, Hilfe-Links, Einstellungen mit Statistik und ASCII-Modus', async ({ page }) => {
    const me = await registerViaUi(page);
    // v1.3: thousands grouped with a dot.
    setGold(me.name, 12_345);
    await page.goto('/app');
    const tiles = page.locator('ul.tiles');
    await expect(tiles.getByRole('link', { name: 'Meine Eulen' })).toBeVisible();
    await expect(tiles.getByRole('link', { name: 'Rettungsstation' })).toBeVisible();
    await expect(tiles.getByRole('link', { name: 'Hilfe' })).toHaveCount(0);
    await expect(page.getByText('1.234,5 Gold')).toBeVisible();
    // The question mark next to the flag leads to the help.
    await page.getByTestId('help-link').first().click();
    await expect(page).toHaveURL(/\/hilfe$/);

    await page.goto('/app/einstellungen');
    const titles = await page.locator('section.card h2').allTextContents();
    const at = (title: string) => titles.indexOf(title);
    expect(at('Statistik')).toBe(at('Benachrichtigungen') + 1);
    expect(at('Gold und Buchungen')).toBe(at('Statistik') + 1);
    expect(titles.at(-1)).toBe('Hilfe');
    const stats = page.getByTestId('stats');
    await expect(stats).toContainText('Tage seit Kontoerstellung');
    await expect(stats).toContainText('Aktive Tage');
    await expect(stats).toContainText('1 (100 %)');
    await expect(stats).toContainText('Medizin gegeben');
    await page.getByTestId('ascii-mode').check();
    await expect(page.getByTestId('ascii-mode')).toBeChecked();

    // The Explainer Bear's chat links to the help between the letters and the editor.
    await page.goto('/app/briefe');
    await page.getByRole('link', { name: /Erklärbär/ }).click();
    await expect(
      page.getByTestId('explainer-help').getByRole('link', { name: 'Zur Hilfe' }),
    ).toBeVisible();
    // No typewriter option for letters to bots.
    await expect(page.getByTestId('letter-mono')).toHaveCount(0);
  });

  test('Postamt zeigt das Geschlecht, 🌍 hinter dem Namen, Verschenken nur für aktive Spieler', async ({
    page,
  }) => {
    const me = await registerViaUi(page);
    await page.goto('/app/postamt/innen');
    const offer = page.getByTestId('loan-offer').first();
    await expect(offer.locator('.species-name')).toHaveText(/ · (weiblich|männlich)$/);
    addOwls(me.name, 'bartkauz', 1);
    query(
      "UPDATE owls SET km_flown = 41000 WHERE name = 'Helfer 1' AND owner_id = ?",
      idOf(me.name),
    );
    await page.goto('/app/eulen');
    const card = page.getByTestId('owl-card').filter({ hasText: 'Helfer 1' });
    await expect(card.getByRole('heading', { level: 3 })).toHaveText('Helfer 1 🌍');
    await expect(card).toContainText('41.000 km');
    // A new account is not "active" yet: the button stays, but is off with a short note.
    await expect(card.getByRole('button', { name: 'Verschenken' })).toBeDisabled();
    await expect(card.getByTestId('gift-rule')).toHaveText(
      'Nur aktive Spieler können alle zwei Wochen Gold oder eine Eule verschenken.',
    );
  });

  test('ein Brief in Schreibmaschinenschrift für ASCII-Art – für beide Seiten', async ({
    browser,
    page,
  }) => {
    test.slow();
    const context = await browser.newContext({ locale: 'de-DE' });
    const benPage = await context.newPage();
    const anna = await registerViaUi(page);
    const ben = await registerViaUi(benPage);
    await addContact(page, ben.name);
    await addContact(benPage, anna.name);
    addOwls(anna.name, 'waldkauz', 1);
    await page.goto('/app/einstellungen');
    await page.getByTestId('ascii-mode').check();
    await expect(page.getByTestId('ascii-mode')).toBeChecked();
    await page.goto(`/app/briefe/${idOf(ben.name)}`);
    const art = ' /\\_/\\\n( o.o )\n > ^ <';
    await page.getByLabel('Text').fill(art);
    await page.getByTestId('letter-mono').check();
    const group = page.getByRole('group', { name: 'Welche Eule soll fliegen?' });
    await group.getByRole('radio', { name: /Helfer 1/ }).check();
    await page.getByRole('button', { name: 'Absenden' }).click();
    await expect(page.getByText('Die Eule ist losgeflogen.')).toBeVisible({ timeout: 30_000 });
    // Chosen anew for every letter.
    await expect(page.getByTestId('letter-mono')).not.toBeChecked();
    await expect(page.locator('p.text.mono')).toHaveCount(1);
    await expect
      .poll(
        () =>
          query<{ status: string }>(
            'SELECT status FROM letters WHERE sender_id = ? AND recipient_id = ?',
            idOf(anna.name),
            idOf(ben.name),
          )[0]?.status,
        { timeout: 60_000 },
      )
      .toBe('delivered');
    await benPage.goto(`/app/briefe/${idOf(anna.name)}`);
    const letter = benPage.locator('p.text.mono');
    await expect(letter).toHaveCount(1, { timeout: 30_000 });
    await expect(letter).toHaveCSS('white-space', 'pre');
    await context.close();
  });
});
