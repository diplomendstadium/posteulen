import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GOLD, OWL, TIME } from '@posteulen/shared/constants.ts';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { utcDay } from '../src/security/ids.ts';
import { sendBroadcast } from '../src/admin/operations.ts';
import { setInactivityDays } from '../src/admin/settings.ts';
import {
  withoutBots,
  ADMIN_ORIGIN,
  Agent,
  advanceTo,
  borrowOwl,
  buyOwl,
  couple,
  HAMBURG,
  login,
  person,
  setGold,
  testApp,
  type Person,
  type SentPush,
  type TestApp,
} from './auth-helpers.ts';

const PASSWORD = 'ein sehr langes Passwort';

let app: TestApp & { pushes: SentPush[] };
let anna: Person;
let ben: Person;

beforeEach(async () => {
  app = await testApp();
  anna = await person(app, 'Anna');
  ben = await person(app, 'Ben', HAMBURG);
  await couple(anna, ben);
  withoutBots(app);
});
afterEach(async () => {
  await app.close();
});

/** Replaces the random source (SPEC 17.2: fixed randomness). */
function setRandom(value: number | (() => number)): void {
  (app.ctx as { random: () => number }).random = typeof value === 'number' ? () => value : value;
}

interface OwlView {
  id: string;
  name: string | null;
  kind: string;
  state: string;
  isChick: boolean;
  energy: number;
  maxEnergy: number;
  stateUntil: number | null;
  loanExpiresAt: number | null;
  adultAt: number | null;
  clutchId: string | null;
  actions: Record<string, boolean>;
}

async function owls(who: Person) {
  return (
    await who.agent.json<{ owls: OwlView[]; clutches: { id: string; giftDeadline: number }[] }>(
      'GET',
      '/api/owls',
    )
  ).body;
}

function gold(who: Person): number {
  return app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', who.id)?.gold ?? 0;
}

async function systemTypes(who: Person): Promise<string[]> {
  const result = await who.agent.json<{ messages: { type: string }[] }>(
    'GET',
    '/api/system-messages',
  );
  return result.body.messages.map((message) => message.type);
}

function owlRow(id: string) {
  return app.db.get<{
    owner_id: string;
    state: string;
    is_chick: number;
    pending_sickness: number;
    owned_since: string;
    adult_at: number | null;
  }>(
    'SELECT owner_id, state, is_chick, pending_sickness, owned_since, adult_at FROM owls WHERE id = ?',
    id,
  );
}

/** Runs the daily job of `name` once for the day of `at`. */
function runDaily(name: string, at: number): void {
  app.db.run('DELETE FROM scheduled_events WHERE type = ?', `daily:${name}`);
  app.db.run('DELETE FROM daily_job_runs WHERE job = ? AND day = ?', name, utcDay(at));
  app.ctx.queue.schedule(`daily:${name}`, name, at);
  advanceTo(app, at);
}

async function reauthToken(who: Person, purpose: 'delete' | 'password'): Promise<string> {
  await client.ready();
  const start = client.startLogin(PASSWORD);
  const first = await who.agent.json<{ attemptId: string; loginResponse: string }>(
    'POST',
    '/api/reauth/start',
    { purpose, startLoginRequest: start.request },
  );
  const result = client.finishLogin(PASSWORD, start.state, first.body.loginResponse);
  if (!result) throw new Error('reauth failed');
  const second = await who.agent.json<{ token: string }>('POST', '/api/reauth/finish', {
    attemptId: first.body.attemptId,
    finishLoginRequest: result.finishRequest,
  });
  return second.body.token;
}

