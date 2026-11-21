/**
 * Version 1.3.0 (server side): account binding of web app requests (SPEC 5.5), the rescue
 * centre (8.13, 9.8), statistics (8.10), the rule on giving gold and owls (9.1.5), the 🌍 badge
 * (9.2.1), ASCII mode (8.10) and the migration of sick and treated owls.
 */
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GOLD, RESCUE, TIME } from '@posteulen/shared/constants.ts';
import { utcDay } from '../src/security/ids.ts';
import { admit } from '../src/rescue/service.ts';
import { announceAllGlobetrotters } from '../src/owls/globe.ts';
import { backfillStats } from '../src/accounts/stats.ts';
import { openDatabase } from '../src/db/database.ts';
import { loadMigrations, migrate } from '../src/db/migrate.ts';
import { tempDir } from './helpers.ts';
import {
  advanceTo,
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

/** A request with Ben's cookie that expects a certain account (header or SSE query). */
function asBen(method: 'GET' | 'POST', url: string, expected: string | null, body?: unknown) {
  const headers: Record<string, string> = {
    origin: USER_ORIGIN,
    'x-posteulen': '1',
    cookie: ben.agent.cookie ?? '',
  };
  if (expected) headers['x-posteulen-account'] = expected;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return ben.agent.api.inject({
    method,
    url,
    headers,
    remoteAddress: ben.agent.ip,
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
  });
}

describe('account binding (SPEC 5.5)', () => {
  it('a request of account A arriving with the cookie of B is refused without effect', async () => {
    await couple(anna, ben);
    // Anna's old tab reports a key warning – but the cookie belongs to Ben by now.
    const refused = await asBen('POST', `/api/contacts/${anna.id}/key-warning`, anna.id, {});
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'account_mismatch' });
    const contacts = await ben.agent.json<{ contacts: { keyWarning: boolean }[] }>(
      'GET',
      '/api/contacts',
    );
    expect(contacts.body.contacts[0]?.keyWarning).toBe(false);
  });

  it('a stale logout of A does not end the session of B', async () => {
    const refused = await asBen('POST', '/api/logout', anna.id, {});
    expect(refused.statusCode).toBe(409);
    expect((await ben.agent.json('GET', '/api/sync')).status).toBe(200);
  });

  it('the expected account is accepted, and requests without one still work', async () => {
    expect((await asBen('GET', '/api/sync', ben.id)).statusCode).toBe(200);
    expect((await asBen('GET', '/api/sync', null)).statusCode).toBe(200);
  });

  it('the live connection checks the account in its query', async () => {
    const refused = await asBen('GET', `/api/events?account=${anna.id}`, null);
    expect(refused.statusCode).toBe(409);
  });

  it('a refused request does not count as activity', async () => {
    app.db.run("UPDATE users SET last_active_date = '2000-01-01' WHERE id = ?", ben.id);
    await asBen('GET', '/api/sync', anna.id);
    const row = app.db.get<{ last_active_date: string }>(
      'SELECT last_active_date FROM users WHERE id = ?',
      ben.id,
    );
    expect(row?.last_active_date).toBe('2000-01-01');
  });
});

function runDaily(name: string, at: number): void {
  app.db.run('DELETE FROM scheduled_events WHERE type = ?', `daily:${name}`);
  app.db.run('DELETE FROM daily_job_runs WHERE job = ? AND day = ?', name, utcDay(at));
  app.ctx.queue.schedule(`daily:${name}`, name, at);
  advanceTo(app, at);
}

function setRandom(value: number | (() => number)): void {
  (app.ctx as { random: () => number }).random = typeof value === 'number' ? () => value : value;
}

function owlRow(id: string) {
  return app.db.get<{
    state: string;
    owner_id: string;
    name: string;
    sex: string;
    species: string;
  }>('SELECT state, owner_id, name, sex, species FROM owls WHERE id = ?', id);
}

async function systemTypes(who: Person): Promise<string[]> {
  const result = await who.agent.json<{ messages: { type: string }[] }>(
    'GET',
    '/api/system-messages',
  );
  return result.body.messages.map((message) => message.type);
}

