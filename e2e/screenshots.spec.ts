import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { VERSION } from '../shared/src/version.ts';
import { ADMIN_URL, settle, test } from './fixtures.ts';

/** Screenshots for the stage report (SPEC 14, 17.4): phone, desktop, one in grayscale. */
const STAGE = VERSION.replace(/^.*-stufe\./, 'stufe-');
const OUT = path.resolve('docs/screenshots', STAGE);

const SCREENS = [
  { name: 'start', url: '/' },
  { name: 'uebersicht', url: '/app' },
  { name: 'bereich', url: '/app/briefe' },
  { name: 'verwaltung', url: ADMIN_URL },
];

test.describe('Screenshots', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Screenshots für den Bericht nur aus Chromium',
  );

  for (const screen of SCREENS) {
    test(screen.name, async ({ page }, testInfo) => {
      const device = testInfo.project.name.includes('mobile') ? 'handy' : 'desktop';
      await page.goto(screen.url);
      await settle(page);
      fs.mkdirSync(OUT, { recursive: true });
      const file = path.join(OUT, `${screen.name}-${device}.png`);
      const image = await page.screenshot({ fullPage: true });
      fs.writeFileSync(file, image);
      if (screen.name === 'uebersicht' || screen.name === 'start') {
        await sharp(image)
          .grayscale()
          .png()
          .toFile(path.join(OUT, `${screen.name}-${device}-graustufen.png`));
      }
    });
  }
});
