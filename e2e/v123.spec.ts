/**
 * Version 1.2.3 in the browser: the start page – login box centred, link box as wide as the
 * page, and the info text with its pictures below it, in German and English.
 */
import { expect, test } from './fixtures.ts';

test.describe('Version 1.2.3', () => {
  test('Startseite: Anmeldung zentriert, Linkbox breit, Infotext mit Bildern', async ({
    page,
  }, testInfo) => {
    await page.clock.setFixedTime(new Date('2026-11-18T12:00:00+01:00'));
    await page.goto('/');
    const hero = await page.locator('.hero').boundingBox();
    const links = await page.locator('.footer-links').boundingBox();
    const about = page.getByTestId('about');
    const box = await about.boundingBox();
    expect(Math.abs((links?.width ?? 0) - (hero?.width ?? 1))).toBeLessThan(2);
    expect(Math.abs((box?.width ?? 0) - (hero?.width ?? 1))).toBeLessThan(2);
    expect(box?.y ?? 0).toBeGreaterThan((links?.y ?? 0) + (links?.height ?? 0));

    // Heading centred in the box, the two buttons at its left and right edge.
    const login = page.locator('.login');
    const card = (await login.boundingBox())!;
    const heading = (await login.getByRole('heading', { name: 'Anmelden' }).boundingBox())!;
    expect(Math.abs(heading.x + heading.width / 2 - (card.x + card.width / 2))).toBeLessThan(2);
    const signIn = (await login.getByRole('button', { name: 'Anmelden' }).boundingBox())!;
    const create = (await login.getByRole('link', { name: 'Konto erstellen' }).boundingBox())!;
    expect(
      Math.abs(card.x + card.width - (create.x + create.width) - (signIn.x - card.x)),
    ).toBeLessThan(2);

    await expect(about.getByRole('heading', { name: 'Über PostEulen' })).toBeVisible();
    await expect(
      about.getByText('Selbstverständlich gibt es auch keine In-App-Käufe.'),
    ).toBeVisible();
    await expect(about.locator('figure')).toHaveCount(5);
    await expect(about.locator('figure').first()).toHaveAttribute(
      'data-scene',
      'lettersNovemberDay',
    );
    await expect(about.getByText(`${new URL(page.url()).host} öffnen`).first()).toBeVisible();
    if (testInfo.project.name.includes('desktop')) {
      // Vertically centred: as much room above the heading as below the buttons.
      const top = heading.y - card.y;
      const bottom = card.y + card.height - (signIn.y + signIn.height);
      expect(Math.abs(top - bottom)).toBeLessThan(2);
      // Pictures at half the width of the text, alternating right and left.
      const figures = await about
        .locator('figure')
        .evaluateAll((all) => all.map((figure) => getComputedStyle(figure).float));
      expect(figures).toEqual(['right', 'left', 'right', 'left', 'right']);
    }

    await about.getByRole('link', { name: 'Hilfe' }).click();
    await expect(page).toHaveURL(/\/hilfe$/);

    // English: the same box in English, the pictures stay.
    await page.goto('/');
    await page.getByRole('button', { name: 'Switch to English' }).click();
    await expect(about.getByRole('heading', { name: 'About PostEulen' })).toBeVisible();
    await expect(about.getByText('Of course there are no in-app purchases either.')).toBeVisible();
    await expect(about.locator('figure')).toHaveCount(5);
  });
});