interface RescueOwl {
  id: string;
  name: string;
  species: string;
  sex: string;
  progress: number;
  today: Record<string, boolean>;
  healed: boolean;
}

async function rescue(who: Person) {
  return (await who.agent.json<{ own: RescueOwl[]; wild: RescueOwl[] }>('GET', '/api/rescue')).body;
}

/** A sick own owl of Anna in the rescue centre that needs `needed` interactions. */
async function sickOwl(needed: number): Promise<string> {
  setGold(app, anna, 500);
  const id = await buyOwl(app, anna, 'waldkauz');
  const owl = app.db.get<import('../src/owls/model.ts').OwlRow>(
    'SELECT * FROM owls WHERE id = ?',
    id,
  )!;
  app.db.transaction(() => admit(app.ctx, owl, app.clock.now, () => undefined));
  app.db.run('UPDATE rescue_cases SET needed = ? WHERE owl_id = ?', needed, id);
  return id;
}

describe('rescue centre: own owls (SPEC 8.13, 9.8)', () => {
  it('the daily roll sends a sick owl to the rescue centre with 5–20 interactions needed', async () => {
    setGold(app, anna, 500);
    const id = await buyOwl(app, anna, 'waldkauz');
    app.db.run(
      'UPDATE owls SET owned_since = ? WHERE id = ?',
      utcDay(app.clock.now - 60 * TIME.DAY),
      id,
    );
    setRandom(0);
    runDaily('sickness', Date.UTC(2026, 10, 6, 3));
    expect(owlRow(id)?.state).toBe('sick');
    const rescueCase = app.db.get<{ needed: number; done: number }>(
      'SELECT needed, done FROM rescue_cases WHERE owl_id = ?',
      id,
    );
    expect(rescueCase).toEqual({ needed: RESCUE.OWN_MIN_CARE, done: 0 });
    expect(await systemTypes(anna)).toContain('owl_sick');
    // In the overview: in the rescue centre, no care there, 0 per cent.
    const list = await anna.agent.json<{
      owls: { id: string; rescue: unknown; actions: { care: boolean } }[];
    }>('GET', '/api/owls');
    expect(list.body.owls.find((owl) => owl.id === id)).toMatchObject({
      rescue: { progress: 0 },
      actions: { care: false },
    });
    expect((await anna.agent.json('POST', `/api/owls/${id}/pet`, {})).body).toMatchObject({
      code: 'owl_not_home',
    });
  });

  it('the phoenix never falls ill', async () => {
    setGold(app, anna, 2000);
    const id = await buyOwl(app, anna, 'phoenix');
    app.db.run(
      'UPDATE owls SET owned_since = ? WHERE id = ?',
      utcDay(app.clock.now - 60 * TIME.DAY),
      id,
    );
    setRandom(0);
    runDaily('sickness', Date.UTC(2026, 10, 6, 3));
    expect(owlRow(id)?.state).toBe('home');
  });

  it('each interaction once a day and counted once; petting as often as one likes', async () => {
    const id = await sickOwl(10);
    const act = (action: string) =>
      anna.agent.json<{ progress: number; counted: boolean; healed: boolean }>(
        'POST',
        `/api/rescue/own/${id}/${action}`,
        {},
      );
    expect((await act('medicine')).body).toEqual({ progress: 10, counted: true, healed: false });
    expect((await act('medicine')).body).toMatchObject({ code: 'rescue_done_today' });
    expect((await act('pet')).body).toMatchObject({ progress: 20, counted: true });
    expect((await act('pet')).body).toMatchObject({ progress: 20, counted: false });
    // Biscuit and snack cost what they always cost; medicine, petting and water are free.
    const before = app.db.get<{ gold: number }>(
      'SELECT gold FROM users WHERE id = ?',
      anna.id,
    )!.gold;
    await act('water');
    await act('feed');
    await act('snack');
    const after = app.db.get<{ gold: number }>(
      'SELECT gold FROM users WHERE id = ?',
      anna.id,
    )!.gold;
    expect(before - after).toBe(GOLD.FEED_PRICE + GOLD.SNACK_PRICE);
    expect((await rescue(anna)).own[0]).toMatchObject({ id, progress: 50 });
    // The next day everything counts again.
    advanceTo(app, app.clock.now + TIME.DAY);
    expect((await act('medicine')).body).toMatchObject({ progress: 60, counted: true });
  });

  it('at 100 per cent the owl is well and back home, with a system message', async () => {
    const id = await sickOwl(2);
    await anna.agent.json('POST', `/api/rescue/own/${id}/water`, {});
    const last = await anna.agent.json('POST', `/api/rescue/own/${id}/medicine`, {});
    expect(last.body).toEqual({ progress: 100, counted: true, healed: true });
    expect(owlRow(id)?.state).toBe('home');
    expect(app.db.get('SELECT 1 FROM rescue_cases WHERE owl_id = ?', id)).toBeUndefined();
    expect(await systemTypes(anna)).toContain('owl_healthy');
    expect((await rescue(anna)).own).toEqual([]);
  });

  it('nobody else can care for the owl', async () => {
    const id = await sickOwl(5);
    expect((await ben.agent.json('POST', `/api/rescue/own/${id}/pet`, {})).status).toBe(404);
  });
});