describe('loan owls (SPEC 9.6)', () => {
  it('three species a day with stable names; 0.1 gold; one per species, at most three', async () => {
    const menagerie = await anna.agent.json<{
      offer: { species: string; name: string; sex: string; loaned: boolean }[];
      maxLoans: number;
    }>('GET', '/api/menagerie');
    expect(menagerie.body.offer).toHaveLength(3);
    expect(new Set(menagerie.body.offer.map((o) => o.species)).size).toBe(3);
    expect((await anna.agent.json('GET', '/api/menagerie')).body).toEqual(menagerie.body);
    // Ben sees the same species, but with his own names.
    const forBen = await ben.agent.json<{ offer: { species: string }[] }>('GET', '/api/menagerie');
    expect(forBen.body.offer.map((o) => o.species)).toEqual(
      menagerie.body.offer.map((o) => o.species),
    );

    const first = await borrowOwl(anna);
    expect(gold(anna)).toBe(GOLD.START - GOLD.LOAN_PRICE);
    const list = await owls(anna);
    expect(list.owls[0]).toMatchObject({
      id: first,
      kind: 'loan',
      name: menagerie.body.offer[0]!.name,
      actions: { gift: false, rename: false, papeterie: false, release: false, care: true },
    });
    expect(
      (
        await anna.agent.json('POST', '/api/menagerie/loan', {
          species: menagerie.body.offer[0]!.species,
        })
      ).body,
    ).toMatchObject({ code: 'loan_species' });
    await borrowOwl(anna);
    await borrowOwl(anna);
    const notOffered = ['waldkauz', 'bartkauz', 'elfenkauz', 'schleiereule'].find(
      (id) => !menagerie.body.offer.some((o) => o.species === id),
    )!;
    expect(
      (await anna.agent.json('POST', '/api/menagerie/loan', { species: notOffered })).body,
    ).toMatchObject({
      code: 'loan_not_offered',
    });
    expect(
      (await anna.agent.json('POST', `/api/owls/${first}/name`, { name: 'Neu' })).body,
    ).toMatchObject({
      code: 'owl_rename_blocked',
    });
    expect((await anna.agent.json('POST', `/api/owls/${first}/papeterie`, {})).status).toBe(400);
  });

  it('expires after 24 hours without refund', async () => {
    const id = await borrowOwl(anna);
    advanceTo(app, app.clock.now + 24 * TIME.HOUR);
    expect(owlRow(id)).toBeUndefined();
    expect(gold(anna)).toBe(GOLD.START - GOLD.LOAN_PRICE);
    expect(await systemTypes(anna)).toContain('loan_expired');
  });

  it('carries one letter or gold to exactly one recipient and vanishes after delivery', async () => {
    const id = await borrowOwl(anna);
    setGold(app, anna, 200);
    const prepared = await anna.agent.json<{ token: string }>('POST', '/api/gold/prepare', {
      recipient: ben.id,
      amount: 5,
      owlId: id,
      withCover: false,
    });
    const sent = await anna.agent.json<{ arrivesAt: number }>('POST', '/api/gold/send', {
      token: prepared.body.token,
    });
    // Still counts while flying, even after 24 hours (loan expiry does not hit a flying owl).
    advanceTo(app, sent.body.arrivesAt);
    expect(owlRow(id)).toBeUndefined();
    expect(gold(ben)).toBe(GOLD.START + 5);
  });
});

describe('papeterie (SPEC 9.7)', () => {
  it('7 days away, then 10 % of the price and full energy', async () => {
    setGold(app, anna, 500);
    const id = await buyOwl(app, anna, 'maehnenkauz', 'Mähne');
    app.db.run("UPDATE owls SET energy = 10, sex = 'm' WHERE id = ?", id);
    const lent = await anna.agent.json<{ owl: OwlView }>('POST', `/api/owls/${id}/papeterie`, {});
    expect(lent.body.owl).toMatchObject({
      state: 'papeterie',
      actions: { care: false, gift: false },
    });
    expect((await anna.agent.json('POST', `/api/owls/${id}/feed`, {})).body).toMatchObject({
      code: 'owl_not_home',
    });
    // Does not regenerate while away.
    app.clock.now += 3 * TIME.DAY;
    expect((await owls(anna)).owls[0]?.energy).toBe(10);
    advanceTo(app, lent.body.owl.stateUntil!);
    const back = (await owls(anna)).owls[0]!;
    expect(back).toMatchObject({ state: 'home', energy: 330 });
    expect(gold(anna)).toBe(500 - 490 + 49);
    expect(await systemTypes(anna)).toContain('papeterie_done');
  });
});

