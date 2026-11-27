/**
 * Version 1.2.1 in the browser: the desk on top of the letters page by season, by day and by
 * night (the Menagerie entrance, the order of the owl overview and the server dashboard are
 * tested with their pages in v0100, v03 and admin).
 */
import { expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';

test.describe('Version 1.2.1', () => {
  test('Briefwechsel: Schreibtisch nach Jahreszeit, bei Tag und bei Nacht', async ({ page }) => {
    await registerViaUi(page);
    const picture = page.getByTestId('place-image');
    const at = async (time: string, scene: string, alt: RegExp) => {
      await page.clock.setFixedTime(new Date(time));
      await page.goto('/app/briefe');
      await expect(picture).toHaveAttribute('data-scene', scene);
      await expect(picture.locator('img')).toHaveAttribute('alt', alt);
    };
    await at('2026-11-18T12:00:00+01:00', 'lettersNovemberDay', /^Schreibtisch im November$/);
    await at('2026-11-18T23:00:00+01:00', 'lettersNovemberNight', /Novembernacht$/);
    await at('2026-12-05T12:00:00+01:00', 'lettersChristmasDay', /Weihnachtszeit$/);
    await at('2026-12-27T23:00:00+01:00', 'lettersWinterNight', /Winternacht$/);
    await at('2027-03-01T12:00:00+01:00', 'lettersSpringDay', /im Frühling$/);
    await at('2027-07-15T12:00:00+02:00', 'lettersSummerDay', /im Sommer$/);
    await at('2027-10-10T23:30:00+02:00', 'lettersAutumnNight', /Herbstnacht$/);
  });
});
