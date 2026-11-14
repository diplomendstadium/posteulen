/**
 * Version 0.8.3 in the browser: a very long letter stands straight and never widens the page
 * (before, the slightly tilted sheet ran out of the window and the bars went out of sight);
 * short letters keep their slight tilt.
 */
import { expect, test } from './fixtures.ts';
import { borrowViaUi, registerViaUi } from './account-helpers.ts';

test.describe('Lange Briefe (v0.8.3)', () => {
  test('ein sehr langer Brief steht gerade, kurze bleiben leicht schräg', async ({ page }) => {
    test.setTimeout(120_000);
    await registerViaUi(page);
    await borrowViaUi(page);
    await page.goto('/app/briefe');
    await page.getByRole('link', { name: /Erklärbär/ }).click();
    await page.getByLabel(/Lang – bis 15 000 Zeichen/).check();
    const text = Array.from(
      { length: 900 },
      (_, i) => `Zeile ${i + 1} eines sehr langen Briefes.`,
    ).join(' ');
    await page.getByLabel('Text').fill(text.slice(0, 14_500));
    // v0.8.5: the owl choice appears by itself.
    await expect(page.getByText(/Ankunft bei Erklärbär/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Absenden' }).click();
    const own = page.locator('li.letter.mine').last();
    await expect(own).toContainText('Zeile 1 eines sehr langen Briefes.', { timeout: 30_000 });
    await expect(own).toHaveClass(/straight/);
    // The welcome letter of the Erklärbär is short: still slightly tilted.
    await expect(page.locator('li.letter:not(.mine)').first()).not.toHaveClass(/straight/);
    // No sideways scrolling, anywhere along the letter.
    for (const position of [0.5, 1]) {
      await page.evaluate(
        (share) => window.scrollTo(0, document.documentElement.scrollHeight * share),
        position,
      );
      const wide = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(wide).toBeLessThanOrEqual(1);
      await expect(page.locator('[data-bottom-nav]')).toBeInViewport();
    }
  });
});