describe('rescue centre: wild owls (SPEC 8.13)', () => {
  it('three wild owls per account, never the phoenix or the Great Horned Owl, names suit the sex', async () => {
    setRandom(seeded());
    const wild = (await rescue(anna)).wild;
    expect(wild).toHaveLength(3);
    for (const owl of wild) {
      expect(['phoenix', 'virginiauhu']).not.toContain(owl.species);
      const { owlNames } = await import('@posteulen/shared/names-data.ts');
      expect(owlNames('de', owl.sex as 'f' | 'm')).toContain(owl.name);
      const row = app.db.get<{ needed: number; species: string }>(
        'SELECT needed, species FROM rescue_wild WHERE id = ?',
        owl.id,
      )!;
      const { speciesById } = await import('@posteulen/shared/game/owls.ts');
      const price = speciesById(row.species)!.price;
      expect(row.needed).toBeGreaterThanOrEqual(Math.round(price * 3 * 0.8));
      expect(row.needed).toBeLessThanOrEqual(Math.round(price * 3 * 1.2));
    }
    // Ben has his own three.
    expect((await rescue(ben)).wild.map((owl) => owl.id)).not.toContain(wild[0]!.id);
    expect((await rescue(anna)).wild.map((owl) => owl.id)).toEqual(wild.map((owl) => owl.id));
  });

  it('a healed wild owl joins as a post owl or flies off; a new one takes its place', async () => {
    const [first, second] = (await rescue(anna)).wild;
    app.db.run('UPDATE rescue_wild SET needed = 1 WHERE id IN (?, ?)', first!.id, second!.id);
    setRandom(0.2); // stays
    expect(
      (await anna.agent.json('POST', `/api/rescue/wild/${first!.id}/pet`, {})).body,
    ).toMatchObject({
      healed: true,
      progress: 100,
    });
    expect(
      (await anna.agent.json('POST', `/api/rescue/wild/${first!.id}/pet`, {})).body,
    ).toMatchObject({
      code: 'rescue_healed',
    });
    setRandom(0.7); // flies off
    await anna.agent.json('POST', `/api/rescue/wild/${second!.id}/water`, {});
    // Not healed yet: no release.
    const third = (await rescue(anna)).wild[2]!;
    expect(
      (await anna.agent.json('POST', `/api/rescue/wild/${third.id}/release`, {})).body,
    ).toMatchObject({
      code: 'rescue_not_healed',
    });
    const stays = await anna.agent.json<{ stays: boolean; owlId: string }>(
      'POST',
      `/api/rescue/wild/${first!.id}/release`,
      {},
    );
    expect(stays.body.stays).toBe(true);
    expect(owlRow(stays.body.owlId)).toMatchObject({
      state: 'home',
      owner_id: anna.id,
      name: first!.name,
      species: first!.species,
    });
    expect(await systemTypes(anna)).toContain('rescue_joined');
    const free = await anna.agent.json<{ stays: boolean; owlId: string | null }>(
      'POST',
      `/api/rescue/wild/${second!.id}/release`,
      {},
    );
    expect(free.body).toEqual({ stays: false, owlId: null });
    const now = (await rescue(anna)).wild;
    expect(now).toHaveLength(3);
    expect(now.map((owl) => owl.id)).not.toContain(first!.id);
    expect(now.map((owl) => owl.id)).not.toContain(second!.id);
  });

  it('a joining owl may go beyond the limit of 50 owls', async () => {
    const wild = (await rescue(anna)).wild[0]!;
    for (let i = 0; i < 50; i++) {
      app.db.run(
        `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at)
         VALUES (?, ?, 'own', 'waldkauz', 'm', 'X', 1, 1, '2026-01-01', 1)`,
        `owl${String(i).padStart(19, '0')}`,
        anna.id,
      );
    }
    app.db.run('UPDATE rescue_wild SET needed = 1 WHERE id = ?', wild.id);
    setRandom(0.1);
    await anna.agent.json('POST', `/api/rescue/wild/${wild.id}/pet`, {});
    expect(
      (await anna.agent.json<{ stays: boolean }>('POST', `/api/rescue/wild/${wild.id}/release`, {}))
        .body.stays,
    ).toBe(true);
    expect(
      app.db.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM owls WHERE owner_id = ? AND kind = 'own'",
        anna.id,
      )!.n,
    ).toBe(51);
  });
});

