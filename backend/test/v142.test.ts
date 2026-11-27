/**
 * Version 1.4.2 (server side): owls of players without a contact to people never get bored
 * (SPEC 9.2.9), the second look of owls of the same species (9.2.6), the free space barrier for
 * the database (13 item 14), Tor-only instances (16.6) and migration 0027.
 */
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { BOREDOM, STORAGE, TIME } from '@posteulen/shared/constants.ts';
import { loadConfig } from '../src/config.ts';
import { openDatabase } from '../src/db/database.ts';
import { loadMigrations, migrate } from '../src/db/migrate.ts';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import { generateCaddyfile } from '../src/ops/caddyfile.ts';
import { nextStorage, validLimits } from '../src/ops/storage.ts';
import { boredomDay } from '../src/owls/boredom.ts';
import { tempDir } from './helpers.ts';
import {
  ADMIN_ORIGIN,
  Agent,
  buyOwl,
  couple,
  HAMBURG,
  person,
  setGold,
  testApp,
  USER_ORIGIN,
  withoutBots,
  type Person,
  type SentPush,
  type TestApp,
} from './auth-helpers.ts';

const GB = 1024 ** 3;

let app: TestApp & { pushes: SentPush[] };
let anna: Person;
let ben: Person;

beforeEach(async () => {
  app = await testApp();
  anna = await person(app, 'Anna');
  ben = await person(app, 'Ben', HAMBURG);
  withoutBots(app);
});
afterEach(async () => {
  await app.close();
});

const now = () => app.clock.now;
const run = <T>(work: (after: (job: () => void) => void) => T): T => {
  const jobs: (() => void)[] = [];
  const result = app.db.transaction(() => work((job) => jobs.push(job)));
  for (const job of jobs) job();
  return result;
};
const days = (count: number, from = now()) => {
  for (let day = 1; day <= count; day++)
    run((after) => boredomDay(app.ctx, from + day * TIME.DAY, after));
};

async function adminAgent(): Promise<Agent> {
  const password = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
  const admin = new Agent(app.adminApi, ADMIN_ORIGIN);
  await client.ready();
  const start = client.startLogin(password);
  const first = await admin.json<{ attemptId: string; loginResponse: string }>(
    'POST',
    '/api/login/start',
    { startLoginRequest: start.request },
  );
  const result = client.finishLogin(password, start.state, first.body.loginResponse)!;
  await admin.json('POST', '/api/login/finish', {
    attemptId: first.body.attemptId,
    finishLoginRequest: result.finishRequest,
  });
  app.db.run('UPDATE admin SET must_change_password = 0');
  return admin;
}

describe('no boredom without a contact to people (v1.4.2, SPEC 9.2.9)', () => {
  it('never counts while the player has had no contact with a person', async () => {
    setGold(app, anna, 500);
    await buyOwl(app, anna, 'waldkauz', 'Eins');
    await buyOwl(app, anna, 'waldkauz', 'Zwei');
    days(BOREDOM.BORED_AFTER_DAYS + BOREDOM.ESCAPE_AFTER_DAYS + 5);
    const owls = app.db.all<{ idle_ms: number; bored_at: number | null }>(
      'SELECT idle_ms, bored_at FROM owls WHERE owner_id = ?',
      anna.id,
    );
    expect(owls).toEqual([
      { idle_ms: 0, bored_at: null },
      { idle_ms: 0, bored_at: null },
    ]);
  });

  it('starts from nothing with the first confirmed contact to a person', async () => {
    setGold(app, anna, 500);
    const owl = await buyOwl(app, anna, 'waldkauz', 'Eins');
    // Some idle time from before (e.g. an older version) – the first contact clears it.
    app.db.run('UPDATE owls SET idle_ms = ?, bored_at = 5 WHERE id = ?', 30 * TIME.DAY, owl);
    expect(app.db.get('SELECT human_contact_at FROM users WHERE id = ?', anna.id)).toEqual({
      human_contact_at: null,
    });
    await couple(anna, ben);
    expect(
      app.db.get<{ human_contact_at: number }>(
        'SELECT human_contact_at FROM users WHERE id = ?',
        anna.id,
      )?.human_contact_at,
    ).toBe(now());
    expect(app.db.get('SELECT idle_ms, bored_at FROM owls WHERE id = ?', owl)).toEqual({
      idle_ms: 0,
      bored_at: null,
    });
    days(BOREDOM.BORED_AFTER_DAYS - 1);
    expect(app.db.get('SELECT bored_at FROM owls WHERE id = ?', owl)).toEqual({ bored_at: null });
    days(2, now() + (BOREDOM.BORED_AFTER_DAYS - 1) * TIME.DAY);
    expect(
      app.db.get<{ bored_at: number | null }>('SELECT bored_at FROM owls WHERE id = ?', owl)
        ?.bored_at,
    ).not.toBeNull();
  });
});

