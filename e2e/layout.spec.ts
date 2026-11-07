/**
 * Layout at many screen widths (v0.6, SPEC 14: responsive from 320 px to desktop): no page
 * scrolls sideways and no text sticks out of its box – in German and English, with long
 * names and owls in many states (loan owl, sick owl with all buttons, chicks to give away).
 */
import { expect, type Page } from '@playwright/test';
import { test } from './fixtures.ts';
import { borrowViaUi, registerViaUi, uniqueName } from './account-helpers.ts';
import { hatchChicks, makeSick, setGold } from './db-helpers.ts';

const WIDTHS = [320, 360, 390, 768, 1024, 1280, 1440, 1920] as const;

const PUBLIC_PAGES = ['/', '/konto-erstellen', '/hilfe', '/datenschutz', '/impressum'] as const;
const APP_PAGES = [
  '/willkommen',
  '/app',
  '/app/briefe',
  '/app/eulen',
  '/app/finanzen',
  '/app/menagerie',
  '/app/adressbuch',
  '/app/karte',
  '/app/einstellungen',
] as const;

/** Everything that sticks out sideways: of the page, or of the box it is drawn in. */
async function overflows(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const problems: string[] = [];
    if (document.documentElement.scrollWidth > width + 1)
      problems.push(`page is ${document.documentElement.scrollWidth}px wide (window ${width}px)`);
    const describe = (element: Element): string => {
      const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const classes = element.getAttribute('class') ?? '';
      return `<${element.tagName.toLowerCase()} class="${classes}"> „${text}“`;
    };
    /** Inside a box that clips its content (the map, visually hidden texts). */
    const clipped = (element: Element): boolean => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.overflowX !== 'visible' || style.clip !== 'auto' || style.clipPath !== 'none')
          return true;
      }
      return false;
    };
    for (const element of document.querySelectorAll('body *')) {
      if (element instanceof SVGElement && !(element instanceof SVGSVGElement)) continue;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const box = element.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      if ((box.right > width + 1 || box.left < -1) && !clipped(element))
        problems.push(`outside the window: ${describe(element)} (${box.left}–${box.right})`);
      if (
        element instanceof HTMLElement &&
        style.overflowX === 'visible' &&
        style.display !== 'inline' &&
        element.clientWidth > 0 &&
        element.scrollWidth > element.clientWidth + 1 &&
        !clipped(element)
      )
        problems.push(
          `sticks out of its box: ${describe(element)} (${element.scrollWidth} > ${element.clientWidth})`,
        );
    }
    return problems;
  });
}

async function checkPages(
  page: Page,
  paths: readonly string[],
  language: string,
): Promise<string[]> {
  const found: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      for (const problem of await overflows(page))
        found.push(`${language} ${width}px ${path}: ${problem}`);
    }
  }
  return found;
}

test.describe('Layout in vielen Breiten (v0.6, SPEC 14)', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName === 'chromium' && isMobile,
    'Chromium läuft schon am Desktop',
  );
  test.setTimeout(240_000);

  test('öffentliche Seiten, Deutsch und Englisch', async ({ page }) => {
    const found = await checkPages(page, PUBLIC_PAGES, 'de');
    await page.goto('/');
    await page.getByRole('button', { name: 'Switch to English' }).click();
    found.push(...(await checkPages(page, PUBLIC_PAGES, 'en')));
    expect(found).toEqual([]);
  });

  test('angemeldete Seiten mit langen Namen, Deutsch und Englisch', async ({ page }) => {
    const me = await registerViaUi(page, { name: uniqueName('Wilhelminaa') });
    setGold(me.name, 2000);
    await borrowViaUi(page);
    await page.goto('/app/menagerie');
    await page.getByRole('button', { name: 'Südliche Weißgesichtseule kaufen' }).click();
    await page.getByLabel('Name (2–20 Zeichen)').fill('Hermenegildisgunda');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('heading', { name: 'Hermenegildisgunda' })).toBeVisible();
    await page.goto('/app/menagerie');
    await page.getByRole('button', { name: 'Riesenfischuhu kaufen' }).click();
    await page.getByLabel('Name (2–20 Zeichen)').fill('Fischers Fritz Fisch');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('heading', { name: 'Fischers Fritz Fisch' })).toBeVisible();
    makeSick(me.name);
    hatchChicks(me.name, 'suedliche-weissgesichtseule', 3);
    const found = await checkPages(page, APP_PAGES, 'de');
    await page.goto('/app/einstellungen');
    await page.getByRole('button', { name: 'Switch to English' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    found.push(...(await checkPages(page, APP_PAGES, 'en')));
    expect(found).toEqual([]);
  });
});
