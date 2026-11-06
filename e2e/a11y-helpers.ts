import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { settle } from './fixtures.ts';

/** WCAG 2.2 AA (SPEC 14): contrast, names, labels, landmarks, structure – checked by axe-core. */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  await settle(page);
  // Measure contrast at rest, not in the middle of a fade-in (e.g. the owl overlay): jump to the
  // end of every running animation. A cancelled animation (re-rendered element) is fine, too.
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((animation) => {
        try {
          animation.finish();
        } catch {
          // Infinite animations cannot be finished; there are none in the app.
        }
        return animation.finished.catch(() => undefined);
      }),
    ).then(() => undefined),
  );
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  const problems = result.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} – ${violation.nodes
        .slice(0, 3)
        .map((node) => `${node.target.join(' ')} (${node.failureSummary ?? ''})`)
        .join(', ')}`,
  );
  expect(problems, label).toEqual([]);
}