describe('the second look (v1.4.2, SPEC 9.2.6)', () => {
  it('gives every second owl of a species the second pictures and keeps it', async () => {
    setGold(app, anna, 2000);
    const first = await buyOwl(app, anna, 'waldkauz', 'Eins');
    const second = await buyOwl(app, anna, 'waldkauz', 'Zwei');
    const other = await buyOwl(app, anna, 'schleiereule', 'Drei');
    const third = await buyOwl(app, anna, 'waldkauz', 'Vier');
    const list = await anna.agent.json<{ owls: { id: string; second: boolean }[] }>(
      'GET',
      '/api/owls',
    );
    const second_ = (id: string) => list.body.owls.find((owl) => owl.id === id)?.second;
    expect([second_(first), second_(second), second_(other), second_(third)]).toEqual([
      false,
      true,
      false,
      false,
    ]);
    // Two leave: the one left keeps its second look; the next one takes the rarer look.
    app.db.run('DELETE FROM owls WHERE id IN (?, ?)', first, third);
    const fifth = await buyOwl(app, anna, 'waldkauz', 'Fünf');
    const sixth = await buyOwl(app, anna, 'waldkauz', 'Sechs');
    const look = (id: string) =>
      app.db.get<{ look: number }>('SELECT look FROM owls WHERE id = ?', id)?.look;
    expect([look(second), look(fifth), look(sixth)]).toEqual([1, 0, 0]);
  });

  it('never gives the phoenix a second look', async () => {
    setGold(app, anna, 5000);
    await buyOwl(app, anna, 'phoenix', 'Feuer');
    await buyOwl(app, anna, 'phoenix', 'Flamme');
    expect(
      app.db.all('SELECT look FROM owls WHERE owner_id = ? ORDER BY created_at', anna.id),
    ).toEqual([{ look: 0 }, { look: 0 }]);
  });
});

