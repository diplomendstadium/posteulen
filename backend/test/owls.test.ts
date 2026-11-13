import { utcDay } from '../src/security/ids.ts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GOLD, TIME } from '@posteulen/shared/constants.ts';
import { toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { sealLetter } from '@posteulen/shared/crypto/letter.ts';
import { rerouteForMove } from '../src/flights/service.ts';
import {
  withoutBots,
  advanceTo,
  borrowOwl,
  NO_OWL,
  buyOwl,
  couple,
  HAMBURG,
  PARIS,
  person,
  setGold,
  testApp,
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
  await couple(anna, ben);
  withoutBots(app);
});
afterEach(async () => {
  await app.close();
});

interface OwlView {
  id: string;
  name: string | null;
  species: string;
  state: string;
  energy: number;
  maxEnergy: number;
  fedToday: boolean;
  ready: boolean;
  actions: { care: boolean; gift: boolean; release: boolean; rename: boolean };
  absence: { purpose: string; recipients: (string | null)[]; returnsAt: number | null } | null;
}

async function owls(who: Person): Promise<OwlView[]> {
  return (await who.agent.json<{ owls: OwlView[] }>('GET', '/api/owls')).body.owls;
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

async function sealedFor(
  from: Person,
  to: Person,
  prepared: { letters: { letterId: string; sentAt: number }[] },
  kind: 'cover_gold' | 'cover_owl',
  text: string,
) {
  const letter = prepared.letters[0]!;
  const sealed = await sealLetter(
    {
      letterId: letter.letterId,
      senderId: from.id,
      recipientId: to.id,
      sentAt: letter.sentAt,
      kind,
      parchment: 'small',
    },
    text,
    {
      senderEd25519Secret: from.identity.ed25519Secret,
      senderX25519Public: from.identity.x25519Public,
      recipientX25519Public: to.identity.x25519Public,
    },
  );
  return {
    letterId: letter.letterId,
    ciphertext: toBase64Url(sealed.ciphertext),
    wrapRecipient: toBase64Url(sealed.wrapRecipient),
    wrapSender: toBase64Url(sealed.wrapSender),
  };
}

async function sendGold(
  from: Person,
  to: Person,
  amount: number,
  owlId: string,
  cover?: string,
): Promise<{ status: number; body: { arrivesAt?: number; code?: string } }> {
  const prepared = await from.agent.json<{
    token: string;
    letters: { letterId: string; sentAt: number }[];
    code?: string;
  }>('POST', '/api/gold/prepare', {
    recipient: to.id,
    amount,
    owlId,
    withCover: cover !== undefined,
  });
  if (prepared.status !== 200) return prepared as never;
  return from.agent.json('POST', '/api/gold/send', {
    token: prepared.body.token,
    ...(cover !== undefined
      ? { cover: await sealedFor(from, to, prepared.body, 'cover_gold', cover) }
      : {}),
  });
}

async function gift(from: Person, to: Person, owlId: string, cover?: string) {
  const prepared = await from.agent.json<{
    token: string;
    letters: { letterId: string; sentAt: number }[];
  }>('POST', `/api/owls/${owlId}/gift/prepare`, {
    recipient: to.id,
    withCover: cover !== undefined,
  });
  if (prepared.status !== 200) return prepared;
  return from.agent.json<{ arrivesAt: number }>('POST', `/api/owls/${owlId}/gift/send`, {
    token: prepared.body.token,
    ...(cover !== undefined
      ? { cover: await sealedFor(from, to, prepared.body, 'cover_owl', cover) }
      : {}),
  });
}

describe('buying and naming owls (SPEC 9.2.3, 9.2.4)', () => {
  it('needs full cover, records the purchase and asks for a name', async () => {
    expect(
      (await anna.agent.json('POST', '/api/owls/buy', { species: 'waldkauz' })).body,
    ).toMatchObject({
      code: 'gold_insufficient',
    });
    setGold(app, anna, 100);
    const bought = await anna.agent.json<{ owl: OwlView }>('POST', '/api/owls/buy', {
      species: 'waldkauz',
    });
    expect(bought.status).toBe(200);
    expect(bought.body.owl).toMatchObject({
      name: null,
      ready: false,
      state: 'home',
      maxEnergy: 540,
    });
    expect(bought.body.owl.energy).toBeGreaterThanOrEqual(324);
    expect(bought.body.owl.energy).toBeLessThanOrEqual(540);
    expect(gold(anna)).toBe(40);
    const finance = await anna.agent.json<{ transactions: { type: string; amount: number }[] }>(
      'GET',
      '/api/finance',
    );
    expect(finance.body.transactions[0]).toMatchObject({ type: 'owl_purchase', amount: -60 });
    expect((await anna.agent.json('POST', '/api/owls/buy', { species: 'drache' })).status).toBe(
      400,
    );

    const id = bought.body.owl.id;
    expect(
      (await anna.agent.json('POST', `/api/owls/${id}/name`, { name: 'W' })).body,
    ).toMatchObject({
      code: 'owl_name_too_short',
    });
    expect((await anna.agent.json('POST', `/api/owls/${id}/name`, { name: 'Waldi' })).status).toBe(
      200,
    );
    // First naming is free; one rename per calendar year.
    expect(
      (await anna.agent.json('POST', `/api/owls/${id}/name`, { name: 'Wald Emma' })).status,
    ).toBe(200);
    expect(
      (await anna.agent.json('POST', `/api/owls/${id}/name`, { name: 'Nochmal' })).body,
    ).toMatchObject({
      code: 'owl_rename_blocked',
    });
    // A new calendar year (the session would have expired meanwhile).
    app.db.run('UPDATE owls SET renamed_year = 2025 WHERE id = ?', id);
    expect(
      (await anna.agent.json('POST', `/api/owls/${id}/name`, { name: 'Neujahr' })).status,
    ).toBe(200);
    expect((await owls(anna))[0]).toMatchObject({ name: 'Neujahr', ready: true });
  });

  it('allows at most 50 own owls', async () => {
    setGold(app, anna, 10_000);
    for (let i = 0; i < 50; i++) {
      app.db.run(
        `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at)
         VALUES (?, ?, 'own', 'waldkauz', 'f', 'X', 100, 0, '2026-11-05', 0)`,
        `owl${String(i).padStart(19, '0')}`,
        anna.id,
      );
    }
    expect((await anna.agent.json<{ canBuy: boolean }>('GET', '/api/owls')).body.canBuy).toBe(
      false,
    );
    expect(
      (await anna.agent.json('POST', '/api/owls/buy', { species: 'waldkauz' })).body,
    ).toMatchObject({
      code: 'owl_limit',
    });
  });

  it('hides foreign owls (SPEC 17.3)', async () => {
    setGold(app, anna, 100);
    const id = await buyOwl(app, anna);
    for (const path of ['name', 'feed', 'pet', 'release']) {
      expect(
        (
          await ben.agent.json(
            'POST',
            `/api/owls/${id}/${path}`,
            path === 'name' ? { name: 'Dieb' } : {},
          )
        ).status,
      ).toBe(404);
    }
    expect(await owls(ben)).toEqual([]);
  });
});

describe('energy, feeding, petting, releasing (SPEC 9.3, 9.2.8)', () => {
  it('feeds once per day for 0.1 gold, capped; petting is free', async () => {
    setGold(app, anna, 100);
    const id = await buyOwl(app, anna);
    app.db.run('UPDATE owls SET energy = 100, energy_at = ? WHERE id = ?', app.clock.now, id);
    const fed = await anna.agent.json<{ owl: OwlView }>('POST', `/api/owls/${id}/feed`, {});
    // Waldkauz: +10 % × 1.25 of 540 = 67.5.
    expect(fed.body.owl.energy).toBe(168);
    expect(fed.body.owl.fedToday).toBe(true);
    expect(gold(anna)).toBe(39);
    expect((await anna.agent.json('POST', `/api/owls/${id}/feed`, {})).body).toMatchObject({
      code: 'owl_fed_today',
    });
    // Regeneration: 10 % × 1.25 per hour = 67.5 per hour.
    app.clock.now += 2 * TIME.HOUR;
    expect((await owls(anna))[0]?.energy).toBe(303);
    app.clock.now += TIME.DAY;
    expect((await anna.agent.json('POST', `/api/owls/${id}/feed`, {})).status).toBe(200);
    expect((await owls(anna))[0]?.energy).toBe(540);
    for (let i = 0; i < 3; i++)
      expect((await anna.agent.json('POST', `/api/owls/${id}/pet`, {})).status).toBe(200);
    // v0.5: a care day needs two different interactions – only today (biscuit and petting).
    expect(
      app.db.all<{ day: string }>(
        'SELECT day FROM owl_care_days WHERE owl_id = ? ORDER BY day',
        id,
      ),
    ).toEqual([{ day: utcDay(app.clock.now) }]);
    expect(gold(anna)).toBe(38);
  });

  it('releases an owl at home, not while it flies', async () => {
    setGold(app, anna, 100);
    const id = await buyOwl(app, anna);
    await sendGold(anna, ben, 1, id).catch(() => undefined);
    setGold(app, anna, 200);
    expect((await sendGold(anna, ben, 1, id)).status).toBe(200);
    const name = app.db.get<{ name: string }>('SELECT name FROM owls WHERE id = ?', id)!.name;
    const release = (typed: string) =>
      anna.agent.json('POST', `/api/owls/${id}/release`, { name: typed });
    expect((await release(name)).body).toMatchObject({ code: 'owl_not_home' });
    expect((await anna.agent.json('POST', `/api/owls/${id}/feed`, {})).body).toMatchObject({
      code: 'owl_not_home',
    });
    advanceTo(app, app.clock.now + 3 * TIME.DAY);
    // v0.8.5: only while more than 20 own owls live here (9.2.8).
    expect((await owls(anna))[0]?.actions.release).toBe(false);
    expect((await release(name)).body).toMatchObject({ code: 'owl_release_limit' });
    setGold(app, anna, 5000);
    for (let i = 0; i < 20; i++) await buyOwl(app, anna, 'bartkauz', `Bart ${i}`);
    expect((await owls(anna)).find((owl) => owl.id === id)?.actions.release).toBe(true);
    // v0.3: only with the exact name, typed by the user.
    expect((await anna.agent.json('POST', `/api/owls/${id}/release`, {})).status).toBe(400);
    expect((await release(`${name}x`)).body).toMatchObject({ code: 'owl_name_mismatch' });
    expect(
      (await release(name.toLowerCase() === name ? name.toUpperCase() : name.toLowerCase())).body,
    ).toMatchObject({ code: 'owl_name_mismatch' });
    expect((await release(name)).status).toBe(200);
    const left = await owls(anna);
    expect(left).toHaveLength(20);
    // At 20 the limit is reached.
    expect(left.every((owl) => !owl.actions.release)).toBe(true);
    const next = left[0]!;
    expect(
      (await anna.agent.json('POST', `/api/owls/${next.id}/release`, { name: next.name })).body,
    ).toMatchObject({ code: 'owl_release_limit' });
  });
});

describe('flights with own owls (SPEC 9.4)', () => {
  it('previews, departs, delivers and comes home with the remaining energy', async () => {
    setGold(app, anna, 200);
    const id = await buyOwl(app, anna);
    app.db.run('UPDATE owls SET energy = 540 WHERE id = ?', id);
    const preview = await anna.agent.json<{
      owls: { id: string; arrivals: { at: number }[]; returnsAt: number | null; offer?: boolean }[];
    }>('POST', '/api/flights/preview', { recipients: [ben.id] });
    // Own owls first; v0.8.5 the loan owls of the day follow (always offered).
    expect(preview.body.owls[0]?.id).toBe(id);
    expect(preview.body.owls.slice(1).every((owl) => owl.offer === true)).toBe(true);
    const own = preview.body.owls[0]!;
    expect(own.returnsAt).toBeGreaterThan(own.arrivals[0]!.at);

    const sent = await sendGold(anna, ben, 5, id);
    expect(sent.body.arrivesAt).toBe(own.arrivals[0]!.at);
    const flying = (await owls(anna))[0]!;
    expect(flying).toMatchObject({
      state: 'flying',
      ready: false,
      absence: { purpose: 'gold', recipients: ['Ben'] },
    });
    expect(flying.absence?.returnsAt).toBe(own.returnsAt);
    // Not available for another transport while flying.
    expect(
      (
        await anna.agent.json('POST', '/api/letters/prepare', {
          recipients: [ben.id],
          parchment: 'small',
          owlId: id,
        })
      ).body,
    ).toMatchObject({
      code: 'owl_not_ready',
    });

    // The map shows the flight to the holder only (SPEC 12.1).
    const map = await anna.agent.json<{
      flights: { segments: unknown[] }[];
      contacts: { name: string }[];
    }>('GET', '/api/map');
    expect(map.body.flights).toHaveLength(1);
    expect(map.body.contacts).toEqual([
      expect.objectContaining({ name: 'Ben', lat: 53.55, lon: 9.99 }),
    ]);
    expect((await ben.agent.json<{ flights: unknown[] }>('GET', '/api/map')).body.flights).toEqual(
      [],
    );

    advanceTo(app, own.returnsAt!);
    const home = (await owls(anna))[0]!;
    expect(home.state).toBe('home');
    expect(home.energy).toBeLessThan(540);
    // v0.7.2: a homecoming is an overlay, not a system message.
    expect(await systemTypes(anna)).not.toContain('owl_home');
    expect(app.db.all('SELECT 1 FROM homecomings WHERE user_id = ?', anna.id)).toHaveLength(1);
    expect((await anna.agent.json<{ flights: unknown[] }>('GET', '/api/map')).body.flights).toEqual(
      [],
    );
  });

  it('a move re-plans the course at once, also during a sleep pause (SPEC 9.4.6)', async () => {
    const clara = await person(app, 'Clara', PARIS);
    await couple(anna, clara);
    setGold(app, anna, 200);
    const id = await buyOwl(app, anna);
    app.db.run('UPDATE owls SET energy = 50 WHERE id = ?', id);
    const sent = await sendGold(anna, clara, 5, id);
    const before = sent.body.arrivesAt!;
    // 50 energy: asleep after about 2 hours.
    app.clock.now += 5 * TIME.HOUR;
    const sleepsOf = (plan: string) =>
      (JSON.parse(plan) as { kind: string; t0: number; t1: number }[]).filter(
        (segment) => segment.kind === 'sleep',
      );
    const oldPause = sleepsOf(app.db.get<{ plan: string }>('SELECT plan FROM flights')!.plan)[0]!;
    expect(oldPause.t0).toBeLessThan(app.clock.now);
    expect(oldPause.t1).toBeGreaterThan(app.clock.now);
    app.db.run('UPDATE users SET home_lat = ?, home_lon = ? WHERE id = ?', 5000, 900, clara.id);
    expect(rerouteForMove(app.ctx, clara.id, app.clock.now, (work) => work())).toBe(1);
    const flight = app.db.get<{ route: string; plan: string }>('SELECT route, plan FROM flights');
    const route = JSON.parse(flight!.route) as { arrivesAt: number; lat: number }[];
    expect(route[0]!.lat).toBe(50);
    expect(route[0]!.arrivesAt).toBeLessThan(before);
    // v0.5: the running sleep is cut; from its energy so far the new plan decides anew.
    const kept = sleepsOf(flight!.plan)[0]!;
    expect(kept.t0).toBe(oldPause.t0);
    expect(kept.t1).toBe(app.clock.now);
    advanceTo(app, route[0]!.arrivesAt);
    expect(gold(clara)).toBe(35);
  });
});

describe('gold transfers (SPEC 9.1.4)', () => {
  it('checks the limits, debits at departure and credits on arrival with one push', async () => {
    setGold(app, anna, 111); // 0,1 for the loan owl
    expect((await sendGold(anna, ben, 11, NO_OWL)).body).toMatchObject({
      code: 'transfer_remaining',
    });
    expect(
      (
        await anna.agent.json('POST', '/api/gold/prepare', {
          recipient: ben.id,
          amount: 201,
          owlId: NO_OWL,
          withCover: false,
        })
      ).status,
    ).toBe(400);
    expect((await sendGold(anna, anna, 1, NO_OWL)).body).toMatchObject({
      code: 'recipient_invalid',
    });
    await ben.agent.json('PUT', '/api/push/subscription', {
      endpoint: 'https://push.example.com/ben',
      keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) },
    });
    await app.ctx.push.idle();
    const sent = await sendGold(anna, ben, 9, await borrowOwl(anna));
    expect(sent.status).toBe(200);
    expect(gold(anna)).toBe(101);
    expect(gold(ben)).toBe(GOLD.START);
    advanceTo(app, sent.body.arrivesAt!);
    await app.ctx.push.idle();
    expect(gold(ben)).toBe(GOLD.START + 9);
    expect(app.pushes.map((push) => JSON.parse(push.payload).type)).toEqual([
      'push_test',
      'gold_arrived',
    ]);
    const messages = await ben.agent.json<{
      messages: { type: string; params: Record<string, unknown>; arrivalImage: string | null }[];
    }>('GET', '/api/system-messages');
    expect(messages.body.messages.at(-1)).toMatchObject({
      type: 'gold_arrived',
      params: { name: 'Anna', amount: 9, owl: expect.any(String) },
      arrivalImage: expect.any(String),
    });
    const finance = await ben.agent.json<{
      transactions: { type: string; amount: number; counterpart: string | null }[];
    }>('GET', '/api/finance');
    expect(finance.body.transactions[0]).toEqual(
      expect.objectContaining({ type: 'transfer_in', amount: 9, counterpart: 'Anna' }),
    );
  });

  it('delivers a cover letter with the gold; the letter carries the arrival image', async () => {
    setGold(app, anna, 200);
    const sent = await sendGold(anna, ben, 20, await borrowOwl(anna), 'Für dich!');
    expect(sent.status).toBe(200);
    advanceTo(app, sent.body.arrivesAt!);
    const letters = await ben.agent.json<{ letters: { kind: string; status: string }[] }>(
      'GET',
      `/api/chats/${anna.id}/letters`,
    );
    expect(letters.body.letters).toEqual([
      expect.objectContaining({ kind: 'cover_gold', status: 'delivered' }),
    ]);
    const messages = await ben.agent.json<{
      messages: { type: string; arrivalImage: string | null }[];
    }>('GET', '/api/system-messages');
    expect(messages.body.messages.at(-1)).toMatchObject({
      type: 'gold_arrived',
      arrivalImage: null,
    });
    // Cover letters are small parchment only.
    const prepared = await anna.agent.json<{ token: string; letters: { letterId: string }[] }>(
      'POST',
      '/api/gold/prepare',
      {
        recipient: ben.id,
        amount: 1,
        owlId: await borrowOwl(anna),
        withCover: true,
      },
    );
    const wrap = toBase64Url(new Uint8Array(80));
    expect(
      (
        await anna.agent.json('POST', '/api/gold/send', {
          token: prepared.body.token,
          cover: {
            letterId: prepared.body.letters[0]!.letterId,
            ciphertext: toBase64Url(new Uint8Array(4135)),
            wrapRecipient: wrap,
            wrapSender: wrap,
          },
        })
      ).status,
    ).toBe(400);
  });

  it('turns back: gold returns home with an own owl, at once with a loan owl (SPEC 9.5)', async () => {
    setGold(app, anna, 300);
    const id = await buyOwl(app, anna);
    const withOwl = await sendGold(anna, ben, 20, id, 'Gruß');
    const withStandIn = await sendGold(anna, ben, 10, await borrowOwl(anna));
    expect(withOwl.status).toBe(200);
    expect(withStandIn.status).toBe(200);
    expect(gold(anna)).toBe(300 - 60 - 30 - 1);
    app.clock.now += TIME.HOUR;
    await ben.agent.json('DELETE', `/api/contacts/${anna.id}`);
    // Loan owl: refund at once.
    expect(gold(anna)).toBe(300 - 60 - 20 - 1);
    const letters = await anna.agent.json<{ letters: { status: string }[] }>(
      'GET',
      `/api/chats/${ben.id}/letters`,
    );
    expect(letters.body.letters).toEqual([expect.objectContaining({ status: 'returned' })]);
    const flight = app.db.get<{ route: string }>('SELECT route FROM flights WHERE owl_id = ?', id);
    const home = (JSON.parse(flight!.route) as { type: string; arrivesAt: number }[]).find(
      (stop) => stop.type === 'home',
    )!;
    expect(home.arrivesAt).toBeLessThan(app.clock.now + 2 * TIME.HOUR);
    advanceTo(app, home.arrivesAt);
    expect(gold(anna)).toBe(300 - 60 - 1);
    expect(gold(ben)).toBe(GOLD.START);
    expect((await systemTypes(anna)).filter((type) => type === 'letter_returned')).toHaveLength(2);
    expect(
      await ben.agent.json<{ letters: unknown[] }>('GET', `/api/chats/${anna.id}/letters`),
    ).toMatchObject({ body: { letters: [] } });
  });
});

