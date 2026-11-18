/**
 * Version 1.2.1: the server dashboard of the admin panel (measurements of posteulen-stats, CPU
 * and RAM over 7 days, the disk with the game data) and the longer character text of bots in
 * the control centre (16 000 characters).
 */
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CENTRAL_BOTS, TIME } from '@posteulen/shared/constants.ts';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import {
  averageLoad,
  diskPercent,
  parseSamples,
  type LoadSample,
} from '../src/admin/server-load.ts';
import { ADMIN_ORIGIN, Agent, BOTS_ORIGIN, PARIS, testApp, type TestApp } from './auth-helpers.ts';

let app: TestApp;

beforeEach(async () => {
  app = await testApp();
});

afterEach(async () => {
  await app.close();
});

async function panelAgent(panel: 'admin' | 'bots'): Promise<Agent> {
  const table = panel === 'admin' ? 'admin' : 'bots_admin';
  const password = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup, table);
  const agent =
    panel === 'admin' ? new Agent(app.adminApi, ADMIN_ORIGIN) : new Agent(app.botsApi, BOTS_ORIGIN);
  await client.ready();
  const start = client.startLogin(password);
  const first = await agent.json<{ attemptId: string; loginResponse: string }>(
    'POST',
    '/api/login/start',
    { startLoginRequest: start.request },
  );
  const result = client.finishLogin(password, start.state, first.body.loginResponse)!;
  await agent.json('POST', '/api/login/finish', {
    attemptId: first.body.attemptId,
    finishLoginRequest: result.finishRequest,
  });
  app.db.run(`UPDATE ${table} SET must_change_password = 0`);
  return agent;
}

/** One line of the measurement file as posteulen-server-load writes it. */
const line = (at: number, total: number, idle: number, memTotal: number, available: number) =>
  `${Math.floor(at / 1000)} ${total} ${idle} ${memTotal} ${available}\n`;

describe('server dashboard: measurements (SPEC 13 item 13)', () => {
  const now = Date.UTC(2026, 10, 18, 12);
  const sample = (minutesAgo: number, total: number, idle: number, used = 0.5): LoadSample => ({
    at: now - minutesAgo * TIME.MINUTE,
    cpuTotal: total,
    cpuIdle: idle,
    memTotal: 1000,
    memAvailable: 1000 * (1 - used),
  });

  it('reads the lines of the file and skips anything malformed', () => {
    const text = [
      line(now - 20 * TIME.MINUTE, 1000, 900, 4000, 1000),
      'Unsinn',
      '1 2 3 4',
      '1 2 3 4 -5',
      '1e3 2 3 4 5',
      line(now - 30 * TIME.MINUTE, 500, 450, 4000, 3000),
      '',
    ].join('\n');
    const samples = parseSamples(text);
    expect(samples.map((entry) => entry.cpuTotal)).toEqual([500, 1000]);
    expect(samples[0]).toEqual({
      at: now - 30 * TIME.MINUTE,
      cpuTotal: 500,
      cpuIdle: 450,
      memTotal: 4000,
      memAvailable: 3000,
    });
  });

  it('averages CPU over all counter increases and RAM over all measurements of 7 days', () => {
    const samples = [
      // Older than 7 days: ignored.
      sample(8 * 24 * 60, 0, 0, 1),
      sample(60, 1000, 1000, 0.2),
      // 1000 more ticks, 750 of them idle: 25 % busy.
      sample(50, 2000, 1750, 0.4),
      // A reboot: the counters start again – this interval does not count.
      sample(40, 100, 90, 0.6),
      // 100 more, all busy.
      sample(30, 200, 90, 0.8),
    ];
    const load = averageLoad(samples, now);
    expect(load.cpu).toBeCloseTo(((250 + 100) / 1100) * 100, 6);
    expect(load.ram).toBeCloseTo(50, 6);
    expect(load.since).toBe(now - 60 * TIME.MINUTE);
    expect(load.measuredAt).toBe(now - 30 * TIME.MINUTE);
  });

  it('has no values without measurements and no CPU value with a single one', () => {
    expect(averageLoad([], now)).toEqual({ cpu: null, ram: null, since: null, measuredAt: null });
    const single = averageLoad([sample(10, 100, 50, 0.25)], now);
    expect(single.cpu).toBeNull();
    expect(single.ram).toBeCloseTo(25, 6);
    // Available memory above the total (never in reality) does not give negative values.
    expect(averageLoad([{ ...sample(10, 1, 1), memAvailable: 5000 }], now).ram).toBe(0);
  });

  it('counts the disk like df: used of used plus available to normal users', () => {
    expect(diskPercent({ blocks: 1000, bfree: 300, bavail: 200 })).toBeCloseTo(77.78, 2);
    expect(diskPercent({ blocks: 1000, bfree: 1000, bavail: 1000 })).toBe(0);
    expect(diskPercent({ blocks: 0, bfree: 0, bavail: 0 })).toBeNull();
  });

  it('shows the values in the admin panel, rough and without player data', async () => {
    const admin = await panelAgent('admin');
    const empty = await admin.json<Record<string, number | null>>('GET', '/api/server-load');
    expect(empty.status).toBe(200);
    expect(empty.body).toMatchObject({ cpu: null, ram: null, since: null, measuredAt: null });
    expect(empty.body['disk']).toBeGreaterThanOrEqual(0);
    expect(empty.body['disk']).toBeLessThanOrEqual(100);

    const at = app.clock.now;
    fs.writeFileSync(
      app.config.serverLoadFile,
      line(at - 20 * TIME.MINUTE, 1000, 800, 2000, 1500) +
        line(at - 10 * TIME.MINUTE, 2000, 1600, 2000, 500),
    );
    const filled = await admin.json<Record<string, number | null>>('GET', '/api/server-load');
    expect(filled.body).toMatchObject({
      cpu: 20,
      ram: 50,
      since: at - 20 * TIME.MINUTE,
      measuredAt: at - 10 * TIME.MINUTE,
    });
    expect(Object.keys(filled.body).sort()).toEqual(['cpu', 'disk', 'measuredAt', 'ram', 'since']);
    // Not for the control centre or players.
    expect(
      (await new Agent(app.adminApi, ADMIN_ORIGIN).json('GET', '/api/server-load')).status,
    ).toBe(401);
  });
});

describe('control centre: longer character text (SPEC 10.6)', () => {
  it('takes up to 16 000 characters, even with many special characters, and not one more', async () => {
    const centre = await panelAgent('bots');
    const created = await centre.json<{ id: string }>('POST', '/api/bots', {
      name: 'Langschreiber',
    });
    expect(created.status).toBe(200);
    const settings = (character: string) =>
      centre.json('PUT', `/api/bots/${created.body.id}/settings`, {
        name: 'Langschreiber',
        character,
        home: PARIS,
        owlMode: 'loan',
        owlSpecies: null,
        owlName: null,
        motivation: 10,
        restHours: 24,
        playerOwls: false,
      });
    expect(CENTRAL_BOTS.CHARACTER_MAX_CHARS).toBe(16_000);
    // Three bytes per character (€) and quotes that JSON escapes still fit the request limit.
    const long = '€"'.repeat(CENTRAL_BOTS.CHARACTER_MAX_CHARS / 2);
    const saved = await settings(long);
    expect(saved.status, JSON.stringify(saved.body).slice(0, 200)).toBe(200);
    expect(saved.body).toMatchObject({ character: long });
    expect((await settings(`${long}x`)).status).toBe(400);
  });
});
