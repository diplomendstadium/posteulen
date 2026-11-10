/**
 * Version 0.5: motivation of owls, water and favourite snack, care days with two interactions,
 * the phoenix, sleeping only as long as needed, unreadable letters.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GOLD, TIME } from '@posteulen/shared/constants.ts';
import { utcDay } from '../src/security/ids.ts';
import { afterReturnHome } from '../src/owls/lifecycle.ts';
import {
  advanceTo,
  borrowOwl,
  buyOwl,
  couple,
  PARIS,
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
  ben = await person(app, 'Ben', PARIS);
  withoutBots(app);
});
afterEach(async () => {
  await app.close();
});

interface OwlView {
  id: string;
  energy: number;
  motivation: number;
  wateredToday: boolean;
  snackedToday: boolean;
  actions: { menagerie: boolean; care: boolean };
}

const owlOf = (row: { owl: OwlView }) => row.owl;
const act = async (who: Person, id: string, kind: string) =>
  who.agent.json<{ owl: OwlView; code?: string }>('POST', `/api/owls/${id}/${kind}`, {});
const motivation = (id: string) =>
  app.db.get<{ motivation: number }>('SELECT motivation FROM owls WHERE id = ?', id)?.motivation;
const gold = (who: Person) =>
  app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', who.id)?.gold ?? 0;

const sendGold = async (owlId: string) => {
  const prepared = await anna.agent.json<{ token: string }>('POST', '/api/gold/prepare', {
    recipient: ben.id,
    amount: 5,
    owlId,
    withCover: false,
  });
  return anna.agent.json<{ arrivesAt: number }>('POST', '/api/gold/send', {
    token: prepared.body.token,
  });
};

describe('motivation and the four interactions (v0.5)', () => {
  it('bought owls start at 1.0; each kind raises it once a day, capped at 1.2', async () => {
    setGold(app, anna, 200);
    const id = await buyOwl(app, anna);
    expect(motivation(id)).toBe(10);
    expect(owlOf((await act(anna, id, 'water')).body).motivation).toBe(11);
    expect((await act(anna, id, 'water')).body).toMatchObject({ code: 'owl_watered_today' });
    await act(anna, id, 'pet');
    await act(anna, id, 'pet'); // petting stays free and unlimited, but counts once
    expect(motivation(id)).toBe(12);
    await act(anna, id, 'feed');
    expect(motivation(id)).toBe(12);
    const before = gold(anna);
    app.db.run('UPDATE owls SET energy = 100, energy_at = ? WHERE id = ?', app.clock.now, id);
    const snacked = owlOf((await act(anna, id, 'snack')).body);
    // Waldkauz: +20 % × 1.25 of 540 = 135, for 0.2 gold.
    expect(snacked.energy).toBe(235);
    expect(snacked.snackedToday).toBe(true);
    expect(gold(anna)).toBe(before - GOLD.SNACK_PRICE);
    expect((await act(anna, id, 'snack')).body).toMatchObject({ code: 'owl_snacked_today' });
  });

  it('sinks by 0.1 every night, never below 0.8 – also while the owl is away', async () => {
    setGold(app, anna, 200);
    const id = await buyOwl(app, anna);
    app.ctx.queue.ensureDailyJobs();
    app.db.run("UPDATE owls SET state = 'flying' WHERE id = ?", id);
    const midnight = Date.parse(`${utcDay(app.clock.now + TIME.DAY)}T00:00:00Z`);
    advanceTo(app, midnight + TIME.MINUTE);
    expect(motivation(id)).toBe(9);
    advanceTo(app, midnight + 5 * TIME.DAY);
    expect(motivation(id)).toBe(8);
  });

  it('v0.5.1: remembers the time of the last interaction (no nap picture right after it)', async () => {
    setGold(app, anna, 200);
    const id = await buyOwl(app, anna);
    const before = await anna.agent.json<{ owls: (OwlView & { caredAt: number | null })[] }>(
      'GET',
      '/api/owls',
    );
    expect(before.body.owls.find((owl) => owl.id === id)?.caredAt).toBeNull();
    app.clock.now += TIME.MINUTE;
    const petted = await act(anna, id, 'pet');
    expect((petted.body.owl as OwlView & { caredAt: number }).caredAt).toBe(app.clock.now);
  });

  it('a care day needs two different interactions', async () => {
    setGold(app, anna, 200);
    const id = await buyOwl(app, anna);
    const days = () =>
      app.db.all<{ day: string }>('SELECT day FROM owl_care_days WHERE owl_id = ?', id);
    await act(anna, id, 'pet');
    await act(anna, id, 'pet');
    expect(days()).toEqual([]);
    await act(anna, id, 'snack');
    expect(days()).toEqual([{ day: utcDay(app.clock.now) }]);
  });

  it('loan owls come with 0.8 to 1.0, as derived for the day', async () => {
    const id = await borrowOwl(anna);
    expect([8, 9, 10]).toContain(motivation(id));
  });
});

describe('motivation on a flight (v0.5)', () => {
  it('fixed at departure: speed, energy and recovery for the whole trip', async () => {
    await couple(anna, ben);
    setGold(app, anna, 500);
    const slow = await buyOwl(app, anna, 'waldkauz', 'Langsam');
    const fast = await buyOwl(app, anna, 'waldkauz', 'Flott');
    app.db.run('UPDATE owls SET motivation = 8, energy = 540 WHERE id = ?', slow);
    app.db.run('UPDATE owls SET motivation = 12, energy = 540 WHERE id = ?', fast);
    const preview = await anna.agent.json<{ owls: { id: string; arrivals: { at: number }[] }[] }>(
      'POST',
      '/api/flights/preview',
      { recipients: [ben.id] },
    );
    const arrival = (id: string) =>
      preview.body.owls.find((owl) => owl.id === id)?.arrivals[0]?.at ?? 0;
    expect(arrival(fast)).toBeLessThan(arrival(slow));
    const sent = await sendGold(fast);
    expect(sent.status).toBe(200);
    const profile = JSON.parse(
      app.db.get<{ profile: string }>('SELECT profile FROM flights')!.profile,
    ) as { motivation: number; maxEnergy: number; speedKmh: number; recoveryPerHour: number };
    expect(profile).toMatchObject({ motivation: 1.2, maxEnergy: 648, speedKmh: 33 });
    // 10 % × 1.25 × 1.2 of the motivated maximum per hour.
    expect(profile.recoveryPerHour).toBeCloseTo(648 * 0.1 * 1.25 * 1.2, 5);
    // The motivation sinks during the trip, the trip keeps its values; back home the energy
    // is the owl's own again (never above its maximum).
    advanceTo(app, app.clock.now + 10 * TIME.DAY);
    const home = app.db.get<{ state: string; energy: number }>(
      'SELECT state, energy FROM owls WHERE id = ?',
      fast,
    );
    expect(home?.state).toBe('home');
    expect(home?.energy).toBeLessThanOrEqual(540);
  });
});

describe('the phoenix (v0.5)', () => {
  it('can be bought, but not lent to the Menagerie, and never lays eggs', async () => {
    setGold(app, anna, 2000);
    const id = await buyOwl(app, anna, 'phoenix', 'Funkenflug');
    const list = await anna.agent.json<{ owls: OwlView[] }>('GET', '/api/owls');
    expect(list.body.owls.find((owl) => owl.id === id)?.actions.menagerie).toBe(false);
    expect((await anna.agent.json('POST', `/api/owls/${id}/menagerie`, {})).status).toBe(400);
    app.db.run("UPDATE owls SET sex = 'f' WHERE id = ?", id);
    const random = app.ctx.random;
    app.ctx.random = () => 0; // would always lay eggs
    try {
      afterReturnHome(app.ctx, id, app.clock.now, (work) => work());
    } finally {
      app.ctx.random = random;
    }
    expect(app.db.get<{ state: string }>('SELECT state FROM owls WHERE id = ?', id)?.state).toBe(
      'home',
    );
  });

  it('v0.5.1: the owl list says whether an owl on its way is asleep right now', async () => {
    await couple(anna, ben);
    setGold(app, anna, 500);
    const id = await buyOwl(app, anna);
    app.db.run('UPDATE owls SET energy = 20 WHERE id = ?', id);
    const sent = await sendGold(id);
    expect(sent.status).toBe(200);
    const plan = JSON.parse(app.db.get<{ plan: string }>('SELECT plan FROM flights')!.plan) as {
      kind: string;
      t0: number;
      t1: number;
    }[];
    const sleep = plan.find((segment) => segment.kind === 'sleep')!;
    const absence = async () =>
      (
        await anna.agent.json<{ owls: { id: string; absence: { sleeping: boolean } | null }[] }>(
          'GET',
          '/api/owls',
        )
      ).body.owls.find((owl) => owl.id === id)?.absence;
    app.clock.now = (sleep.t0 + sleep.t1) / 2;
    expect((await absence())?.sleeping).toBe(true);
    app.clock.now = sleep.t1 + TIME.MINUTE;
    expect((await absence())?.sleeping).toBe(false);
  });

  it('flies a long way fast: Berlin → Paris within a day', async () => {
    await couple(anna, ben);
    setGold(app, anna, 2000);
    const id = await buyOwl(app, anna, 'phoenix', 'Funkenflug');
    app.db.run('UPDATE owls SET energy = 2000 WHERE id = ?', id);
    const start = app.clock.now;
    const preview = await anna.agent.json<{ owls: { id: string; arrivals: { at: number }[] }[] }>(
      'POST',
      '/api/flights/preview',
      { recipients: [ben.id] },
    );
    const at = preview.body.owls.find((owl) => owl.id === id)?.arrivals[0]?.at ?? 0;
    // About 880 km at 100 km/h without a sleep.
    expect(at - start).toBeLessThan(10 * TIME.HOUR);
  });
});

describe('unreadable letters (v0.5)', () => {
  it('the recipient reports them; the sender sees it instead of "read"', async () => {
    await couple(anna, ben);
    app.db.run(
      `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, ciphertext,
                            wrap_recipient, wrap_sender, status, owl_name, owl_species)
       VALUES ('brokenLetterAAAAAAAAAA', ?, ?, 'letter', 'small', ?, ?, x'00', x'00', x'00', 'delivered',
               'Momo', 'waldkauz')`,
      anna.id,
      ben.id,
      app.clock.now,
      app.clock.now,
    );
    // Only the recipient can report it.
    await anna.agent.json('POST', '/api/letters/unreadable', { ids: ['brokenLetterAAAAAAAAAA'] });
    expect(
      app.db.get<{ read: number }>("SELECT read FROM letters WHERE id = 'brokenLetterAAAAAAAAAA'")
        ?.read,
    ).toBe(0);
    await ben.agent.json('POST', '/api/letters/unreadable', { ids: ['brokenLetterAAAAAAAAAA'] });
    const seen = await anna.agent.json<{
      letters: { id: string; read: boolean; unreadable: boolean }[];
    }>('GET', `/api/chats/${ben.id}/letters`);
    expect(seen.body.letters.find((l) => l.id === 'brokenLetterAAAAAAAAAA')).toMatchObject({
      read: false, // v0.8.2: the sender only learns that the letter was lost
      unreadable: true,
    });
  });
});
