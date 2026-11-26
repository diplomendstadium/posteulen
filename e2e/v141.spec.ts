import { expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';
import { addOwls, setOwl } from './db-helpers.ts';

/**
 * Version 1.4.1: in the owl overview "Bereit für Post" comes first, then "Zu Gast bei dir", then
 * the rest (SPEC 8.5); every card of the settings keeps its gap to the next one, also the holiday
 * mode above "Statistik" (8.10).
 */

test.describe('Version 1.4.1', () => {
  // page.route only sees requests that do not pass a service worker (WebKit).
  test.use({ serviceWorkers: 'block' });

  test('Eulenübersicht: „Bereit für Post“ über „Zu Gast bei dir“, darunter der Rest', async ({
    page,
  }) => {
    const me = await registerViaUi(page);
    addOwls(me.name, 'schleiereule', 2);
    // One owl is busy (lent to the Menagerie) – it belongs below the guests.
    setOwl(
      me.name,
      { owlName: 'Helfer 2' },
      {
        share: 1,
        state: 'menagerie',
        stateUntil: Date.now() + 86_400_000,
      },
    );
    const now = Date.now();
    // A visiting owl, as the server reports it while it rests here (SPEC 8.4).
    await page.route('**/api/owls', async (route) => {
      const response = await route.fetch();
      const json = (await response.json()) as { guests?: unknown[] };
      json.guests = [
        {
          id: 'gast-1',
          name: 'Besucherin',
          species: 'waldkauz',
          sex: 'f',
          loan: false,
          energy: 50,
          maxEnergy: 100,
          motivation: 10,
          fedToday: false,
          pettedToday: false,
          wateredToday: false,
          snackedToday: false,
          feedable: true,
          snackable: true,
          caredAt: null,
          holderId: 'someone',
          holderName: 'Jemand',
          restUntil: now + 3_600_000,
        },
      ];
      await route.fulfill({ response, json });
    });
    await page.goto('/app/eulen');
    await expect(page.getByTestId('guest-owl')).toBeVisible();
    await expect(page.locator('h2.group')).toHaveText([
      'Bereit für Post',
      'Zu Gast bei dir',
      'Unterwegs und beschäftigt',
    ]);
  });

  test('Einstellungen: Abstand zwischen allen Karten, auch über „Statistik“', async ({ page }) => {
    await registerViaUi(page);
    await page.goto('/app/einstellungen');
    await expect(page.getByTestId('vacation-settings')).toBeVisible();
    await expect(page.getByTestId('stats')).toBeVisible();
    const vacation = (await page.getByTestId('vacation-settings').boundingBox())!;
    const stats = (await page.getByTestId('stats').boundingBox())!;
    expect(stats.y - (vacation.y + vacation.height)).toBeGreaterThanOrEqual(20);
    // Every card of the page keeps the same gap to the next one.
    const boxes = await page
      .locator('main section.card')
      .evaluateAll((cards) =>
        cards.map((card) => card.getBoundingClientRect().toJSON() as DOMRect),
      );
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i]!.y - (boxes[i - 1]!.y + boxes[i - 1]!.height)).toBeGreaterThanOrEqual(20);
    }
  });
});