describe('free space for the database (v1.4.2, SPEC 13 item 14)', () => {
  const limits = { blockGb: STORAGE.BLOCK_GB, warnGb: STORAGE.WARN_GB };

  it('blocks at the barrier and lets go only above the warning value', () => {
    const fine = { full: false, low: false };
    expect(nextStorage(fine, 10 * GB, limits)).toEqual({ flags: fine, changes: [] });
    expect(nextStorage(fine, 4 * GB, limits)).toEqual({
      flags: { full: false, low: true },
      changes: ['low'],
    });
    expect(nextStorage({ full: false, low: true }, 3 * GB, limits)).toEqual({
      flags: { full: true, low: true },
      changes: ['full'],
    });
    // Between the two values it stays blocked …
    expect(nextStorage({ full: true, low: true }, 3.5 * GB, limits).flags.full).toBe(true);
    // … and above the warning value everything is as before.
    expect(nextStorage({ full: true, low: true }, 4.5 * GB, limits)).toEqual({
      flags: fine,
      changes: ['recovered'],
    });
    expect(nextStorage(fine, null, limits)).toEqual({ flags: fine, changes: [] });
    expect(validLimits({ blockGb: 3, warnGb: 4 })).toBe(true);
    expect(validLimits({ blockGb: 4, warnGb: 4 })).toBe(false);
    expect(validLimits({ blockGb: 0.25, warnGb: 4 })).toBe(false);
    expect(validLimits({ blockGb: 2.5, warnGb: 3.5 })).toBe(true);
  });

  it('stops letters and feedback, makes open registration need a code and shows the banner', async () => {
    await couple(anna, ben);
    setGold(app, anna, 500);
    const owl = await buyOwl(app, anna, 'waldkauz', 'Waldi');
    app.db.run('UPDATE owls SET energy = 430 WHERE id = ?', owl);
    app.disk.free = 2 * GB;
    app.clock.now += TIME.HOUR;
    const banners = await anna.agent.json<{ storageFull: boolean }>('GET', '/api/banners');
    expect(banners.body.storageFull).toBe(true);
    const prepared = await anna.agent.json('POST', '/api/letters/prepare', {
      recipients: [ben.id],
      parchment: 'small',
      owlId: owl,
    });
    expect(prepared.status).toBe(503);
    expect(prepared.body).toMatchObject({ code: 'storage_full' });
    expect(
      (await anna.agent.json('POST', '/api/feedback', { text: 'Hallo Admin' })).body,
    ).toMatchObject({ code: 'storage_full' });
    expect(
      (await new Agent(app.userApi, USER_ORIGIN).json('GET', '/api/registration')).body,
    ).toEqual({ mode: 'invite' });
    const log = app.db.all<{ severity: string; component: string }>(
      'SELECT severity, component FROM error_log ORDER BY id',
    );
    expect(log).toEqual([
      { severity: 'warning', component: 'Speicherplatz' },
      { severity: 'error', component: 'Speicherplatz' },
    ]);

    // Between barrier and warning: still blocked. Above the warning: as before.
    app.disk.free = 3.8 * GB;
    app.clock.now += TIME.HOUR;
    expect(
      (await anna.agent.json<{ storageFull: boolean }>('GET', '/api/banners')).body.storageFull,
    ).toBe(true);
    app.disk.free = 5 * GB;
    app.clock.now += TIME.HOUR;
    expect(
      (await anna.agent.json<{ storageFull: boolean }>('GET', '/api/banners')).body.storageFull,
    ).toBe(false);
    expect(
      (await new Agent(app.userApi, USER_ORIGIN).json('GET', '/api/registration')).body,
    ).toEqual({ mode: 'open' });
    expect(
      (
        await anna.agent.json('POST', '/api/letters/prepare', {
          recipients: [ben.id],
          parchment: 'small',
          owlId: owl,
        })
      ).status,
    ).toBe(200);
  });

  it('measures at most once a minute', async () => {
    app.disk.free = 2 * GB;
    app.clock.now += STORAGE.CHECK_SECONDS * 1000;
    expect(
      (await anna.agent.json<{ storageFull: boolean }>('GET', '/api/banners')).body.storageFull,
    ).toBe(true);
    app.disk.free = 50 * GB;
    expect(
      (await anna.agent.json<{ storageFull: boolean }>('GET', '/api/banners')).body.storageFull,
    ).toBe(true);
    app.clock.now += STORAGE.CHECK_SECONDS * 1000;
    expect(
      (await anna.agent.json<{ storageFull: boolean }>('GET', '/api/banners')).body.storageFull,
    ).toBe(false);
  });

  it('lets the admin change both values (whole or half gigabytes, warning above barrier)', async () => {
    const admin = await adminAgent();
    const shown = await admin.json<Record<string, unknown>>('GET', '/api/settings/storage');
    expect(shown.body).toMatchObject({ blockGb: 3, warnGb: 4, full: false, low: false });
    expect(shown.body['freeBytes']).toBe(100 * GB);
    expect(
      (await admin.json('PUT', '/api/settings/storage', { blockGb: 4, warnGb: 3 })).body,
    ).toMatchObject({ code: 'storage_limits_invalid' });
    expect(
      (await admin.json('PUT', '/api/settings/storage', { blockGb: 1.3, warnGb: 3 })).status,
    ).toBe(400);
    app.disk.free = 9 * GB;
    const saved = await admin.json('PUT', '/api/settings/storage', { blockGb: 10, warnGb: 12 });
    expect(saved.body).toMatchObject({ blockGb: 10, warnGb: 12, full: true, low: true });
    expect((await admin.json('GET', '/api/settings/registration')).body).toEqual({
      mode: 'open',
      storageFull: true,
    });
  });
});