describe('sickness (SPEC 9.8, 17.2)', () => {
  async function owlAged(days: number, sex: 'f' | 'm' = 'm'): Promise<string> {
    setGold(app, anna, 500);
    const id = await buyOwl(app, anna);
    app.db.run(
      'UPDATE owls SET owned_since = ?, sex = ? WHERE id = ?',
      utcDay(app.clock.now - days * TIME.DAY),
      sex,
      id,
    );
    return id;
  }

  const nextRoll = () => Date.UTC(2026, 10, 6, OWL.SICKNESS_HOUR_UTC);

  it('protection period: no roll before day 28, from day 28 on', async () => {
    // Clock: 2026-11-05 12:00; roll on 2026-11-06 03:00.
    const young = await owlAged(26); // 27 days on the day of the roll
    const old = await owlAged(27); // exactly 28 days
    setRandom(0);
    runDaily('sickness', nextRoll());
    expect(owlRow(young)?.state).toBe('home');
    expect(owlRow(old)?.state).toBe('sick');
    expect(await systemTypes(anna)).toContain('owl_sick');
  });

  it('only owls of active accounts are rolled; probability with care bonus', async () => {
    const id = await owlAged(60);
    app.db.run('UPDATE users SET last_active_date = ? WHERE id = ?', '2026-09-01', anna.id);
    setRandom(0);
    runDaily('sickness', nextRoll());
    expect(owlRow(id)?.state).toBe('home');
    app.db.run('UPDATE users SET last_active_date = ? WHERE id = ?', '2026-11-05', anna.id);
    // 0.02 < 1/30 but not < 1/30 × 0.3: with care bonus the owl stays healthy.
    app.db.run(
      "UPDATE owls SET care_mask = ?, care_mask_day = '2026-11-05' WHERE id = ?",
      (1 << 14) - 1,
      id,
    );
    setRandom(0.02);
    runDaily('sickness', nextRoll() + TIME.DAY);
    expect(owlRow(id)?.state).toBe('home');
    app.db.run('UPDATE owls SET care_mask = 0 WHERE id = ?', id);
    runDaily('sickness', nextRoll() + 2 * TIME.DAY);
    expect(owlRow(id)?.state).toBe('sick');
  });

  it('a flying owl falls sick on its return; eggs take precedence', async () => {
    const male = await owlAged(60, 'm');
    const female = await owlAged(60, 'f');
    app.db.run('UPDATE owls SET energy = 540 WHERE owner_id = ?', anna.id);
    setGold(app, anna, 500);
    setRandom(0.5);
    for (const id of [male, female]) {
      const prepared = await anna.agent.json<{ token: string }>('POST', '/api/gold/prepare', {
        recipient: ben.id,
        amount: 1,
        owlId: id,
        withCover: false,
      });
      await anna.agent.json('POST', '/api/gold/send', { token: prepared.body.token });
    }
    setRandom(0);
    runDaily('sickness', nextRoll());
    expect(owlRow(male)).toMatchObject({ state: 'flying', pending_sickness: 1 });
    advanceTo(app, app.clock.now + 5 * TIME.DAY);
    expect(owlRow(male)?.state).toBe('sick');
    // Random 0 also means eggs for the female: brooding instead of sick.
    expect(owlRow(female)).toMatchObject({ state: 'brooding', pending_sickness: 0 });
  });

  it('treatment: own care 0.2 gold / 7 days, vet 1.0 gold / 24 hours', async () => {
    const a = await owlAged(60);
    const b = await owlAged(60);
    app.db.run("UPDATE owls SET state = 'sick' WHERE owner_id = ?", anna.id);
    setGold(app, anna, 50);
    expect(
      (await anna.agent.json<{ owl: OwlView }>('POST', `/api/owls/${a}/treat`, { kind: 'self' }))
        .body.owl,
    ).toMatchObject({ state: 'self_care', actions: { care: true, release: true } });
    expect(
      (await anna.agent.json<{ owl: OwlView }>('POST', `/api/owls/${b}/treat`, { kind: 'vet' }))
        .body.owl,
    ).toMatchObject({ state: 'vet', actions: { care: false, release: false } });
    expect(gold(anna)).toBe(50 - 2 - 10);
    expect(
      (await anna.agent.json('POST', `/api/owls/${a}/treat`, { kind: 'vet' })).body,
    ).toMatchObject({
      code: 'owl_not_sick',
    });
    advanceTo(app, app.clock.now + 24 * TIME.HOUR);
    expect(owlRow(b)?.state).toBe('home');
    expect(owlRow(a)?.state).toBe('self_care');
    advanceTo(app, app.clock.now + 6 * TIME.DAY);
    expect(owlRow(a)?.state).toBe('home');
    expect((await systemTypes(anna)).filter((t) => t === 'owl_healthy')).toHaveLength(2);
  });
});