describe('multiple recipients turning back (SPEC 9.5)', () => {
  it('skips the affected recipient and flies on to the next', async () => {
    const clara = await person(app, 'Clara', PARIS);
    await couple(anna, clara);
    setGold(app, anna, 200);
    const id = await buyOwl(app, anna);
    app.db.run('UPDATE owls SET energy = 540 WHERE id = ?', id);
    const prepared = await anna.agent.json<{
      token: string;
      letters: { letterId: string; recipientId: string; sentAt: number }[];
    }>('POST', '/api/letters/prepare', {
      recipients: [ben.id, clara.id],
      parchment: 'small',
      owlId: id,
    });
    const items = [];
    for (const letter of prepared.body.letters) {
      const to = letter.recipientId === ben.id ? ben : clara;
      const sealed = await sealLetter(
        {
          letterId: letter.letterId,
          senderId: anna.id,
          recipientId: to.id,
          sentAt: letter.sentAt,
          kind: 'letter',
          parchment: 'small',
        },
        'Hallo',
        {
          senderEd25519Secret: anna.identity.ed25519Secret,
          senderX25519Public: anna.identity.x25519Public,
          recipientX25519Public: to.identity.x25519Public,
        },
      );
      items.push({
        letterId: letter.letterId,
        ciphertext: toBase64Url(sealed.ciphertext),
        wrapRecipient: toBase64Url(sealed.wrapRecipient),
        wrapSender: toBase64Url(sealed.wrapSender),
      });
    }
    const sent = await anna.agent.json<{ letters: { recipientId: string; arrivesAt: number }[] }>(
      'POST',
      '/api/letters/send',
      { token: prepared.body.token, items },
    );
    const toClara = sent.body.letters.find((letter) => letter.recipientId === clara.id)!.arrivesAt;
    app.clock.now += TIME.HOUR;
    await anna.agent.json('DELETE', `/api/contacts/${ben.id}`);
    const letter = app.db.get<{ arrives_at: number }>(
      'SELECT arrives_at FROM letters WHERE recipient_id = ?',
      clara.id,
    );
    // Paris directly instead of via Hamburg: earlier.
    expect(letter!.arrives_at).toBeLessThan(toClara);
    advanceTo(app, letter!.arrives_at);
    expect(
      app.db.get<{ status: string }>('SELECT status FROM letters WHERE recipient_id = ?', clara.id)
        ?.status,
    ).toBe('delivered');
    expect(
      app.db.get<{ status: string }>('SELECT status FROM letters WHERE recipient_id = ?', ben.id)
        ?.status,
    ).toBe('returned');
  });
});

