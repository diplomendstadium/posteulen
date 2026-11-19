/**
 * Version 1.2.4: long parchment for free, kilometres of own owls (counted and backfilled), the
 * history of broadcasts for 180 days, new pushes (contact connected, donation request, sick
 * owl) and pushes that are tried again after passing errors.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { sealLetter, type LetterMeta } from '@posteulen/shared/crypto/letter.ts';
import { BROADCAST, DONATION, SECURITY, TIME } from '@posteulen/shared/constants.ts';
import { flownKm, type Segment } from '@posteulen/shared/game/flight.ts';
import { pruneBroadcasts, sendBroadcast } from '../src/admin/operations.ts';
import { afterReturnHome } from '../src/owls/lifecycle.ts';
import { backfillFlownKm } from '../src/owls/distance.ts';
import { isTemporary, PushService, type RetryTimer } from '../src/push/service.ts';
import type { SendResult } from '../src/push/transport.ts';
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

interface Prepared {
  token: string;
  letters: { recipientId: string; letterId: string; sentAt: number }[];
}

async function send(from: Person, to: Person, owlId: string, parchment: 'small' | 'large') {
  const prepared = await from.agent.json<Prepared>('POST', '/api/letters/prepare', {
    recipients: [to.id],
    parchment,
    owlId,
  });
  expect(prepared.status, JSON.stringify(prepared.body)).toBe(200);
  const letter = prepared.body.letters[0]!;
  const meta: LetterMeta = {
    letterId: letter.letterId,
    senderId: from.id,
    recipientId: to.id,
    sentAt: letter.sentAt,
    kind: 'letter',
    parchment,
  };
  const sealed = await sealLetter(meta, 'Hallo!', {
    senderEd25519Secret: from.identity.ed25519Secret,
    senderX25519Public: from.identity.x25519Public,
    recipientX25519Public: to.identity.x25519Public,
  });
  return from.agent.json<{ letters: { arrivesAt: number }[]; returnsAt: number | null }>(
    'POST',
    '/api/letters/send',
    {
      token: prepared.body.token,
      items: [
        {
          letterId: letter.letterId,
          ciphertext: toBase64Url(sealed.ciphertext),
          wrapRecipient: toBase64Url(sealed.wrapRecipient),
          wrapSender: toBase64Url(sealed.wrapSender),
        },
      ],
    },
  );
}

function gold(who: Person): number {
  return app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', who.id)?.gold ?? -1;
}

function notificationTypes(who: Person): string[] {
  return app.db
    .all<{
      type: string;
    }>(
      "SELECT type FROM notifications WHERE user_id = ? AND type != 'push_test' ORDER BY created_at",
      who.id,
    )
    .map((row) => row.type);
}

describe('long parchment (v1.2.4, SPEC 5.9)', () => {
  it('costs nothing; the owl only has to carry it', async () => {
    await couple(anna, ben);
    setGold(app, anna, 500);
    // The Waldkauz carries the long parchment, the Waldohreule only the short one now.
    const waldkauz = await buyOwl(app, anna, 'waldkauz', 'Waldi');
    const waldohreule = await buyOwl(app, anna, 'waldohreule', 'Ohri');
    const before = gold(anna);
    expect((await send(anna, ben, waldkauz, 'large')).status).toBe(200);
    expect(gold(anna)).toBe(before);
    expect(
      app.db.all(
        "SELECT 1 FROM transactions WHERE user_id = ? AND type = 'large_parchment'",
        anna.id,
      ),
    ).toEqual([]);
    const refused = await anna.agent.json('POST', '/api/letters/prepare', {
      recipients: [ben.id],
      parchment: 'large',
      owlId: waldohreule,
    });
    expect(refused.body).toMatchObject({ code: 'owl_cannot_carry' });
  });
});

describe('kilometres of own owls (v1.2.4, SPEC 9.2)', () => {
  it('grow by the flown distance of every finished flight, only for own owls', async () => {
    await couple(anna, ben);
    setGold(app, anna, 1000);
    const id = await buyOwl(app, anna, 'virginiauhu', 'Uhu');
    app.db.run('UPDATE owls SET energy = 1300 WHERE id = ?', id);
    const owlKm = async () =>
      (
        await anna.agent.json<{ owls: { id: string; km: number | null }[] }>('GET', '/api/owls')
      ).body.owls.find((owl) => owl.id === id)?.km;
    expect(await owlKm()).toBe(0);
    const sent = await send(anna, ben, id, 'small');
    const flight = app.db.get<{ plan: string }>(
      "SELECT plan FROM flights WHERE owl_id = ? AND state = 'active'",
      id,
    )!;
    advanceTo(app, sent.body.returnsAt! + TIME.MINUTE);
    const flown = app.db.get<{ km_flown: number; plan: string }>(
      'SELECT o.km_flown, f.plan FROM owls o JOIN flights f ON f.owl_id = o.id WHERE o.id = ?',
      id,
    )!;
    // Berlin – Hamburg and back: roughly 2 × 255 km along the plan.
    expect(flown.km_flown).toBeCloseTo(flownKm(JSON.parse(flown.plan) as Segment[]), 6);
    expect(flown.km_flown).toBeGreaterThanOrEqual(
      flownKm(JSON.parse(flight.plan) as Segment[]) - 1e-6,
    );
    expect(flown.km_flown).toBeGreaterThan(450);
    expect(flown.km_flown).toBeLessThan(560);
    expect(await owlKm()).toBe(Math.round(flown.km_flown));
  });

  it('are backfilled once from the flights before the update', async () => {
    setGold(app, anna, 500);
    const id = await buyOwl(app, anna, 'waldkauz', 'Waldi');
    const plan: Segment[] = [
      {
        kind: 'fly',
        t0: 0,
        t1: 1,
        from: { lat: 52.52, lon: 13.4 },
        to: { lat: 53.55, lon: 9.99 },
        e0: 0,
        e1: 0,
      },
      { kind: 'sleep', t0: 1, t1: 2, at: { lat: 53.55, lon: 9.99 }, e0: 0, e1: 0 },
    ];
    app.db.run(
      `INSERT INTO flights (id, holder_id, owl_id, owl_kind, owl_name, owl_species, purpose, profile, route,
                            plan, started_at, ends_at, state)
       VALUES ('old-flight-000000000000', ?, ?, 'own', 'Waldi', 'waldkauz', 'letter', '{}', '[]', ?, 1, 2, 'done')`,
      anna.id,
      id,
      JSON.stringify(plan),
    );
    // The start of this test app already counted (nothing); a new count needs a fresh flag.
    expect(backfillFlownKm(app.ctx)).toBe(0);
    app.db.run("DELETE FROM meta WHERE key = 'km_backfill'");
    expect(backfillFlownKm(app.ctx)).toBe(1);
    expect(backfillFlownKm(app.ctx)).toBe(0);
    const km = app.db.get<{ km_flown: number }>(
      'SELECT km_flown FROM owls WHERE id = ?',
      id,
    )!.km_flown;
    expect(km).toBeCloseTo(flownKm(plan), 6);
    expect(km).toBeGreaterThan(250);
  });

  it('are not shown for loan owls', async () => {
    setGold(app, anna, 500);
    const menagerie = await anna.agent.json<{ offer: { species: string }[] }>(
      'GET',
      '/api/menagerie',
    );
    await anna.agent.json('POST', '/api/menagerie/loan', {
      species: menagerie.body.offer[0]!.species,
    });
    const owls = await anna.agent.json<{ owls: { kind: string; km: number | null }[] }>(
      'GET',
      '/api/owls',
    );
    expect(owls.body.owls.find((owl) => owl.kind === 'loan')?.km).toBeNull();
  });
});

describe('history of broadcasts (v1.2.4, SPEC 13 item 6)', () => {
  it('keeps an entry for 180 days', () => {
    const start = app.clock.now;
    sendBroadcast(app.ctx, 'Alt', start);
    sendBroadcast(app.ctx, 'Neu', start + 10 * TIME.DAY);
    pruneBroadcasts(app.ctx, start + BROADCAST.HISTORY_DAYS * TIME.DAY + TIME.HOUR);
    expect(app.db.all<{ text: string }>('SELECT text FROM broadcasts')).toEqual([{ text: 'Neu' }]);
    // Eleven days later the newer one has gone as well.
    pruneBroadcasts(app.ctx, start + (BROADCAST.HISTORY_DAYS + 11) * TIME.DAY);
    expect(app.db.all('SELECT text FROM broadcasts')).toEqual([]);
  });
});

describe('new pushes (v1.2.4, SPEC 11.2)', () => {
  it('tells the one who added first that both are connected', async () => {
    await couple(anna, ben);
    expect(notificationTypes(anna)).toEqual(['contact_confirmed']);
    expect(notificationTypes(ben)).toEqual([]);
  });

  it('comes with the request for donations', () => {
    advanceTo(app, app.clock.now + (DONATION.INTERVAL_DAYS + 1) * TIME.DAY);
    expect(notificationTypes(anna)).toContain('donation');
  });

  it('comes when an own adult owl falls ill', async () => {
    setGold(app, anna, 500);
    const id = await buyOwl(app, anna, 'waldkauz', 'Waldi');
    app.db.run("UPDATE owls SET sex = 'm', pending_sickness = 1 WHERE id = ?", id);
    app.db.transaction(() => afterReturnHome(app.ctx, id, app.clock.now, (work) => work()));
    expect(notificationTypes(anna)).toEqual(['owl_sick']);
    expect(app.db.get<{ state: string }>('SELECT state FROM owls WHERE id = ?', id)?.state).toBe(
      'sick',
    );
  });
});

describe('pushes tried again (v1.2.4, SPEC 11.3)', () => {
  function subscribe(who: Person): void {
    app.db.run(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
       VALUES (?, 'https://push.example.org/x', 'p', 'a', ?)`,
      who.id,
      app.clock.now,
    );
  }

  function service(results: SendResult[]) {
    const timers: { work: () => void; ms: number }[] = [];
    const timer: RetryTimer = (work, ms) => {
      timers.push({ work, ms });
      return () => undefined;
    };
    let calls = 0;
    const push = new PushService(
      app.ctx,
      () => Promise.resolve(results[Math.min(calls++, results.length - 1)]!),
      timer,
    );
    const notify = (type: 'letter_arrived' | 'push_test' = 'letter_arrived') =>
      push.notify(anna.id, type, null, app.clock.now, (work) => work());
    const state = (id: string) =>
      app.db.get<{ push_state: string; push_attempts: number }>(
        'SELECT push_state, push_attempts FROM notifications WHERE id = ?',
        id,
      );
    return { push, timers, notify, state, calls: () => calls };
  }

  it('classifies passing and lasting errors', () => {
    expect(isTemporary({ error: 'ECONNRESET' })).toBe(true);
    expect(isTemporary({ error: 'private address', permanent: true })).toBe(false);
    for (const status of [408, 429, 500, 503]) expect(isTemporary({ status })).toBe(true);
    for (const status of [400, 403, 404, 410, 413]) expect(isTemporary({ status })).toBe(false);
  });

  it('waits longer each time and stays pending meanwhile', async () => {
    subscribe(anna);
    const { push, timers, notify, state } = service([
      { status: 503 },
      { error: 'ECONNRESET' },
      { status: 201 },
    ]);
    const id = notify();
    await push.idle();
    expect(state(id)).toEqual({ push_state: 'pending', push_attempts: 1 });
    expect(timers.map((t) => t.ms)).toEqual([SECURITY.PUSH_RETRY_MINUTES[0]! * TIME.MINUTE]);
    timers[0]!.work();
    await push.idle();
    expect(state(id)).toEqual({ push_state: 'pending', push_attempts: 2 });
    expect(timers[1]!.ms).toBe(SECURITY.PUSH_RETRY_MINUTES[1]! * TIME.MINUTE);
    expect(timers[1]!.ms).toBeGreaterThan(timers[0]!.ms);
    timers[1]!.work();
    await push.idle();
    expect(state(id)).toEqual({ push_state: 'sent', push_attempts: 2 });
  });

  it('gives up after the last wait or a day, and never retries lasting errors or the test', async () => {
    subscribe(anna);
    const always = service([{ status: 500 }]);
    const id = always.notify();
    await always.push.idle();
    for (let i = 0; i < SECURITY.PUSH_RETRY_MINUTES.length; i++) {
      always.timers[i]!.work();
      await always.push.idle();
    }
    expect(always.state(id)?.push_state).toBe('failed');
    expect(always.timers).toHaveLength(SECURITY.PUSH_RETRY_MINUTES.length);

    const late = service([{ status: 500 }]);
    const old = late.notify();
    app.clock.now += TIME.DAY - TIME.MINUTE / 2;
    await late.push.idle();
    // The first attempt went out at once; a retry after a minute would be past the day.
    expect(late.state(old)?.push_state).toBe('failed');

    for (const result of [
      { status: 410 },
      { status: 400 },
      { error: 'https on 443 only', permanent: true as const },
    ]) {
      const lasting = service([result]);
      const one = lasting.notify();
      await lasting.push.idle();
      expect(lasting.state(one)?.push_state).toBe('failed');
      expect(lasting.timers).toEqual([]);
      if ('status' in result && result.status === 410) subscribe(anna);
    }

    const test = service([{ status: 503 }]);
    const probe = test.notify('push_test');
    await test.push.idle();
    expect(test.state(probe)?.push_state).toBe('failed');
    expect(test.timers).toEqual([]);
  });

  it('sends pending ones again after a restart, also those waiting for a retry', async () => {
    subscribe(anna);
    const first = service([{ status: 503 }]);
    const id = first.notify();
    await first.push.idle();
    first.push.stop();
    const second = service([{ status: 201 }]);
    second.push.resendPending(app.clock.now);
    await second.push.idle();
    expect(second.state(id)?.push_state).toBe('sent');
  });
});