describe('eggs and chicks (SPEC 9.9, 17.2)', () => {
  async function brood(count: 1 | 2 | 3): Promise<{ mother: string; hatchAt: number }> {
    setGold(app, anna, 500);
    const mother = await buyOwl(app, anna, 'waldkauz', 'Mama');
    app.db.run("UPDATE owls SET sex = 'f' WHERE id = ?", mother);
    // Papeterie, then eggs on the return (random 0).
    await anna.agent.json('POST', `/api/owls/${mother}/papeterie`, {});
    setRandom(0);
    advanceTo(app, app.clock.now + 7 * TIME.DAY);
    expect(owlRow(mother)?.state).toBe('brooding');
    expect(await systemTypes(anna)).toContain('eggs_laid');
    const hatchAt = app.clock.now + 7 * TIME.DAY;
    // chickCount: 1 + floor(r × 3)
    setRandom([0, 0.5, 0.9][count - 1]!);
    advanceTo(app, hatchAt);
    return { mother, hatchAt };
  }

  it('one chick: named by the holder, grows up after 14 days', async () => {
    const { hatchAt } = await brood(1);
    const list = await owls(anna);
    const chick = list.owls.find((owl) => owl.isChick)!;
    expect(chick).toMatchObject({
      name: null,
      actions: { care: true, release: false, gift: false },
    });
    expect(list.clutches).toEqual([]);
    expect(await systemTypes(anna)).toContain('chicks_hatched');
    expect(
      (await anna.agent.json('POST', `/api/owls/${chick.id}/name`, { name: 'Pieps' })).status,
    ).toBe(200);
    advanceTo(app, hatchAt + 14 * TIME.DAY);
    expect(owlRow(chick.id)?.is_chick).toBe(0);
    expect((await owls(anna)).owls.find((owl) => owl.id === chick.id)?.energy).toBe(540);
    expect(await systemTypes(anna)).toContain('chick_adult');
  });

  it('two or three chicks: random names after 24 h, lot among active contacts, no cover letter', async () => {
    const { hatchAt } = await brood(3);
    const list = await owls(anna);
    expect(list.owls.filter((owl) => owl.isChick)).toHaveLength(3);
    expect(list.clutches).toHaveLength(1);
    expect(await systemTypes(anna)).toContain('chicks_hatched_gift');
    advanceTo(app, hatchAt + 24 * TIME.HOUR);
    const chicks = app.db.all<{ id: string; name: string | null; state: string }>(
      'SELECT id, name, state FROM owls WHERE is_chick = 1',
    );
    expect(chicks.every((chick) => chick.name !== null)).toBe(true);
    const flying = chicks.filter((chick) => chick.state === 'gift_flight');
    expect(flying).toHaveLength(1);
    expect(await systemTypes(anna)).toContain('clutch_lot');
    const flight = app.db.get<{ ends_at: number; profile: string }>(
      "SELECT ends_at, profile FROM flights WHERE state = 'active'",
    );
    expect(JSON.parse(flight!.profile)).toMatchObject({ mode: 'chick', speedKmh: 10 });
    expect(app.db.all("SELECT 1 FROM letters WHERE kind = 'cover_chick'")).toEqual([]);
    advanceTo(app, flight!.ends_at);
    const gift = owlRow(flying[0]!.id)!;
    expect(gift).toMatchObject({ owner_id: ben.id, state: 'home', is_chick: 1 });
    expect(gift.adult_at).toBe(flight!.ends_at + 7 * TIME.DAY);
    expect(await systemTypes(ben)).toContain('chick_gift_received');
    app.ctx.push.idle();
  });

  it('without active contacts all chicks stay', async () => {
    await anna.agent.json('DELETE', `/api/contacts/${ben.id}`);
    const { hatchAt } = await brood(2);
    advanceTo(app, hatchAt + 24 * TIME.HOUR);
    expect(
      app.db.all(
        "SELECT 1 FROM owls WHERE is_chick = 1 AND owner_id = ? AND state = 'home'",
        anna.id,
      ),
    ).toHaveLength(2);
    expect(await systemTypes(anna)).toContain('clutch_kept');
  });

  it('the holder gives a chick away; a turned-back chick grows up at home not before day 14', async () => {
    const { hatchAt } = await brood(2);
    const list = await owls(anna);
    const clutch = list.clutches[0]!;
    const chick = list.owls.find((owl) => owl.isChick)!;
    expect(
      (
        await anna.agent.json('POST', `/api/clutches/${clutch.id}/gift/prepare`, {
          chickId: chick.id,
          recipient: ben.id,
          withCover: false,
        })
      ).body,
    ).toMatchObject({ code: 'owl_unnamed' });
    await anna.agent.json('POST', `/api/owls/${chick.id}/name`, { name: 'Flaum' });
    const prepared = await anna.agent.json<{ token: string; arrivesAt: number }>(
      'POST',
      `/api/clutches/${clutch.id}/gift/prepare`,
      { chickId: chick.id, recipient: ben.id, withCover: false },
    );
    expect(
      (
        await anna.agent.json('POST', `/api/clutches/${clutch.id}/gift/send`, {
          token: prepared.body.token,
        })
      ).status,
    ).toBe(200);
    expect((await owls(anna)).clutches).toEqual([]);
    // 255 km at 10 km/h with an hour of rest after every hour of flight: about 2 days.
    expect(prepared.body.arrivesAt - hatchAt).toBeGreaterThan(40 * TIME.HOUR);
    app.clock.now += 10 * TIME.HOUR;
    await ben.agent.json('DELETE', `/api/contacts/${anna.id}`);
    const flight = app.db.get<{ ends_at: number }>(
      "SELECT ends_at FROM flights WHERE state = 'active'",
    );
    advanceTo(app, flight!.ends_at);
    expect(owlRow(chick.id)).toMatchObject({ owner_id: anna.id, state: 'home', is_chick: 1 });
    expect(owlRow(chick.id)?.adult_at).toBe(hatchAt + 14 * TIME.DAY);
    expect(await systemTypes(anna)).toContain('letter_returned');
  });
});

