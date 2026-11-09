import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// One data folder per run; workers inherit it through the environment.
process.env['POSTEULEN_E2E_DIR'] ??= path.join(os.tmpdir(), `posteulen-e2e-${Date.now()}`);
const RUN_DIR = process.env['POSTEULEN_E2E_DIR'];

/** Screenshots for the report or the README pictures (only on request). */
const SHOTS = Boolean(
  process.env['POSTEULEN_SCREENSHOTS'] ?? process.env['POSTEULEN_README_SHOTS'],
);

const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };
const desktop = { viewport: { width: 1440, height: 900 } };

function preview(
  name: string,
  ports: [number, number, number, number, number, number],
  registration: string,
) {
  return {
    command: 'node backend/src/dev/preview.ts',
    url: `http://localhost:${ports[0]}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      POSTEULEN_PREVIEW_WEB_PORT: String(ports[0]),
      POSTEULEN_PREVIEW_ADMIN_PORT: String(ports[1]),
      POSTEULEN_USER_PORT: String(ports[2]),
      POSTEULEN_ADMIN_PORT: String(ports[3]),
      // v0.8: the bots control centre.
      POSTEULEN_PREVIEW_BOTS_PORT: String(ports[4]),
      POSTEULEN_BOTS_PORT: String(ports[5]),
      POSTEULEN_DATA_DIR: path.join(RUN_DIR, name),
      POSTEULEN_PREVIEW_REGISTRATION: registration,
      POSTEULEN_PREVIEW_RELAXED_LIMITS: '1',
      POSTEULEN_PREVIEW_FLIGHT_TIME_SCALE: '2000',
    },
  };
}

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:18080',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    serviceWorkers: 'allow',
  },
  // v0.7.1: two profiles in the normal run – Chromium on the desktop and WebKit on the phone
  // (iPhone). Chromium on the phone only for the screenshots and README pictures on request.
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], ...desktop } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 15'], ...mobile, isMobile: true } },
    ...(SHOTS ? [{ name: 'chromium-mobile', use: { ...devices['Pixel 7'], ...mobile } }] : []),
  ],
  webServer: [
    preview('main', [18080, 18081, 13001, 13002, 18082, 13003], 'open'),
    // Separate instance for admin tests: mode changes must not affect other tests.
    preview('admin', [18090, 18091, 13011, 13012, 18092, 13013], 'closed'),
  ],
});
