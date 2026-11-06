import fs from 'node:fs';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import sharp from 'sharp';
import { VERSION } from '../shared/src/version.ts';
import { settle } from './fixtures.ts';
import { expectAccessible } from './a11y-helpers.ts';

/** Screenshots for the stage report (SPEC 14, 17.4): phone, desktop, some in grayscale. */
const STAGE = VERSION.replace(/^.*-stufe\./, 'stufe-');
export const SCREENSHOT_DIR = path.resolve('docs/screenshots', STAGE);

export async function shoot(
  page: Page,
  info: TestInfo,
  name: string,
  grayscale = false,
): Promise<void> {
  const device = info.project.name.includes('mobile') ? 'handy' : 'desktop';
  await settle(page);
  // Every screenshot state is also checked for accessibility (SPEC 14, stage 6).
  await expectAccessible(page, `${name} (${device})`);
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const image = await page.screenshot({ fullPage: true });
  fs.writeFileSync(path.join(SCREENSHOT_DIR, `${name}-${device}.png`), image);
  if (grayscale) {
    await sharp(image)
      .grayscale()
      .png()
      .toFile(path.join(SCREENSHOT_DIR, `${name}-${device}-graustufen.png`));
  }
}