describe('name and home (SPEC 7.3, 7.4)', () => {
  it('name: once per calendar year, contacts are told, the old name is locked', async () => {
    const changed = await anna.agent.json<{ profile: { name: string; nameChangedYear: number } }>(
      'PATCH',
      '/api/account/name',
      { name: 'Annabell' },
    );
    expect(changed.body.profile).toMatchObject({ name: 'Annabell', nameChangedYear: 2026 });
    expect(await systemTypes(ben)).toContain('contact_renamed');
    expect(
      (await anna.agent.json('PATCH', '/api/account/name', { name: 'Anni' })).body,
    ).toMatchObject({
      code: 'name_change_blocked',
    });
    expect(
      (await ben.agent.json('PATCH', '/api/account/name', { name: 'ANNA' })).body,
    ).toMatchObject({
      code: 'name_unavailable',
    });
    expect(
      (await ben.agent.json('PATCH', '/api/account/name', { name: 'Admin' })).body,
    ).toMatchObject({
      code: 'name_reserved',
    });
  });

  it('home: every 21 days, on land; a flying owl changes its course', async () => {
    expect(
      (await anna.agent.json('PATCH', '/api/account/home', { home: { lat: 50, lon: 9 } })).body,
    ).toMatchObject({
      code: 'home_change_blocked',
    });
    app.clock.now += 21 * TIME.DAY;
    await ben.agent.json('GET', '/api/owls');
    await anna.agent.json('GET', '/api/owls');
    const owl = await borrowOwl(anna);
    setGold(app, anna, 200);
    const prepared = await anna.agent.json<{ token: string; arrivesAt: number }>(
      'POST',
      '/api/gold/prepare',
      {
        recipient: ben.id,
        amount: 1,
        owlId: owl,
        withCover: false,
      },
    );
    await anna.agent.json('POST', '/api/gold/send', { token: prepared.body.token });
    expect(
      (await ben.agent.json('PATCH', '/api/account/home', { home: { lat: 55, lon: 3 } })).body,
    ).toMatchObject({
      code: 'home_invalid',
    });
    const moved = await ben.agent.json<{ profile: { home: { lat: number } } }>(
      'PATCH',
      '/api/account/home',
      {
        home: { lat: 52.375, lon: 9.732 },
      },
    );
    expect(moved.body.profile.home).toEqual({ lat: 52.38, lon: 9.73 });
    const flight = app.db.get<{ route: string }>(
      "SELECT route FROM flights WHERE state = 'active'",
    );
    const stop = (JSON.parse(flight!.route) as { lat: number; arrivesAt: number }[])[0]!;
    expect(stop.lat).toBe(52.38);
    expect(stop.arrivesAt).toBeLessThan(prepared.body.arrivesAt);
  });
});

