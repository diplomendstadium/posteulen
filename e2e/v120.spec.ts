/**
 * Version 1.2 in the browser: the map background as a hand-drawn atlas with names of
 * landscapes, rivers and seas, the shorter legend, the entrance of the post office with the
 * picture of the team inside, the small print below the letter and the grumpy owl at night.
 */
import { expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';
import { addOwls, setOwlEnergy } from './db-helpers.ts';

test.describe('Version 1.2', () => {
  test('Karte als Atlas: Symbole, Flüsse, Namen nach Zoom; kurze Legende', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/app/karte');
    const map = page.locator('svg[role="application"]');
    await expect(page.getByTestId('map-atlas')).toBeAttached();
    await expect(page.locator('path.river').first()).toBeAttached();
    await expect(page.locator('path.border')).toBeAttached();
    // The legend: no explanation behind „Nacht“, the travelling owls renamed.
    const legend = page.locator('ul.legend');
    await expect(legend.getByText('Nacht', { exact: true })).toBeVisible();
    await expect(legend.getByText('Reisende Eulen', { exact: true })).toBeVisible();
    await expect(legend).not.toContainText('Horizont');
    // Names of the atlas layer in the italic serif, more of them when zoomed in.
    const names = page.locator('.atlas-names text');
    await expect(names.first()).toBeAttached();
    expect(
      await names.first().evaluate((element) => getComputedStyle(element).fontFamily),
    ).toContain('EB Garamond');
    await map.focus();
    for (let i = 0; i < 12; i++) await page.keyboard.press('-');
    const far = await names.allTextContents();
    for (let i = 0; i < 14; i++) await page.keyboard.press('+');
    await expect
      .poll(async () => (await names.allTextContents()).join('|'))
      .not.toBe(far.join('|'));
  });

  test('Postamt: erst der Eingang, drinnen das Bild des Tagesteams', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/app/postamt');
    await expect(page.getByText(/^Das Eulenpostamt: Hier leihst du Eulen/)).toBeVisible();
    await expect(page.getByTestId('loan-offer')).toHaveCount(0);
    await page.getByRole('link', { name: 'Eulenpostamt betreten' }).click();
    await expect(page).toHaveURL(/\/app\/postamt\/innen$/);
    await expect(page.getByTestId('loan-offer')).toHaveCount(5);
    const team = (await (await page.request.get('/api/menagerie')).json()) as { team: string };
    await expect(page.getByTestId('place-image')).toHaveAttribute(
      'data-scene',
      new RegExp(`^postInside${team.team}(Xmas)?(Day|Night)$`),
    );
    await expect(page.getByTestId('place-image').locator('img')).toHaveAttribute(
      'alt',
      /^(Nachts im|Im|Weihnachten im|Weihnachtsnacht im) Eulenpostamt$/,
    );
    // Back leads to the entrance again.
    await page.goBack();
    await expect(page.getByRole('link', { name: 'Eulenpostamt betreten' })).toBeVisible();
  });

  test('Briefe: Zeit, Pergament und Eule unter dem Pergament', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/app/briefe');
    await page.getByRole('link', { name: /Erklärbär/ }).click();
    const letter = page.locator('li.letter').first();
    await expect(letter.locator('.under .meta')).toContainText(
      /Empfangen am .* · kurzes Pergament/,
    );
    await expect(letter.locator('.sheet .meta')).toHaveCount(0);
    const [sheet, meta] = await Promise.all([
      letter.locator('.sheet').boundingBox(),
      letter.locator('.under').boundingBox(),
    ]);
    expect(meta!.y).toBeGreaterThan(sheet!.y + sheet!.height - 1);
  });

  test('Grummelige Eule bei Nacht im Dunkeln', async ({ page }) => {
    // 23:00 in Paris (home in France): dark at home.
    await page.clock.setFixedTime(new Date('2026-11-16T23:00:00+01:00'));
    const account = await registerViaUi(page);
    addOwls(account.name, 'waldkauz', 1);
    // Motivation 80 %: grumpy at home.
    setOwlEnergy(account.name, 1, 8);
    await page.goto('/app/eulen');
    await expect(page.getByTestId('owl-card').first().locator('img').first()).toHaveAttribute(
      'src',
      /-grumpyNight-/,
    );
  });
});