function seeded(): () => number {
  let state = 7;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe('statistics (SPEC 8.10)', () => {
  interface Stats {
    lettersSent: number;
    lettersReceived: number;
    daysSinceCreated: number;
    activeDays: number;
    activePercent: number;
    km: number;
    interactions: Record<string, number>;
    countedSince: string | null;
  }
  const stats = async (who: Person) =>
    (await who.agent.json<{ stats: Stats }>('GET', '/api/account/stats')).body.stats;

  it('counts days, active days and interactions by kind', async () => {
    expect(await stats(anna)).toMatchObject({
      daysSinceCreated: 1,
      activeDays: 1,
      activePercent: 100,
      countedSince: null,
    });
    setGold(app, anna, 500);
    const id = await buyOwl(app, anna, 'waldkauz');
    await anna.agent.json('POST', `/api/owls/${id}/pet`, {});
    await anna.agent.json('POST', `/api/owls/${id}/pet`, {});
    await anna.agent.json('POST', `/api/owls/${id}/water`, {});
    advanceTo(app, app.clock.now + 3 * TIME.DAY);
    await anna.agent.json('GET', '/api/sync');
    const later = await stats(anna);
    expect(later).toMatchObject({ daysSinceCreated: 4, activeDays: 2, activePercent: 50 });
    expect(later.interactions).toEqual({ medicine: 0, water: 1, pet: 2, feed: 0, snack: 0 });
  });

  it('counts letters by triggers, for every way a letter is written', async () => {
    // The Explainer Bear's first letter is already there (a letter from a bot counts as well).
    const before = await stats(ben);
    // A letter row of Anna to Ben, delivered later (as any flight does).
    const sentAt = app.clock.now;
    app.db.run(
      `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, status, owl_name, owl_species, plaintext)
       VALUES ('LLLLLLLLLLLLLLLLLLLLLL', ?, ?, 'letter', 'small', ?, ?, 'in_flight', 'Waldi', 'waldkauz', 'x')`,
      anna.id,
      ben.id,
      sentAt,
      sentAt + TIME.HOUR,
    );
    expect((await stats(anna)).lettersSent).toBe(1);
    expect((await stats(ben)).lettersReceived).toBe(before.lettersReceived);
    app.db.run("UPDATE letters SET status = 'delivered' WHERE id = 'LLLLLLLLLLLLLLLLLLLLLL'");
    expect((await stats(ben)).lettersReceived).toBe(before.lettersReceived + 1);
    const day = (who: Person) =>
      app.db.get<{ sent_human: number; received_human: number }>(
        'SELECT sent_human, received_human FROM activity_days WHERE user_id = ? AND day = ?',
        who.id,
        utcDay(sentAt),
      );
    expect(day(anna)?.sent_human).toBe(1);
    expect(day(ben)?.received_human).toBe(1);
  });
});

describe('giving gold and owls (SPEC 9.1.5)', () => {
  let strict: TestApp & { pushes: SentPush[] };
  let carla: Person;
  let dora: Person;
  beforeEach(async () => {
    strict = await testApp({ giftRule: true });
    carla = await person(strict, 'Carla');
    dora = await person(strict, 'Dora', HAMBURG);
    withoutBots(strict);
    await couple(carla, dora);
  });
  afterEach(async () => {
    await strict.close();
  });

  const profile = async (who: Person) =>
    (await who.agent.json<{ profile: { canGift: boolean } }>('GET', '/api/sync')).body.profile;
  const prepareGold = async (who: Person, to: Person, owlId: string) =>
    who.agent.json('POST', '/api/gold/prepare', {
      recipient: to.id,
      amount: 1,
      owlId,
      withCover: false,
    });

  function activity(who: Person, days: number, values: { sent?: boolean; received?: boolean }) {
    for (let index = 0; index < days; index++) {
      strict.db.run(
        `INSERT OR REPLACE INTO activity_days (user_id, day, active, sent_human, received_human) VALUES (?, ?, 1, ?, ?)`,
        who.id,
        utcDay(strict.clock.now - index * TIME.DAY),
        values.sent ? 1 : 0,
        values.received ? 1 : 0,
      );
    }
  }

  it('a new account cannot give gold or an owl', async () => {
    setGold(strict, carla, 500);
    const owl = await buyOwl(strict, carla, 'bartkauz');
    expect((await profile(carla)).canGift).toBe(false);
    expect((await prepareGold(carla, dora, owl)).body).toMatchObject({ code: 'gift_not_allowed' });
    const gift = await carla.agent.json('POST', `/api/owls/${owl}/gift/prepare`, {
      recipient: dora.id,
      withCover: false,
    });
    expect(gift.status).toBe(403);
    expect(gift.body).toMatchObject({ code: 'gift_not_allowed' });
  });

  it('active with letters to and from people: one gift in 14 days', async () => {
    setGold(strict, carla, 500);
    const owl = await buyOwl(strict, carla, 'bartkauz');
    activity(carla, 7, { sent: true, received: true });
    expect((await profile(carla)).canGift).toBe(true);
    expect((await prepareGold(carla, dora, owl)).status).toBe(200);
    // A gift is recorded – then nothing more for 14 days.
    strict.db.run(
      'UPDATE users SET last_gift_day = ? WHERE id = ?',
      utcDay(strict.clock.now),
      carla.id,
    );
    expect((await profile(carla)).canGift).toBe(false);
    strict.db.run(
      'UPDATE users SET last_gift_day = ? WHERE id = ?',
      utcDay(strict.clock.now - 14 * TIME.DAY),
      carla.id,
    );
    expect((await profile(carla)).canGift).toBe(true);
  });

  it('6 active days, or only 3 days with letters, are not enough', async () => {
    activity(carla, 6, { sent: true, received: true });
    expect((await profile(carla)).canGift).toBe(false);
    activity(carla, 7, {});
    strict.db.run(
      'UPDATE activity_days SET sent_human = 1, received_human = 1 WHERE user_id = ? AND day >= ?',
      carla.id,
      utcDay(strict.clock.now - 2 * TIME.DAY),
    );
    expect((await profile(carla)).canGift).toBe(false);
  });
});

describe('🌍 badge (SPEC 9.2.1)', () => {
  it('is announced once, after more than 40 030 km, and shown with the name', async () => {
    setGold(app, anna, 500);
    const id = await buyOwl(app, anna, 'waldkauz');
    app.db.run('UPDATE owls SET km_flown = 40030 WHERE id = ?', id);
    expect(announceAllGlobetrotters(app.ctx, app.clock.now)).toBe(0);
    app.db.run('UPDATE owls SET km_flown = 40031 WHERE id = ?', id);
    expect(announceAllGlobetrotters(app.ctx, app.clock.now)).toBe(1);
    expect(announceAllGlobetrotters(app.ctx, app.clock.now)).toBe(0);
    expect((await systemTypes(anna)).filter((type) => type === 'owl_globe')).toHaveLength(1);
    const list = await anna.agent.json<{
      owls: { id: string; name: string; globetrotter: boolean }[];
    }>('GET', '/api/owls');
    // The name stays as it is (renaming, releasing); the flag adds the badge.
    expect(list.body.owls.find((owl) => owl.id === id)).toMatchObject({
      name: 'Waldi',
      globetrotter: true,
    });
  });
});

describe('ASCII mode (SPEC 8.10)', () => {
  it('is a setting of the account', async () => {
    const changed = await anna.agent.json<{ profile: { asciiMode: boolean } }>(
      'PATCH',
      '/api/account/letters',
      {
        retentionDays: 365,
        print: false,
        ascii: true,
      },
    );
    expect(changed.body.profile.asciiMode).toBe(true);
  });
});

describe('migration 0023 (v1.3.0)', () => {
  it('treated owls are well, sick ones go to the rescue centre, the phoenix is never ill', () => {
    const db = openDatabase(path.join(tempDir(), 'm.sqlite'));
    const migrations = loadMigrations();
    migrate(
      db,
      migrations.filter((m) => m.version <= 22),
    );
    db.run(
      `INSERT INTO users (id, name_display, name_key, created_on, opaque_record, ed25519_pub, x25519_pub,
                          key_format, wrapped_master_key, private_keys, home_lat, home_lon, home_changed_on,
                          gold, last_active_date)
       VALUES ('u', 'Anna', 'anna', '2026-01-01', 'x', ?, ?, 1, ?, ?, 5252, 1340, '2026-01-01', 30, '2026-11-01')`,
      new Uint8Array(32),
      new Uint8Array(32),
      new Uint8Array(1),
      new Uint8Array(1),
    );
    const owl = (id: string, state: string, species = 'waldkauz') =>
      db.run(
        `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, state, state_until, owned_since, created_at)
         VALUES (?, 'u', 'own', ?, 'f', ?, 10, 1, ?, ?, '2026-01-01', 1)`,
        id,
        species,
        id,
        state,
        state === 'self_care' || state === 'vet' ? 999 : null,
      );
    owl('sick', 'sick');
    owl('self', 'self_care');
    owl('vet', 'vet');
    owl('phoenix', 'sick', 'phoenix');
    expect(migrate(db, migrations)).toEqual([23]);
    const state = (id: string) =>
      db.get<{ state: string }>('SELECT state FROM owls WHERE id = ?', id)?.state;
    expect(state('self')).toBe('home');
    expect(state('vet')).toBe('home');
    expect(state('phoenix')).toBe('home');
    expect(state('sick')).toBe('sick');
    const rescueCase = db.get<{ needed: number; done: number }>(
      "SELECT needed, done FROM rescue_cases WHERE owl_id = 'sick'",
    );
    expect(rescueCase?.done).toBe(0);
    expect(rescueCase!.needed).toBeGreaterThanOrEqual(5);
    expect(rescueCase!.needed).toBeLessThanOrEqual(20);
    expect(db.all('SELECT owl_id FROM rescue_cases')).toHaveLength(1);
    expect(db.get('SELECT user_id FROM user_stats')).toEqual({ user_id: 'u' });
    db.close();
  });

  it('the statistics are counted once from the stored letters', () => {
    app.db.run(
      `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, status, owl_name, owl_species, plaintext)
       VALUES ('MMMMMMMMMMMMMMMMMMMMMM', ?, ?, 'letter', 'small', ?, ?, 'delivered', 'W', 'waldkauz', 'x')`,
      anna.id,
      ben.id,
      app.clock.now,
      app.clock.now,
    );
    app.db.run("DELETE FROM meta WHERE key = 'stats_backfill'");
    expect(backfillStats(app.ctx, app.clock.now)).toBeGreaterThanOrEqual(2);
    expect(backfillStats(app.ctx, app.clock.now)).toBe(0);
    const row = app.db.get<{ letters_sent: number }>(
      'SELECT letters_sent FROM user_stats WHERE user_id = ?',
      anna.id,
    );
    expect(row?.letters_sent).toBe(1);
  });
});