describe('owl gifts (SPEC 9.2.7)', () => {
  it('the owl leaves at once and belongs to the recipient on arrival', async () => {
    setGold(app, anna, 100);
    const id = await buyOwl(app, anna);
    app.clock.now += 3 * TIME.DAY;
    const sent = await gift(anna, ben, id, 'Pass gut auf Waldi auf');
    expect(sent.status).toBe(200);
    expect(await owls(anna)).toEqual([]);
    expect(await owls(ben)).toEqual([]);
    const arrives = (sent.body as { arrivesAt: number }).arrivesAt;
    expect(
      (await anna.agent.json<{ flights: unknown[] }>('GET', '/api/map')).body.flights,
    ).toHaveLength(1);
    advanceTo(app, arrives);
    const received = await owls(ben);
    expect(received).toEqual([expect.objectContaining({ id, name: 'Waldi', state: 'home' })]);
    expect(
      app.db.get<{ owned_since: string }>('SELECT owned_since FROM owls WHERE id = ?', id)
        ?.owned_since,
    ).toBe('2026-11-08');
    expect(await systemTypes(ben)).toContain('owl_gift_received');
    const letters = await ben.agent.json<{ letters: { kind: string }[] }>(
      'GET',
      `/api/chats/${anna.id}/letters`,
    );
    expect(letters.body.letters).toEqual([expect.objectContaining({ kind: 'cover_owl' })]);
    expect((await anna.agent.json<{ flights: unknown[] }>('GET', '/api/map')).body.flights).toEqual(
      [],
    );
  });

  it('a turned-back gift flies home and keeps the old ownership date', async () => {
    setGold(app, anna, 100);
    const id = await buyOwl(app, anna);
    app.clock.now += 3 * TIME.DAY;
    await gift(anna, ben, id);
    app.clock.now += TIME.HOUR;
    await anna.agent.json('DELETE', `/api/contacts/${ben.id}`);
    expect(await owls(anna)).toEqual([]);
    const flight = app.db.get<{ ends_at: number }>(
      "SELECT ends_at FROM flights WHERE state = 'active'",
    );
    advanceTo(app, flight!.ends_at);
    expect(await owls(anna)).toEqual([expect.objectContaining({ id, state: 'home' })]);
    expect(
      app.db.get<{ owned_since: string }>('SELECT owned_since FROM owls WHERE id = ?', id)
        ?.owned_since,
    ).toBe('2026-11-05');
    expect(await owls(ben)).toEqual([]);
  });

  it('cannot give away a loan owl or an unnamed owl', async () => {
    setGold(app, anna, 200);
    expect(
      (
        await anna.agent.json('POST', `/api/owls/${await borrowOwl(anna)}/gift/prepare`, {
          recipient: ben.id,
          withCover: false,
        })
      ).status,
    ).toBe(400);
    const bought = await anna.agent.json<{ owl: { id: string } }>('POST', '/api/owls/buy', {
      species: 'waldkauz',
    });
    expect((await gift(anna, ben, bought.body.owl.id)).body).toMatchObject({
      code: 'owl_not_ready',
    });
  });
});

