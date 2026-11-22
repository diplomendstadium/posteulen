/**
 * Version 1.3.1 (server side): privileged players (SPEC 9.1.7, 13), the pouch with owl biscuits
 * and treats (9.1.6), the pair rules for eggs (9.9), the deletion period of new accounts
 * (8.4.1) and migration 0024.
 */
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GOLD, OWL, TIME } from '@posteulen/shared/constants.ts';
import { openDatabase } from '../src/db/database.ts';
import { loadMigrations, migrate } from '../src/db/migrate.ts';
import { createVoucher } from '../src/admin/vouchers.ts';
import { giftBlockOf } from '../src/accounts/stats.ts';
import {
  grantPrivilege,
  listPrivileged,
  privilegeOf,
  revokePrivilege,
} from '../src/gold/privilege.ts';
import { eggChanceOf, markReady, markUnready, noteVisit } from '../src/owls/pairs.ts';
import type { OwlRow } from '../src/owls/model.ts';
import { tempDir } from './helpers.ts';
import {
  advanceTo,
  buyOwl,
  couple,
  HAMBURG,
  person,
  setGold,
  testApp,
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

const now = () => app.clock.now;
const loadOwl = (_ctx: unknown, id: string) =>
  app.db.get<OwlRow>('SELECT * FROM owls WHERE id = ?', id);
const run = <T>(work: (after: (job: () => void) => void) => T): T => {
  const jobs: (() => void)[] = [];
  const result = app.db.transaction(() => work((job) => jobs.push(job)));
  for (const job of jobs) job();
  return result;
};
const gold = (who: Person) =>
  app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', who.id)?.gold ?? 0;
const systemTypes = (who: Person) =>
  app.db
    .all<{ type: string }>(
      'SELECT type FROM system_messages WHERE user_id = ? ORDER BY created_at',
      who.id,
    )
    .map((row) => row.type);

describe('deletion period of new accounts (v1.3.1, SPEC 8.4.1)', () => {
  it('new accounts keep letters 180 days, 30/90/365 stay possible', async () => {
    const profile = await anna.agent.json<{ profile: { letterRetentionDays: number } }>(
      'GET',
      '/api/sync',
    );
    expect(profile.body.profile.letterRetentionDays).toBe(180);
    for (const days of [30, 90, 365]) {
      const changed = await anna.agent.json<{ profile: { letterRetentionDays: number } }>(
        'PATCH',
        '/api/account/letters',
        { retentionDays: days, print: false },
      );
      expect(changed.status).toBe(200);
      expect(app.db.get('SELECT letter_retention_days FROM users WHERE id = ?', anna.id)).toEqual({
        letter_retention_days: days,
      });
    }
  });
});

describe('privileged players (v1.3.1, SPEC 9.1.7)', () => {
  it('for good: endless gold, a system message, no gift rule, revocable at once', async () => {
    setGold(app, anna, 0);
    // A new player: not active for long enough to give something (9.1.5).
    app.db.run('DELETE FROM activity_days WHERE user_id = ?', anna.id);
    expect(giftBlockOf(app.ctx, anna.id, now())).not.toBeNull();
    const entry = run((after) => grantPrivilege(app.ctx, ' anna ', null, now(), after));
    expect(entry).toMatchObject({ name: 'Anna', until: null });
    expect(systemTypes(anna)).toContain('privilege_granted');
    expect(listPrivileged(app.ctx, now())).toEqual([{ name: 'Anna', since: now(), until: null }]);
    const sync = await anna.agent.json<{ profile: { privileged: unknown; canGift: boolean } }>(
      'GET',
      '/api/sync',
    );
    expect(sync.body.profile).toMatchObject({ privileged: { until: null }, canGift: true });
    // Buying costs nothing; the balance stays as it was.
    await buyOwl(app, anna, 'bartkauz', 'Bruno');
    expect(gold(anna)).toBe(0);
    expect(giftBlockOf(app.ctx, anna.id, now())).toBeNull();
    run((after) => revokePrivilege(app.ctx, 'Anna', now(), after));
    expect(privilegeOf(app.db, anna.id, now())).toBeNull();
    expect(systemTypes(anna).at(-1)).toBe('privilege_ended');
    expect(
      (await anna.agent.json('POST', '/api/owls/buy', { species: 'waldkauz' })).body,
    ).toMatchObject({ code: 'gold_insufficient' });
    expect(() => run((after) => revokePrivilege(app.ctx, 'Anna', now(), after))).toThrow();
  });

  it('until a point in time: ends by itself with a system message', () => {
    const until = now() + 2 * TIME.HOUR;
    run((after) => grantPrivilege(app.ctx, 'Anna', until, now(), after));
    expect(privilegeOf(app.db, anna.id, now())).toEqual({ until });
    advanceTo(app, until + TIME.MINUTE);
    expect(privilegeOf(app.db, anna.id, now())).toBeNull();
    expect(app.db.all('SELECT 1 FROM privileged_users')).toEqual([]);
    expect(systemTypes(anna).filter((type) => type.startsWith('privilege_'))).toEqual([
      'privilege_granted',
      'privilege_ended',
    ]);
    // Unknown names and ends in the past are refused.
    expect(() => run((after) => grantPrivilege(app.ctx, 'Niemand', null, now(), after))).toThrow();
    expect(() =>
      run((after) => grantPrivilege(app.ctx, 'Anna', now() - 1, now(), after)),
    ).toThrow();
  });

  it('may send gold without a rest of 100 gold; returned gold is not refunded', async () => {
    await couple(anna, ben);
    setGold(app, anna, 0);
    const bensGold = gold(ben);
    run((after) => grantPrivilege(app.ctx, 'Anna', null, now(), after));
    const owl = await buyOwl(app, anna, 'bartkauz', 'Bruno');
    app.db.run('UPDATE owls SET energy = 700 WHERE id = ?', owl);
    const prepared = await anna.agent.json<{ token: string }>('POST', '/api/gold/prepare', {
      recipient: ben.id,
      amount: GOLD.TRANSFER_MAX,
      owlId: owl,
      withCover: false,
    });
    expect(prepared.status, JSON.stringify(prepared.body)).toBe(200);
    // Still at most 200 gold per owl.
    expect(
      (
        await anna.agent.json('POST', '/api/gold/prepare', {
          recipient: ben.id,
          amount: GOLD.TRANSFER_MAX + 1,
          owlId: owl,
          withCover: false,
        })
      ).status,
    ).toBe(400);
    const sent = await anna.agent.json('POST', '/api/gold/send', { token: prepared.body.token });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(gold(anna)).toBe(0);
    const flight = app.db.get<{ id: string; gold_paid: number }>(
      "SELECT id, gold_paid FROM flights WHERE purpose = 'gold'",
    )!;
    expect(flight.gold_paid).toBe(0);
    // Ben removes Anna before the gold arrives: the owl turns back – nothing is refunded.
    expect((await ben.agent.json('DELETE', `/api/contacts/${anna.id}`)).status).toBe(200);
    advanceTo(app, now() + 3 * TIME.DAY);
    expect(gold(anna)).toBe(0);
    expect(app.db.get("SELECT gold_state FROM flights WHERE purpose = 'gold'")).toEqual({
      gold_state: 'refunded',
    });
    expect(gold(ben)).toBe(bensGold);
  });

  it('may own more than 50 owls', async () => {
    setGold(app, anna, 0);
    for (let i = 0; i < OWL.MAX_OWN_OWLS; i++) {
      app.db.run(
        `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at)
         VALUES (?, ?, 'own', 'waldkauz', 'f', ?, 100, 0, '2026-01-01', 0)`,
        `filler${String(i).padStart(16, '0')}`,
        anna.id,
        `Eule ${i}`,
      );
    }
    expect(
      (await anna.agent.json('POST', '/api/owls/buy', { species: 'waldkauz' })).body,
    ).toMatchObject({ code: 'owl_limit' });
    run((after) => grantPrivilege(app.ctx, 'Anna', null, now(), after));
    expect((await anna.agent.json<{ canBuy: boolean }>('GET', '/api/owls')).body.canBuy).toBe(true);
    expect((await anna.agent.json('POST', '/api/owls/buy', { species: 'waldkauz' })).status).toBe(
      200,
    );
  });
});

describe('the pouch (v1.3.1, SPEC 9.1.6)', () => {
  it('vouchers for owl biscuits and treats; feeding takes from the pouch instead of gold', async () => {
    const biscuits = createVoucher(app.ctx, { kind: 'biscuits', count: 2 }, now());
    const treats = createVoucher(app.ctx, { kind: 'treats', count: 1 }, now());
    expect(
      (await anna.agent.json('POST', '/api/vouchers/redeem', { code: biscuits.code })).body,
    ).toEqual({ kind: 'biscuits', count: 2 });
    expect(
      (await anna.agent.json('POST', '/api/vouchers/redeem', { code: treats.code })).body,
    ).toEqual({ kind: 'treats', count: 1 });
    const sync = await anna.agent.json<{ profile: { bag: unknown } }>('GET', '/api/sync');
    expect(sync.body.profile.bag).toEqual({ biscuits: 2, treats: 1 });
    setGold(app, anna, 500);
    const owl = await buyOwl(app, anna);
    app.db.run('UPDATE owls SET energy = 10 WHERE id = ?', owl);
    const before = gold(anna);
    expect((await anna.agent.json('POST', `/api/owls/${owl}/feed`, {})).status).toBe(200);
    expect((await anna.agent.json('POST', `/api/owls/${owl}/snack`, {})).status).toBe(200);
    expect(gold(anna)).toBe(before);
    expect(app.db.get('SELECT bag_biscuits, bag_treats FROM users WHERE id = ?', anna.id)).toEqual({
      bag_biscuits: 1,
      bag_treats: 0,
    });
    // The treat is used up: the next snack costs gold again.
    expect((await anna.agent.json('POST', `/api/owls/${owl}/snack`, {})).status).toBe(200);
    expect(gold(anna)).toBe(before - GOLD.SNACK_PRICE);
  });

  it('also pays in the rescue centre', async () => {
    const voucher = createVoucher(app.ctx, { kind: 'biscuits', count: 1 }, now());
    await anna.agent.json('POST', '/api/vouchers/redeem', { code: voucher.code });
    setGold(app, anna, 0);
    const wild = (await anna.agent.json<{ wild: { id: string }[] }>('GET', '/api/rescue')).body
      .wild[0]!;
    expect((await anna.agent.json('POST', `/api/rescue/wild/${wild.id}/feed`, {})).status).toBe(
      200,
    );
    expect(app.db.get('SELECT bag_biscuits FROM users WHERE id = ?', anna.id)).toEqual({
      bag_biscuits: 0,
    });
  });
});

describe('pairs (v1.3.1, SPEC 9.9)', () => {
  const DAY = TIME.DAY;

  function owlOf(who: Person, sex: 'f' | 'm', since: number, species = 'waldkauz'): string {
    const id = `pair${sex}${who.name}${String(Math.round(since)).slice(-8)}`
      .padEnd(22, '0')
      .slice(0, 22);
    app.db.run(
      `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at)
       VALUES (?, ?, 'own', ?, ?, ?, 100, ?, ?, ?)`,
      id,
      who.id,
      species,
      sex,
      `${sex}${who.name}`,
      since,
      new Date(since).toISOString().slice(0, 10),
      since,
    );
    return id;
  }

  it('twice as likely with a partner at home, three times with a visit as well', () => {
    const start = now() - 10 * DAY;
    const female = owlOf(anna, 'f', start);
    expect(eggChanceOf(app.ctx, loadOwl(app.ctx, female)!, now())).toBe(OWL.EGG_PROBABILITY);
    const male = owlOf(anna, 'm', start);
    expect(eggChanceOf(app.ctx, loadOwl(app.ctx, female)!, now())).toBe(2 * OWL.EGG_PROBABILITY);
    // Another species does not count.
    app.db.run("UPDATE owls SET species = 'bartkauz' WHERE id = ?", male);
    expect(eggChanceOf(app.ctx, loadOwl(app.ctx, female)!, now())).toBe(OWL.EGG_PROBABILITY);
    app.db.run("UPDATE owls SET species = 'waldkauz' WHERE id = ?", male);
    // The male was sick all week: not ready, no pair.
    markUnready(app.ctx, male, now() - 8 * DAY);
    expect(eggChanceOf(app.ctx, loadOwl(app.ctx, female)!, now())).toBe(OWL.EGG_PROBABILITY);
    // Healthy again for two whole days.
    markReady(app.ctx, male, now() - 2 * DAY - 7 * TIME.HOUR);
    expect(eggChanceOf(app.ctx, loadOwl(app.ctx, female)!, now())).toBe(2 * OWL.EGG_PROBABILITY);
    // A visit as well: three times, and the visit is forgotten afterwards.
    app.db.run('UPDATE owls SET mate_met = 1 WHERE id = ?', female);
    expect(eggChanceOf(app.ctx, loadOwl(app.ctx, female)!, now())).toBe(3 * OWL.EGG_PROBABILITY);
    expect(loadOwl(app.ctx, female)!.mate_met).toBe(0);
  });

  it('a visit counts with at least two hours of rest next to a ready male of the host', () => {
    const female = owlOf(anna, 'f', now() - 10 * DAY);
    noteVisit(app.ctx, female, ben.id, now() - 3 * TIME.HOUR, now());
    expect(loadOwl(app.ctx, female)!.mate_met).toBe(0);
    const male = owlOf(ben, 'm', now() - 10 * DAY);
    noteVisit(app.ctx, female, ben.id, now() - 90 * TIME.MINUTE, now());
    expect(loadOwl(app.ctx, female)!.mate_met).toBe(0);
    // The male was away for most of the rest.
    app.db.run(
      'INSERT INTO owl_away (owl_id, since_at, until_at) VALUES (?, ?, ?)',
      male,
      now() - 3 * TIME.HOUR,
      now() - TIME.HOUR,
    );
    noteVisit(app.ctx, female, ben.id, now() - 3 * TIME.HOUR, now());
    expect(loadOwl(app.ctx, female)!.mate_met).toBe(0);
    noteVisit(app.ctx, female, ben.id, now() - 6 * TIME.HOUR, now());
    expect(loadOwl(app.ctx, female)!.mate_met).toBe(1);
  });

  it('brooding and sickness are recorded as not ready', async () => {
    setGold(app, anna, 500);
    const owl = await buyOwl(app, anna);
    const { admit } = await import('../src/rescue/service.ts');
    run((after) => admit(app.ctx, loadOwl(app.ctx, owl)!, now(), after));
    expect(app.db.all('SELECT since_at, until_at FROM owl_unready WHERE owl_id = ?', owl)).toEqual([
      { since_at: now(), until_at: null },
    ]);
  });
});

describe('migration 0024 (v1.3.1)', () => {
  it('keeps vouchers, records sick and brooding owls as not ready, gives flights the sex', () => {
    const db = openDatabase(path.join(tempDir(), 'db.sqlite'));
    const migrations = loadMigrations();
    migrate(db, migrations.slice(0, 23));
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
    const owl = (id: string, state: string, until: number | null) =>
      db.run(
        `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, state, state_until,
                           owned_since, created_at)
         VALUES (?, 'u', 'own', 'waldkauz', 'f', ?, 10, 1, ?, ?, '2026-01-01', 1)`,
        id,
        id,
        state,
        until,
      );
    owl('sick', 'sick', null);
    owl('brood', 'brooding', 10 * 86_400_000);
    db.run("INSERT INTO rescue_cases (owl_id, needed, admitted_at) VALUES ('sick', 9, 5000)");
    db.run(
      `INSERT INTO vouchers (id, hmac, hint, kind, gold, species, created_at, expires_at)
       VALUES ('v', x'01', 'ABCD', 'gold', 50, NULL, 1, 2)`,
    );
    db.run(
      `INSERT INTO flights (id, holder_id, owl_id, owl_kind, owl_name, owl_species, purpose, profile, route,
                            plan, started_at, ends_at)
       VALUES ('f', 'u', 'sick', 'own', 'sick', 'waldkauz', 'letter', '{}', '[]', '{}', 1, 2)`,
    );
    expect(migrate(db, migrations)).toEqual([24]);
    expect(db.all('SELECT owl_id, since_at FROM owl_unready ORDER BY owl_id')).toEqual([
      { owl_id: 'brood', since_at: 3 * 86_400_000 },
      { owl_id: 'sick', since_at: 5000 },
    ]);
    expect(db.get('SELECT kind, gold, count FROM vouchers')).toEqual({
      kind: 'gold',
      gold: 50,
      count: null,
    });
    expect(db.get('SELECT owl_sex, gold_paid FROM flights')).toEqual({
      owl_sex: 'f',
      gold_paid: 1,
    });
    expect(db.get('SELECT bag_biscuits, bag_treats, letter_retention_days FROM users')).toEqual({
      bag_biscuits: 0,
      bag_treats: 0,
      // Accounts from before keep their period.
      letter_retention_days: 365,
    });
    db.close();
  });
});