describe('account deletion (SPEC 7.5, 7.7)', () => {
  it('logs out at once; a login within 24 hours cancels the deletion', async () => {
    const token = await reauthToken(anna, 'delete');
    expect((await anna.agent.json('POST', '/api/account/delete', { token })).status).toBe(200);
    expect((await anna.agent.json('GET', '/api/owls')).status).toBe(401);
    app.clock.now += 20 * TIME.HOUR;
    const again = await login(anna.agent, 'Anna', PASSWORD);
    expect(again.body).toMatchObject({ deletionCancelled: true });
    advanceTo(app, app.clock.now + 10 * TIME.HOUR);
    expect(
      app.db.get<{ state: string }>('SELECT state FROM users WHERE id = ?', anna.id)?.state,
    ).toBe('active');
    expect(await systemTypes(anna)).toContain('deletion_cancelled');
  });

  it('needs a fresh password check', async () => {
    expect(
      (await anna.agent.json('POST', '/api/account/delete', { token: 'AAAAAAAAAAAAAAAAAAAAAA' }))
        .status,
    ).toBe(403);
    const wrong = await reauthToken(anna, 'password');
    expect((await anna.agent.json('POST', '/api/account/delete', { token: wrong })).status).toBe(
      403,
    );
  });

  it('final deletion: owls to the account turn back, own deliveries arrive, then all data goes', async () => {
    setGold(app, anna, 300);
    setGold(app, ben, 300);
    // Ben lives in Lisbon: both flights take days, longer than the 24-hour grace period.
    app.db.run('UPDATE users SET home_lat = 3872, home_lon = -914 WHERE id = ?', ben.id);
    // Ben's owl flies to Anna; Anna's owl flies to Ben.
    const benOwl = await buyOwl(app, ben, 'waldkauz', 'Benno');
    const annaOwl = await buyOwl(app, anna, 'waldkauz', 'Annika');
    app.db.run('UPDATE owls SET energy = 540');
    for (const [from, to, owl] of [
      [ben, anna, benOwl],
      [anna, ben, annaOwl],
    ] as const) {
      const prepared = await from.agent.json<{ token: string }>('POST', '/api/gold/prepare', {
        recipient: to.id,
        amount: 10,
        owlId: owl,
        withCover: false,
      });
      expect(
        (await from.agent.json('POST', '/api/gold/send', { token: prepared.body.token })).status,
      ).toBe(200);
    }
    app.clock.now += TIME.HOUR;
    const token = await reauthToken(anna, 'delete');
    await anna.agent.json('POST', '/api/account/delete', { token });
    advanceTo(app, app.clock.now + 24 * TIME.HOUR);
    expect(
      app.db.get<{ state: string }>('SELECT state FROM users WHERE id = ?', anna.id)?.state,
    ).toBe('deleting');
    expect(await systemTypes(ben)).toEqual(
      expect.arrayContaining(['contact_deleted', 'letter_returned']),
    );
    expect(
      (await ben.agent.json<{ contacts: unknown[] }>('GET', '/api/contacts')).body.contacts,
    ).toEqual([]);
    // Login is no longer possible; the name is locked.
    expect(
      (await login(new Agent(app.userApi, 'https://posteulen.test'), 'Anna', PASSWORD)).status,
    ).not.toBe(200);
    advanceTo(app, app.clock.now + 15 * TIME.DAY);
    // Anna's gold arrived at Ben, her owl vanished, then everything of hers was deleted.
    expect(gold(ben)).toBe(300 - 60 - 10 + 10 + 10);
    expect(app.db.get('SELECT 1 FROM users WHERE id = ?', anna.id)).toBeUndefined();
    expect(app.db.get('SELECT 1 FROM owls WHERE id = ?', annaOwl)).toBeUndefined();
    expect(owlRow(benOwl)).toMatchObject({ owner_id: ben.id, state: 'home' });
    expect(app.db.all('SELECT 1 FROM transactions WHERE user_id = ?', anna.id)).toEqual([]);
    expect(
      (
        await (
          await import('./auth-helpers.ts')
        ).register(new Agent(app.userApi, 'https://posteulen.test'), 'Anna', PASSWORD)
      ).status,
    ).toBe(409);
  });
});

