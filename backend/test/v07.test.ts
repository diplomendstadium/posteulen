/**
 * Version 0.7: rest at recipients with replies (8.4, 9.4.2), motivation per leg (9.3a),
 * vouchers (13, 8.10), locks for loan owls (9.6), notice about deleted letters (8.4.1), the
 * homecoming picture as an overlay (9.2.6), the owl that carried a sent letter (8.4) and the
 * daily gold at 03:00 (9.1.1).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { sealLetter, type LetterMeta } from '@posteulen/shared/crypto/letter.ts';
import { GOLD, TIME } from '@posteulen/shared/constants.ts';
import { loanNamesOn } from '@posteulen/shared/game/chance.ts';
import { createVoucher } from '../src/admin/vouchers.ts';
import { loanIdentitiesFor, offerOf } from '../src/owls/lifecycle.ts';
import { loadFlight, routeOf, type FlightRow } from '../src/flights/service.ts';
import { utcDay } from '../src/security/ids.ts';
import {
  advanceTo,
  borrowOwl,
  buyOwl,
  couple,
  HAMBURG,
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

async function send(
  from: Person,
  to: Person[],
  owlId: string,
  rest = 0,
): Promise<{
  status: number;
  body: { letters: { id: string; arrivesAt: number }[]; returnsAt: number | null; code?: string };
}> {
  const prepared = await from.agent.json<Prepared>('POST', '/api/letters/prepare', {
    recipients: to.map((p) => p.id),
    parchment: 'small',
    owlId,
    ...(rest > 0 ? { rest } : {}),
  });
  if (prepared.status !== 200) return prepared as never;
  const items = [];
  for (const letter of prepared.body.letters) {
    const recipient = to.find((p) => p.id === letter.recipientId)!;
    const meta: LetterMeta = {
      letterId: letter.letterId,
      senderId: from.id,
      recipientId: letter.recipientId,
      sentAt: letter.sentAt,
      kind: 'letter',
      parchment: 'small',
    };
    const sealed = await sealLetter(meta, 'Hallo!', {
      senderEd25519Secret: from.identity.ed25519Secret,
      senderX25519Public: from.identity.x25519Public,
      recipientX25519Public: recipient.identity.x25519Public,
    });
    items.push({
      letterId: letter.letterId,
      ciphertext: toBase64Url(sealed.ciphertext),
      wrapRecipient: toBase64Url(sealed.wrapRecipient),
      wrapSender: toBase64Url(sealed.wrapSender),
    });
  }
  return from.agent.json('POST', '/api/letters/send', { token: prepared.body.token, items });
}

function flightOf(owlId: string): FlightRow {
  return app.db.get<FlightRow>(
    'SELECT * FROM flights WHERE owl_id = ? ORDER BY started_at DESC LIMIT 1',
    owlId,
  )!;
}

function owlState(id: string): string | undefined {
  return app.db.get<{ state: string }>('SELECT state FROM owls WHERE id = ?', id)?.state;
}

interface Guest {
  id: string;
  holderId: string;
  holderName: string | null;
  restUntil: number;
  energy: number;
  motivation: number;
}

async function guestsOf(who: Person): Promise<Guest[]> {
  return (await who.agent.json<{ guests: Guest[] }>('GET', '/api/owls')).body.guests;
}

describe('rest at recipients and replies (v0.7, SPEC 8.4)', () => {
  beforeEach(async () => {
    await couple(anna, ben);
    setGold(app, anna, 500);
    setGold(app, ben, 500);
  });

  it('rests at the recipient, is shown there as a guest and flies home when the rest is over', async () => {
    const owl = await buyOwl(app, anna);
    const sent = await send(anna, [ben], owl, 2);
    expect(sent.status).toBe(200);
    const arrives = sent.body.letters[0]!.arrivesAt;
    // The preview and the plan include the full rest: home again after the rest and the way back.
    expect(sent.body.returnsAt! - arrives).toBeGreaterThan(2 * TIME.HOUR);
    advanceTo(app, arrives);
    let route = routeOf(flightOf(owl));
    expect(route[0]).toMatchObject({ status: 'resting', restUntil: arrives + 2 * TIME.HOUR });
    const guests = await guestsOf(ben);
    expect(guests).toEqual([
      expect.objectContaining({ id: owl, holderId: anna.id, holderName: 'Anna' }),
    ]);
    // The holder sees where the owl rests.
    const own = await anna.agent.json<{
      owls: { id: string; absence: { resting: { name: string; until: number } | null } }[];
    }>('GET', '/api/owls');
    expect(own.body.owls.find((o) => o.id === owl)?.absence?.resting).toEqual({
      name: 'Ben',
      until: arrives + 2 * TIME.HOUR,
    });
    advanceTo(app, arrives + 2 * TIME.HOUR);
    route = routeOf(flightOf(owl));
    expect(route[0]!.status).toBe('done');
    expect(await guestsOf(ben)).toEqual([]);
    advanceTo(app, route[1]!.arrivesAt);
    expect(owlState(owl)).toBe('home');
  });

  it('recovers like at home during the rest', async () => {
    const owl = await buyOwl(app, anna, 'elfenkauz');
    app.db.run('UPDATE owls SET energy = 100 WHERE id = ?', owl);
    const sent = await send(anna, [ben], owl, 24);
    advanceTo(app, sent.body.letters[0]!.arrivesAt);
    const before = (await guestsOf(ben))[0]!.energy;
    app.clock.now += 10 * TIME.HOUR;
    // Elf owl: 10 % × 2.0 per hour – full after five hours of rest.
    expect((await guestsOf(ben))[0]!.energy).toBe(100);
    expect(before).toBeLessThan(100);
  });

  it('takes a reply back at once; it arrives with the owl, with a message and one push', async () => {
    const owl = await buyOwl(app, anna);
    const sent = await send(anna, [ben], owl, 24);
    const arrives = sent.body.letters[0]!.arrivesAt;
    advanceTo(app, arrives + TIME.HOUR);
    // The guest is offered first for a letter to its holder, not for gold.
    const preview = await ben.agent.json<{ owls: { id: string; guest?: boolean }[] }>(
      'POST',
      '/api/flights/preview',
      { recipients: [anna.id], guests: true },
    );
    expect(preview.body.owls[0]).toMatchObject({ id: `guest:${owl}`, guest: true });
    expect(
      (
        await ben.agent.json('POST', '/api/gold/prepare', {
          recipient: anna.id,
          amount: 5,
          owlId: `guest:${owl}`,
        })
      ).status,
    ).toBe(400);
    const reply = await send(ben, [anna], `guest:${owl}`);
    expect(reply.status).toBe(200);
    const route = routeOf(flightOf(owl));
    expect(route[0]!.status).toBe('done');
    const home = route[1]!.arrivesAt;
    expect(reply.body.letters[0]!.arrivesAt).toBe(home);
    // A second reply is not possible: the owl has left.
    expect((await send(ben, [anna], `guest:${owl}`)).status).toBe(400);
    app.pushes.length = 0;
    advanceTo(app, home);
    expect(owlState(owl)).toBe('home');
    const letters = await anna.agent.json<{
      letters: { id: string; status: string; owl: { carrier: string } }[];
    }>('GET', `/api/chats/${ben.id}/letters`);
    const received = letters.body.letters.find((l) => l.id === reply.body.letters[0]!.id);
    expect(received).toMatchObject({ status: 'delivered', owl: { carrier: 'own' } });
    // v0.7.2: the homecoming is an overlay (with the number of replies), shown once.
    const homecomings = await anna.agent.json<{ homecomings: { id: string; letters: number }[] }>(
      'GET',
      '/api/homecomings',
    );
    expect(homecomings.body.homecomings).toEqual([expect.objectContaining({ letters: 1 })]);
    await anna.agent.json('POST', '/api/homecomings/seen', {
      ids: homecomings.body.homecomings.map((item) => item.id),
    });
    expect(
      (await anna.agent.json<{ homecomings: unknown[] }>('GET', '/api/homecomings')).body
        .homecomings,
    ).toEqual([]);
    expect(app.pushes).toHaveLength(0); // no subscription in this test, but nothing else either
    // Ben sees on his copy whose owl carried it.
    const benSide = await ben.agent.json<{
      letters: { id: string; owl: { carrier: string; holderName?: string } }[];
    }>('GET', `/api/chats/${anna.id}/letters`);
    expect(benSide.body.letters.find((l) => l.id === reply.body.letters[0]!.id)?.owl).toMatchObject(
      { carrier: 'foreign', holderName: 'Anna' },
    );
    expect(benSide.body.letters.find((l) => l.id === sent.body.letters[0]!.id)?.owl).toMatchObject({
      carrier: 'foreign',
    });
  });

  it('lets each of several recipients give a reply, all to the sender', async () => {
    const carla = await person(app, 'Carla', PARIS);
    await couple(anna, carla);
    const owl = await buyOwl(app, anna);
    const sent = await send(anna, [ben, carla], owl, 1);
    advanceTo(app, sent.body.letters[0]!.arrivesAt);
    expect((await send(ben, [anna], `guest:${owl}`)).status).toBe(200);
    // Ben cannot use the owl for Carla (he does not even know she is next).
    await couple(ben, carla);
    expect((await send(ben, [carla], `guest:${owl}`)).status).toBe(400);
    const route = routeOf(flightOf(owl));
    advanceTo(app, route[1]!.arrivesAt);
    expect((await send(carla, [anna], `guest:${owl}`)).status).toBe(200);
    advanceTo(app, routeOf(flightOf(owl))[2]!.arrivesAt);
    const homecomings = await anna.agent.json<{ homecomings: { letters: number }[] }>(
      'GET',
      '/api/homecomings',
    );
    expect(homecomings.body.homecomings).toEqual([expect.objectContaining({ letters: 2 })]);
  });

  it('a loan owl without a reply vanishes after the rest; with one it brings it first', async () => {
    const loan = await borrowOwl(anna);
    const sent = await send(anna, [ben], loan, 1);
    advanceTo(app, sent.body.letters[0]!.arrivesAt + TIME.HOUR);
    expect(owlState(loan)).toBeUndefined();

    const second = await borrowOwl(anna);
    const again = await send(anna, [ben], second, 1);
    advanceTo(app, again.body.letters[0]!.arrivesAt);
    const reply = await send(ben, [anna], `guest:${second}`);
    expect(reply.status).toBe(200);
    expect(owlState(second)).toBe('flying');
    advanceTo(app, reply.body.letters[0]!.arrivesAt);
    expect(owlState(second)).toBeUndefined();
    const system = await anna.agent.json<{ messages: { type: string; params: unknown }[] }>(
      'GET',
      '/api/system-messages',
    );
    expect(system.body.messages.at(-1)).toMatchObject({
      type: 'loan_back',
      params: { count: 1 },
    });
    const letters = await anna.agent.json<{
      letters: { id: string; status: string; owl: { carrier: string } }[];
    }>('GET', `/api/chats/${ben.id}/letters`);
    expect(letters.body.letters.find((l) => l.id === reply.body.letters[0]!.id)).toMatchObject({
      status: 'delivered',
      owl: { carrier: 'loan' },
    });
  });

  it('the host may care for the guest: pays, raises motivation, the next leg is faster', async () => {
    const owl = await buyOwl(app, anna);
    app.db.run('UPDATE owls SET motivation = 8 WHERE id = ?', owl);
    const sent = await send(anna, [ben], owl, 24);
    advanceTo(app, sent.body.letters[0]!.arrivesAt);
    const homeBefore = routeOf(flightOf(owl))[1]!.arrivesAt;
    const goldBefore = app.db.get<{ gold: number }>(
      'SELECT gold FROM users WHERE id = ?',
      ben.id,
    )!.gold;
    for (const kind of ['water', 'pet', 'feed', 'snack']) {
      expect((await ben.agent.json('POST', `/api/owls/${owl}/${kind}`, {})).status).toBe(200);
    }
    expect(app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', ben.id)!.gold).toBe(
      goldBefore - GOLD.FEED_PRICE - GOLD.SNACK_PRICE,
    );
    expect((await guestsOf(ben))[0]!.motivation).toBe(12);
    // Anna pays nothing and cannot care for her owl while it is away.
    expect((await anna.agent.json('POST', `/api/owls/${owl}/pet`, {})).status).toBe(400);
    // Motivation 1.2 instead of 0.8: the way home after the rest is shorter.
    expect(routeOf(flightOf(owl))[1]!.arrivesAt).toBeLessThan(homeBefore);
    // Nobody else may care for it.
    const carla = await person(app, 'Carla', PARIS);
    expect((await carla.agent.json('POST', `/api/owls/${owl}/pet`, {})).status).toBe(404);
  });

  it('removing the contact ends the rest and returns replies on board', async () => {
    const carla = await person(app, 'Carla', PARIS);
    await couple(anna, carla);
    const owl = await buyOwl(app, anna);
    const sent = await send(anna, [ben, carla], owl, 24);
    advanceTo(app, sent.body.letters[0]!.arrivesAt);
    const reply = await send(ben, [anna], `guest:${owl}`);
    expect(reply.status).toBe(200);
    advanceTo(app, routeOf(flightOf(owl))[1]!.arrivesAt);
    // Carla rests the owl; Anna removes Ben – his reply on board does not arrive.
    await anna.agent.json('DELETE', `/api/contacts/${ben.id}`, {});
    const benSide = await ben.agent.json<{ letters: { id: string; status: string }[] }>(
      'GET',
      `/api/chats/${anna.id}/letters`,
    );
    expect(benSide.body.letters.find((l) => l.id === reply.body.letters[0]!.id)?.status).toBe(
      'returned',
    );
    // Carla removes Anna: the resting owl flies on at once.
    await carla.agent.json('DELETE', `/api/contacts/${anna.id}`, {});
    expect(routeOf(flightOf(owl))[1]!.status).toBe('done');
    expect(await guestsOf(carla)).toEqual([]);
  });

  it('applies the motivation per leg: a new motivation at each stop changes the next leg', async () => {
    const carla = await person(app, 'Carla', PARIS);
    await couple(anna, carla);
    const owl = await buyOwl(app, anna);
    app.db.run('UPDATE owls SET motivation = 12 WHERE id = ?', owl);
    const sent = await send(anna, [ben, carla], owl);
    const toCarla = routeOf(flightOf(owl))[1]!.arrivesAt;
    expect(JSON.parse(flightOf(owl).profile)).toMatchObject({ motivation: 1.2, ownUnits: true });
    // Before reaching Ben the motivation drops to 0.8: from Ben on the owl is slower.
    app.db.run('UPDATE owls SET motivation = 8 WHERE id = ?', owl);
    advanceTo(app, sent.body.letters[0]!.arrivesAt);
    expect(JSON.parse(flightOf(owl).profile)).toMatchObject({ motivation: 0.8 });
    expect(routeOf(flightOf(owl))[1]!.arrivesAt).toBeGreaterThan(toCarla);
  });

  it('offers no rest for letters to bots and never rests a gift', async () => {
    const owl = await buyOwl(app, anna);
    const gift = await anna.agent.json<{ token: string }>('POST', `/api/owls/${owl}/gift/prepare`, {
      recipient: ben.id,
      withCover: false,
    });
    expect(gift.status).toBe(200);
    expect(
      (await anna.agent.json('POST', `/api/owls/${owl}/gift/send`, { token: gift.body.token }))
        .status,
    ).toBe(200);
    const flight = flightOf(owl);
    expect(routeOf(flight)[0]!.rest).toBeUndefined();
  });
});

describe('vouchers (v0.7, SPEC 8.10, 13)', () => {
  it('redeems gold once; a wrong, used or expired code says the same', async () => {
    const { code } = createVoucher(app.ctx, { kind: 'gold', gold: 42 }, app.clock.now);
    const before = app.db.get<{ gold: number }>(
      'SELECT gold FROM users WHERE id = ?',
      anna.id,
    )!.gold;
    const redeemed = await anna.agent.json('POST', '/api/vouchers/redeem', {
      code: code.toLowerCase().replace(/-/g, ' '),
    });
    expect(redeemed.body).toEqual({ kind: 'gold', amount: 42 });
    expect(app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', anna.id)!.gold).toBe(
      before + 42,
    );
    const finance = await anna.agent.json<{ transactions: { type: string; amount: number }[] }>(
      'GET',
      '/api/finance',
    );
    expect(finance.body.transactions[0]).toMatchObject({ type: 'voucher', amount: 42 });
    expect((await ben.agent.json('POST', '/api/vouchers/redeem', { code })).body).toEqual({
      code: 'voucher_invalid',
    });
    expect(
      (await ben.agent.json('POST', '/api/vouchers/redeem', { code: 'AAAA-BBBB-CCCC' })).body,
    ).toEqual({ code: 'voucher_invalid' });
    const old = createVoucher(app.ctx, { kind: 'gold', gold: 1 }, app.clock.now - 91 * TIME.DAY);
    expect((await ben.agent.json('POST', '/api/vouchers/redeem', { code: old.code })).body).toEqual(
      { code: 'voucher_invalid' },
    );
    // Who redeemed it is not stored.
    expect(JSON.stringify(app.db.all('SELECT * FROM vouchers'))).not.toContain(anna.id);
  });

  it('an owl voucher brings an unnamed owl of that species, also beyond the owl limit', async () => {
    const { code } = createVoucher(app.ctx, { kind: 'owl', species: 'phoenix' }, app.clock.now);
    const redeemed = await anna.agent.json('POST', '/api/vouchers/redeem', { code });
    expect(redeemed.body).toEqual({ kind: 'owl', species: 'phoenix' });
    const owls = await anna.agent.json<{ owls: { species: string; name: string | null }[] }>(
      'GET',
      '/api/owls',
    );
    expect(owls.body.owls).toContainEqual(
      expect.objectContaining({ species: 'phoenix', name: null }),
    );
    const random = createVoucher(app.ctx, { kind: 'owl', species: 'random' }, app.clock.now);
    const second = await anna.agent.json<{ species: string }>('POST', '/api/vouchers/redeem', {
      code: random.code,
    });
    expect(second.body.species).not.toBe('phoenix');
  });
});

describe('loan owls are locked for two days (v0.7, SPEC 9.6)', () => {
  it('offers no species of the two days before', () => {
    let at = app.clock.now;
    const previous: string[][] = [];
    for (let day = 0; day < 20; day++) {
      const offer = offerOf(app.ctx, utcDay(at));
      for (const before of previous.slice(-2))
        for (const s of offer) expect(before).not.toContain(s);
      previous.push(offer);
      at += TIME.DAY;
    }
  });

  it('gives no name again on the two following days (both languages)', async () => {
    const names = (day: string): string[] =>
      [...loanIdentitiesFor(app.ctx, anna.id, day).values()].map((identity) => identity.name);
    let at = app.clock.now;
    for (let day = 0; day < 10; day++) {
      const today = names(utcDay(at));
      expect(new Set(today).size).toBe(today.length);
      for (const later of [1, 2]) {
        const next = names(utcDay(at + later * TIME.DAY));
        for (const name of today) expect(next).not.toContain(name);
      }
      at += TIME.DAY;
    }
    // The groups of the German and English lists match name by name.
    expect(loanNamesOn('2026-11-05', ['a', 'b', 'c', 'd'])).toHaveLength(
      loanNamesOn('2026-11-05', ['A', 'B', 'C', 'D']).length,
    );
  });
});

describe('notice about deleted letters (v0.7, SPEC 8.4.1)', () => {
  it('tells how many letters from which chats were deleted, only when there were some', async () => {
    app.ctx.queue.ensureDailyJobs();
    await couple(anna, ben);
    setGold(app, anna, 500);
    const owl = await buyOwl(app, anna);
    const sent = await send(anna, [ben], owl);
    advanceTo(app, routeOf(flightOf(owl))[1]!.arrivesAt);
    const count = (who: Person) =>
      app.db.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM system_messages WHERE user_id = ? AND type = 'letters_purged'",
        who.id,
      )!.n;
    // Ben keeps his letters a year; Anna chooses 30 days.
    await anna.agent.json('PATCH', '/api/account/letters', { retentionDays: 30, print: false });
    expect(count(anna)).toBe(0);
    // Keep the session alive (30 days without use end it).
    advanceTo(app, sent.body.letters[0]!.arrivesAt + 15 * TIME.DAY);
    await anna.agent.json('GET', '/api/system-messages');
    advanceTo(app, sent.body.letters[0]!.arrivesAt + 31 * TIME.DAY);
    const messages = await anna.agent.json<{
      messages: { type: string; params: Record<string, unknown> }[];
    }>('GET', '/api/system-messages');
    expect(messages.body.messages.find((m) => m.type === 'letters_purged')?.params).toEqual({
      count: 1,
      chats: JSON.stringify(['Ben']),
    });
    expect(count(ben)).toBe(0);
  });
});

describe('daily gold moves to 03:00 (v0.7, SPEC 9.1.1)', () => {
  it('moves a job still planned for 15:00 to 03:00 of the same day without paying twice', () => {
    app.ctx.queue.ensureDailyJobs();
    // As left behind by v0.6: the next run today at 15:00.
    const at15 = Date.UTC(2026, 10, 5, 15);
    app.db.run(
      "UPDATE scheduled_events SET due_at = ?, logical_at = ? WHERE type = 'daily:daily_gold'",
      at15,
      at15,
    );
    app.ctx.queue.ensureDailyJobs();
    const event = app.db.get<{ due_at: number }>(
      "SELECT due_at FROM scheduled_events WHERE type = 'daily:daily_gold'",
    )!;
    expect(event.due_at).toBe(Date.UTC(2026, 10, 5, 3));
    const before = app.db.get<{ gold: number }>(
      'SELECT gold FROM users WHERE id = ?',
      anna.id,
    )!.gold;
    advanceTo(app, app.clock.now);
    advanceTo(app, Date.UTC(2026, 10, 5, 20));
    const after = app.db.get<{ gold: number }>(
      'SELECT gold FROM users WHERE id = ?',
      anna.id,
    )!.gold;
    expect(after - before).toBe(GOLD.DAILY);
  });
});

describe('flight state helpers', () => {
  it('loads flights again by ID', async () => {
    await couple(anna, ben);
    setGold(app, anna, 500);
    const owl = await buyOwl(app, anna);
    await send(anna, [ben], owl);
    expect(loadFlight(app.ctx, flightOf(owl).id)?.owl_id).toBe(owl);
  });
});