describe('daily gold (SPEC 9.1.1, 4.5)', () => {
  it('pays the daily wage at 03:00 UTC (v0.7) to active accounts only, once per day, and catches up', async () => {
    app.ctx.queue.ensureDailyJobs();
    app.db.run('UPDATE users SET last_active_date = ? WHERE id = ?', '2026-10-01', ben.id);
    // The test clock starts at 12:00 – the next pay day is tomorrow at 03:00.
    advanceTo(app, Date.UTC(2026, 10, 6, 2, 59));
    expect(gold(anna)).toBe(GOLD.START);
    advanceTo(app, Date.UTC(2026, 10, 6, 3));
    expect(gold(anna)).toBe(GOLD.START + GOLD.DAILY);
    expect(gold(ben)).toBe(GOLD.START);
    // The same day again: nothing.
    app.ctx.queue.schedule('daily:daily_gold', 'daily_gold', Date.UTC(2026, 10, 6, 3, 30));
    advanceTo(app, Date.UTC(2026, 10, 6, 4));
    expect(gold(anna)).toBe(GOLD.START + GOLD.DAILY);
    // Two days of downtime: one payment per missed day.
    advanceTo(app, Date.UTC(2026, 10, 9, 4));
    expect(gold(anna)).toBe(GOLD.START + 4 * GOLD.DAILY);
    const finance = await anna.agent.json<{ transactions: { type: string; at: number }[] }>(
      'GET',
      '/api/finance',
    );
    expect(finance.body.transactions.filter((t) => t.type === 'daily')).toHaveLength(4);
  });

  it('pays 3.0 for the first 30 days after registration and 2.0 afterwards (v0.4)', async () => {
    app.ctx.queue.ensureDailyJobs();
    const created = app.db.get<{ created_on: string }>(
      'SELECT created_on FROM users WHERE id = ?',
      anna.id,
    )!.created_on;
    const start = Date.parse(`${created}T00:00:00Z`);
    // Day 29 after registration (the 30th payment day) still pays the higher wage …
    app.db.run(
      'UPDATE users SET gold = 0, last_active_date = ? WHERE id = ?',
      '2099-01-01',
      anna.id,
    );
    advanceTo(app, start + 29 * TIME.DAY + 16 * TIME.HOUR);
    const before = gold(anna);
    advanceTo(app, start + 30 * TIME.DAY + 16 * TIME.HOUR);
    // … day 30 pays the lower one.
    expect(gold(anna) - before).toBe(GOLD.DAILY_LATER);
    const last = app.db.get<{ amount: number }>(
      "SELECT amount FROM transactions WHERE user_id = ? AND type = 'daily' ORDER BY at DESC LIMIT 1 OFFSET 1",
      anna.id,
    );
    expect(last?.amount).toBe(GOLD.DAILY);
  });

  it('keeps only the last 20 transactions', async () => {
    setGold(app, anna, 1000);
    const id = await buyOwl(app, anna);
    for (let day = 0; day < 25; day++) {
      app.clock.now += TIME.DAY;
      await anna.agent.json('POST', `/api/owls/${id}/feed`, {});
    }
    const count = app.db.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?',
      anna.id,
    )?.n;
    expect(count).toBe(20);
    const finance = await anna.agent.json<{ transactions: unknown[]; gold: number }>(
      'GET',
      '/api/finance',
    );
    expect(finance.body.transactions).toHaveLength(20);
    expect(finance.body.gold).toBe(1000 - 60 - 25);
  });
});

describe('server randomness', () => {
  it('is uniform in [0, 1)', async () => {
    const { secureRandom } = await import('../src/context.ts');
    const values = Array.from({ length: 2000 }, secureRandom);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});
