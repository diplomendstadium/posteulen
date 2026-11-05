import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 18080;
const ADMIN_PORT = 18081;

export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const ADMIN_URL = `http://localhost:${ADMIN_PORT}`;

const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };
const desktop = { viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: WEB_URL,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'], ...mobile } },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], ...desktop } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'], ...desktop } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 15'], ...mobile, isMobile: true } },
  ],
  webServer: {
    command: 'node backend/src/dev/preview.ts',
    url: `${WEB_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      POSTEULEN_PREVIEW_WEB_PORT: String(WEB_PORT),
      POSTEULEN_PREVIEW_ADMIN_PORT: String(ADMIN_PORT),
      POSTEULEN_USER_PORT: '13001',
      POSTEULEN_ADMIN_PORT: '13002',
      POSTEULEN_DATA_DIR: path.join(os.tmpdir(), `posteulen-e2e-${process.pid}`),
    },
  },
});
