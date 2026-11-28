import { expect, test } from './fixtures.ts';
import { registerViaUi } from './account-helpers.ts';
import { hatchChicks, setGold } from './db-helpers.ts';

/**
 * Version 1.5.0: chicks get a mealworm and petting only, each with its own picture (SPEC 9.3,
 * 9.9), three looks of chicks by day and night (9.2.6) and the shorter info text on the start
 * page (8.1). The daily notice about a chick to give away: stage4.spec.ts.
 */

test.describe('Version 1.5.0', () => {
  test('Küken: Mehlwurm und Streicheln, eigene Bilder', async ({ page }) => {
    const me = await registerViaUi(page);
    setGold(me.name, 300);
    hatchChicks(me.name, 'waldkauz', 1);
    await page.goto('/app/eulen');
    await page.getByLabel('Name (2–20 Zeichen)').fill('Flaum');
    await page.getByRole('button', { name: 'Speichern' }).click();
    const card = page.getByTestId('owl-card').filter({ hasText: 'Flaum' });
    await expect(card.locator('.picture img')).toHaveAttribute('src', /Waldkauz-chick(Night)?-/);
    // Only petting and the mealworm (renaming as for every owl).
    await expect(card.locator('.actions button')).toHaveText([
      'Streicheln',
      'Mehlwurm (0,1 Gold)',
      'Umbenennen',
    ]);
    await card.getByRole('button', { name: 'Mehlwurm (0,1 Gold)' }).click();
    await expect(page.getByTestId('owl-overlay')).toHaveAttribute('data-kind', 'chickFeeding');
    await expect(page.getByTestId('owl-overlay')).toContainText('Flaum verputzt einen Mehlwurm');
    await page.getByTestId('owl-overlay').click();
    // Once a day: the button is gone until tomorrow.
    await expect(card.getByRole('button', { name: /Mehlwurm/ })).toHaveCount(0);
    await card.getByRole('button', { name: 'Streicheln' }).click();
    await expect(page.getByTestId('owl-overlay')).toHaveAttribute('data-kind', 'chickPetting');
  });

  test('Die Startseite erwähnt OpenAI und den Filter nicht mehr', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('antworten per KI. Wer das nicht möchte')).toBeVisible();
    await expect(page.getByText('gehen zum Beantworten an OpenAI')).toHaveCount(0);
    await expect(page.getByText('Vorher streicht ein Filter')).toHaveCount(0);
  });
});