describe('inactivity (SPEC 9.10, 13 item 4)', () => {
  const roll = (day: number) => Date.UTC(2026, 10, day, 4);

  it('warns 30 days before, deletes only 30 days after the warning; activity resets', async () => {
    setInactivityDays(app.db, 60);
    app.db.run('UPDATE users SET last_active_date = ? WHERE id = ?', '2026-10-06', anna.id);
    runDaily('inactivity', roll(6));
    // Read the database first: any request of Anna counts as activity and ends the warning.
    const warned = app.db.get<{ inactivity_warned_on: string }>(
      'SELECT inactivity_warned_on FROM users WHERE id = ?',
      anna.id,
    );
    expect(warned?.inactivity_warned_on).toBe('2026-11-06');
    expect(await systemTypes(anna)).toContain('deletion_warning');
    // Shortening the period does not delete without a warning that is 30 days old.
    app.db.run('UPDATE users SET last_active_date = ? WHERE id = ?', '2026-08-01', ben.id);
    runDaily('inactivity', roll(7));
    expect(
      app.db.get<{ state: string }>('SELECT state FROM users WHERE id = ?', ben.id)?.state,
    ).toBe('active');
    // Activity: the warning is gone.
    app.db.run('UPDATE users SET last_active_date = ? WHERE id = ?', '2026-10-06', anna.id);
    app.clock.now = Date.UTC(2026, 10, 8, 12);
    await anna.agent.json('GET', '/api/owls');
    expect(
      app.db.get<{ inactivity_warned_on: string | null }>(
        'SELECT inactivity_warned_on FROM users WHERE id = ?',
        anna.id,
      )?.inactivity_warned_on,
    ).toBe(null);
    // 30 days after Ben's warning: deletion starts.
    runDaily('inactivity', Date.UTC(2026, 11, 7, 4));
    expect(app.db.get('SELECT 1 FROM users WHERE id = ?', ben.id)).toBeUndefined();
  });

  it('inactive accounts get no daily gold and are not addressable', async () => {
    app.db.run('UPDATE users SET last_active_date = ? WHERE id = ?', '2026-10-01', ben.id);
    const owl = await borrowOwl(anna);
    expect(
      (
        await anna.agent.json('POST', '/api/letters/prepare', {
          recipients: [ben.id],
          parchment: 'small',
          owlId: owl,
        })
      ).body,
    ).toMatchObject({ code: 'recipient_inactive' });
  });
});

describe('admin (SPEC 13)', () => {
  it('statistics, deletion period with minimum, broadcast with push', async () => {
    const stats = app.ctx.queue; // keep the queue referenced
    expect(stats).toBeDefined();
    const admin = new Agent(app.adminApi, ADMIN_ORIGIN);
    expect((await admin.json('GET', '/api/stats')).status).toBe(401);
    const { adminStats } = await import('../src/admin/operations.ts');
    expect(adminStats(app.ctx, app.clock.now)).toMatchObject({
      accounts: { created: 2, current: 2, active30: 2 },
      letters: { total: 0, last7: 0 },
    });
    expect(() => setInactivityDays(app.db, 59)).toThrow();
    await ben.agent.json('PUT', '/api/push/subscription', {
      endpoint: 'https://push.example.com/ben',
      keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) },
    });
    await app.ctx.push.idle();
    expect(sendBroadcast(app.ctx, 'Wartung heute Abend.', app.clock.now)).toBe(2);
    await app.ctx.push.idle();
    expect(app.pushes.map((push) => JSON.parse(push.payload).type)).toContain('broadcast');
    const messages = await anna.agent.json<{
      messages: { type: string; params: { text: string } }[];
    }>('GET', '/api/system-messages');
    expect(messages.body.messages.at(-1)).toMatchObject({
      type: 'broadcast',
      params: { text: 'Wartung heute Abend.' },
    });
  });
});
