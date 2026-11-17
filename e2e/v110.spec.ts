/**
 * Version 1.1 in the browser: Christmas parchment in the chat and in the writing field, the new
 * handwriting of received letters, arrival pictures at the first opportunity, large owl
 * pictures, the team of the post office, night and Christmas pictures, rests of 6 and 12 hours.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { borrowViaUi, registerViaUi } from './account-helpers.ts';
import { markChristmas, setOwlEnergy } from './db-helpers.ts';

/** Where the screenshots go if wanted (POSTEULEN_V110_SHOTS=folder). */
const SHOTS = process.env['POSTEULEN_V110_SHOTS'];

async function shot(page: Page, name: string, fullPage = true): Promise<void> {
  // Only in Chromium: WebKit reports the screenshot's own style element as a CSP violation.
  if (!SHOTS || page.context().browser()?.browserType().name() === 'webkit') return;
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage, caret: 'initial' });
}

async function addContact(page: Page, name: string): Promise<void> {
  await page.goto('/app/adressbuch');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(page.getByText(/^Anfrage gespeichert\./)).toBeVisible();
}

test.describe('Version 1.1', () => {
  test('Weihnachtspergament, Schreibfeld, neue Handschrift und Landung beim Öffnen der App', async ({
    browser,
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    // The browser lives in Advent; the server decides by its own clock (marked in the DB below).
    await page.clock.setFixedTime(new Date('2026-12-10T11:00:00+01:00'));
    const anna = await registerViaUi(page);
    const otherContext = await browser.newContext({
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      ...(testInfo.project.use.viewport ? { viewport: testInfo.project.use.viewport } : {}),
    });
    const other = await otherContext.newPage();
    await other.clock.setFixedTime(new Date('2026-12-10T11:00:00+01:00'));
    const ben = await registerViaUi(other);
    await addContact(page, ben.name);
    await addContact(other, anna.name);

    // Ben has closed the app – the landing waits for his next visit.
    await other.goto('about:blank');
    const owl = await borrowViaUi(page);
    await page.goto('/app/adressbuch');
    await page.getByTestId('person-contact').getByRole('link', { name: 'Brief schreiben' }).click();
    // The writing field looks like the own letter: handwriting, Christmas parchment (A).
    const field = page.getByLabel('Text');
    await expect(field).toHaveClass(/christmas-[1-4]A/);
    expect(await field.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Dancing Script/);
    // v1.1: rests of 6 and 12 hours.
    const rests = await page
      .getByLabel('Rast bei jedem Empfänger')
      .locator('option')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(rests).toEqual(['0', '1', '2', '6', '12', '24', '48']);
    await field.fill('Liebe Grüße aus dem verschneiten Eulenturm!');
    await shot(page, `schreibfeld-${testInfo.project.name}`, false);
    await expect(page.getByRole('radio', { name: new RegExp(owl) })).toBeChecked();
    await page.getByRole('button', { name: 'Absenden' }).click();
    await expect(page.getByText('Die Eule ist losgeflogen.')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('p.status', { hasText: 'zugestellt' })).toBeVisible({
      timeout: 60_000,
    });

    // Ben opens only the overview: the landing appears there (no chat needed).
    await other.goto('/app');
    const overlay = other.getByTestId('owl-overlay');
    await expect(overlay).toContainText(
      new RegExp(`${owl} ist gelandet und bringt dir Post von ${anna.name}`),
      { timeout: 60_000 },
    );
    await expect(overlay).toHaveAttribute('data-kind', 'arrival');

    // Written in Advent (decided by the server; here set in the database).
    markChristmas(anna.name);
    await other.goto('/app/briefe');
    await other.getByRole('link', { name: new RegExp(anna.name) }).click();
    const received = other.locator('li.letter:not(.mine) .sheet[data-christmas]');
    await expect(received).toHaveClass(/christmas-[1-4]B/);
    expect(await received.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(
      /Playwrite DE VA/,
    );
    // Both sides see the same pair.
    await page.reload();
    const own = page.locator('li.letter.mine .sheet[data-christmas]');
    await expect(own).toHaveClass(/christmas-[1-4]A/);
    const pair = (await own.getAttribute('data-christmas')) ?? '';
    await expect(received).toHaveAttribute('data-christmas', pair);
    await shot(other, `weihnachtsbrief-${testInfo.project.name}`);
    await otherContext.close();
  });

  test('Große Eulenbilder, Team im Postamt, Nachtbilder', async ({ page }, testInfo) => {
    // 23:00 in Paris (home in France): dark at home.
    await page.clock.setFixedTime(new Date('2026-11-16T23:00:00+01:00'));
    const account = await registerViaUi(page);
    const owl = await borrowViaUi(page);
    await expect(page.getByText(/Heute geliehen: 1 von 5/)).toBeVisible();
    // Full motivation: not the grumpy picture of 80 %.
    setOwlEnergy(account.name, 1, 10);
    // v1.2: inside the post office the picture of the team of the day.
    await expect(page.getByTestId('place-image')).toHaveAttribute(
      'data-scene',
      /^postInside[ABCD]Night$/,
    );
    await page.goto('/app/eulen');
    const card = page.getByTestId('owl-card').filter({ hasText: owl });
    const picture = card.locator('img').first();
    // At night the awake owl in the dark.
    await expect(picture).toHaveAttribute('src', /-night-/);
    // Across the whole card, values and buttons below.
    const [cardBox, pictureBox, nameBox] = await Promise.all([
      card.boundingBox(),
      picture.boundingBox(),
      card.getByRole('heading', { name: owl }).boundingBox(),
    ]);
    expect(pictureBox!.width).toBeGreaterThan(cardBox!.width * 0.8);
    expect(nameBox!.y).toBeGreaterThan(pictureBox!.y + pictureBox!.height - 1);
    await shot(page, `eulen-nacht-${testInfo.project.name}`, false);
  });

  test('Gruppenbild und Ortsbilder nach Tageszeit und Weihnachtszeit (ohne Anmeldung Berlin)', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-11-16T12:00:00+01:00'));
    await page.goto('/');
    await expect(page.locator('figure.group')).toHaveAttribute('data-scene', 'group');
    await page.clock.setFixedTime(new Date('2026-11-16T23:00:00+01:00'));
    await page.reload();
    await expect(page.locator('figure.group')).toHaveAttribute('data-scene', 'groupNight');
    await page.clock.setFixedTime(new Date('2026-12-05T12:00:00+01:00'));
    await page.reload();
    await expect(page.locator('figure.group')).toHaveAttribute('data-scene', 'groupXmasDay');
    await shot(page, 'start-weihnachten', false);
    await page.clock.setFixedTime(new Date('2026-12-27T12:00:00+01:00'));
    await page.reload();
    await expect(page.locator('figure.group')).toHaveAttribute('data-scene', 'group');
  });
});