describe('Tor-only instance (v1.4.2, SPEC 16.6)', () => {
  const onion = (letter: string) => `${letter.repeat(56)}.onion`;

  it('needs no domain and refuses notifications and the Tor switch', async () => {
    const config = loadConfig({
      POSTEULEN_DATA_DIR: tempDir(),
      POSTEULEN_TOR_ONLY: '1',
      POSTEULEN_ONION: onion('a'),
    });
    expect(config.torOnly).toBe(true);
    expect(config.userOrigin).toBe('http://tor-only.invalid');
    expect(config.torOrigin).toBe(`http://${onion('a')}`);
    expect(() => loadConfig({ POSTEULEN_DATA_DIR: tempDir() })).toThrow();

    const tor = await testApp({ env: { POSTEULEN_TOR_ONLY: '1' } });
    try {
      const someone = await person(tor, 'Torben');
      expect((await someone.agent.json('GET', '/api/edition')).body).toEqual({ torOnly: true });
      expect((await someone.agent.json('GET', '/api/push/key')).status).toBe(404);
      expect(
        (await someone.agent.json('PUT', '/api/push/subscription', { endpoint: 'x' })).status,
      ).toBe(404);
      const links = await someone.agent.json<{ links: Record<string, string | null> }>(
        'GET',
        '/api/instance',
      );
      expect(links.body.links).toMatchObject({ web: null, admin: null, bots: null });
      expect(tor.db.get("SELECT value FROM settings WHERE key = 'tor_enabled'")).toEqual({
        value: '1',
      });
    } finally {
      await tor.close();
    }
    expect((await anna.agent.json('GET', '/api/edition')).body).toEqual({ torOnly: false });
  });

  it('writes a Caddyfile with only the three onion sites', () => {
    const base = {
      domain: '',
      torOnly: true,
      testMode: false,
      webRoot: '/opt/posteulen/current/web/dist',
      adminRoot: '/opt/posteulen/current/admin/dist',
      botsRoot: '/opt/posteulen/current/bots/dist',
      localDir: '/etc/posteulen/local',
      userPort: 3001,
      adminPort: 3002,
      botsPort: 3003,
    };
    const file = generateCaddyfile({
      ...base,
      onion: { host: onion('a'), listenPort: 3005, apiPort: 3004, active: true },
      adminOnion: { host: onion('b'), listenPort: 3006, apiPort: 3008 },
      botsOnion: { host: onion('c'), listenPort: 3007, apiPort: 3009 },
    });
    expect(file).toContain('auto_https off');
    expect(file).not.toContain('Onion-Location');
    expect(file).not.toContain('Strict-Transport-Security');
    expect(file.match(/^http:\/\/[a-z]{56}\.onion:300[567] \{$/gm)).toHaveLength(3);
    expect(file).not.toMatch(/^(admin|bots|www)\./m);
    expect(() => generateCaddyfile({ ...base, onion: undefined })).toThrow();
  });

  it('refuses to switch Tor off in the admin panel', async () => {
    const tor = await testApp({ env: { POSTEULEN_TOR_ONLY: '1', POSTEULEN_ONION: onion('a') } });
    try {
      const password = await setInitialAdminPassword(tor.db, tor.secrets.opaqueServerSetup);
      const admin = new Agent(tor.adminApi, ADMIN_ORIGIN);
      // In the test the admin API keeps its regular origin (the domain of the test set-up).
      await client.ready();
      const start = client.startLogin(password);
      const first = await admin.json<{ attemptId: string; loginResponse: string }>(
        'POST',
        '/api/login/start',
        { startLoginRequest: start.request },
      );
      const result = client.finishLogin(password, start.state, first.body.loginResponse)!;
      await admin.json('POST', '/api/login/finish', {
        attemptId: first.body.attemptId,
        finishLoginRequest: result.finishRequest,
      });
      tor.db.run('UPDATE admin SET must_change_password = 0');
      expect((await admin.json('GET', '/api/settings/tor')).body).toMatchObject({ torOnly: true });
      expect((await admin.json('PUT', '/api/settings/tor', { enabled: false })).body).toMatchObject(
        { code: 'tor_only' },
      );
    } finally {
      await tor.close();
    }
  });
});

describe('migration 0027 (v1.4.2)', () => {
  it('finds earlier contacts to people, clears boredom without them and spreads the looks', () => {
    const db = openDatabase(path.join(tempDir(), 'db.sqlite'));
    const migrations = loadMigrations();
    migrate(db, migrations.slice(0, 26));
    const user = (id: string) =>
      db.run(
        `INSERT INTO users (id, name_display, name_key, created_on, opaque_record, ed25519_pub, x25519_pub,
                            key_format, wrapped_master_key, private_keys, home_lat, home_lon, home_changed_on,
                            gold, last_active_date)
         VALUES (?, ?, ?, '2026-01-01', 'x', ?, ?, 1, ?, ?, 5252, 1340, '2026-01-01', 30, '2026-11-01')`,
        id,
        id,
        id,
        new Uint8Array(32),
        new Uint8Array(32),
        new Uint8Array(1),
        new Uint8Array(1),
      );
    for (const id of ['a', 'b', 'c', 'd']) user(id);
    db.run("INSERT INTO contacts (user_lo, user_hi, since) VALUES ('a', 'b', 100)");
    // c once wrote to d (their contact is gone); nobody knows anybody else.
    db.run(
      `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, plaintext,
                            status, owl_name, owl_species)
       VALUES ('l', 'c', 'd', 'letter', 'small', 200, 300, 'x', 'delivered', 'Eule', 'waldkauz')`,
    );
    user('e');
    const owl = (id: string, owner: string, species: string, since: string) =>
      db.run(
        `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at,
                           idle_ms, bored_at)
         VALUES (?, ?, 'own', ?, 'f', ?, 10, 0, ?, 0, 999, 5)`,
        id,
        owner,
        species,
        id,
        since,
      );
    owl('a1', 'a', 'waldkauz', '2026-01-01');
    owl('a2', 'a', 'waldkauz', '2026-02-01');
    owl('a3', 'a', 'waldkauz', '2026-03-01');
    owl('a4', 'a', 'schleiereule', '2026-01-15');
    owl('ap', 'a', 'phoenix', '2026-04-01');
    owl('aq', 'a', 'phoenix', '2026-05-01');
    owl('e1', 'e', 'waldkauz', '2026-01-01');
    migrate(db, migrations);
    expect(db.all('SELECT id, human_contact_at FROM users ORDER BY id')).toEqual([
      { id: 'a', human_contact_at: 100 },
      { id: 'b', human_contact_at: 100 },
      { id: 'c', human_contact_at: 200 },
      { id: 'd', human_contact_at: 200 },
      { id: 'e', human_contact_at: null },
    ]);
    expect(db.all('SELECT id, look, idle_ms, bored_at FROM owls ORDER BY id')).toEqual([
      { id: 'a1', look: 0, idle_ms: 999, bored_at: 5 },
      { id: 'a2', look: 1, idle_ms: 999, bored_at: 5 },
      { id: 'a3', look: 0, idle_ms: 999, bored_at: 5 },
      { id: 'a4', look: 0, idle_ms: 999, bored_at: 5 },
      { id: 'ap', look: 0, idle_ms: 999, bored_at: 5 },
      { id: 'aq', look: 0, idle_ms: 999, bored_at: 5 },
      { id: 'e1', look: 0, idle_ms: 0, bored_at: null },
    ]);
    db.close();
  });
});
