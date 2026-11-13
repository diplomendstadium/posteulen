/**
 * Version 0.8.5: loan offers rolled per account (and hidden once a loan is over), the rest
 * preselected by the kind of owl, the visiting owl that still has letters for others, the little
 * owl in the chat list instead of a system message, the rest in the map data, releasing only
 * above 20 own owls, five days for chicks, the weekly deletion by age and the deletion of old
 * bot events after 36 months.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { sealLetter, type LetterMeta } from '@posteulen/shared/crypto/letter.ts';
import { MENAGERIE, OWL, TIME } from '@posteulen/shared/constants.ts';
import { releaseAllowed } from '@posteulen/shared/game/owls.ts';
import { utcDay } from '../src/security/ids.ts';
import { offerOf } from '../src/owls/lifecycle.ts';
import { isRetentionDay } from '../src/letters/retention.ts';
import { eventCutoff, pruneOldEvents } from '../src/central/retention.ts';
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
let carla: Person;

beforeEach(async () => {
  app = await testApp();
  anna = await person(app, 'Anna');
  ben = await person(app, 'Ben', HAMBURG);
  carla = await person(app, 'Carla', PARIS);
  withoutBots(app);
  await couple(anna, ben);
  await couple(anna, carla);
});
afterEach(async () => {
  await app.close();
});

interface Prepared {
  token: string;
  letters: { recipientId: string; letterId: string; sentAt: number }[];
}

/** Anna writes one letter to several people (in this order), with a rest at each. */
async function send(from: Person, to: Person[], owlId: string, rest = 0) {
  const prepared = await from.agent.json<Prepared>('POST', '/api/letters/prepare', {
    recipients: to.map((who) => who.id),
    parchment: 'small',
    owlId,
    ...(rest > 0 ? { rest } : {}),
  });
  expect(prepared.status, JSON.stringify(prepared.body)).toBe(200);
  const items = [];
  for (const letter of prepared.body.letters) {
    const recipient = to.find((who) => who.id === letter.recipientId)!;
    const meta: LetterMeta = {
      letterId: letter.letterId,
      senderId: from.id,
      recipientId: recipient.id,
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
  const sent = await from.agent.json<{ letters: { id: string; arrivesAt: number }[] }>(
    'POST',
    '/api/letters/send',
    { token: prepared.body.token, items },
  );
  expect(sent.status, JSON.stringify(sent.body)).toBe(200);
  return sent.body;
}

async function owl(who: Person, name: string): Promise<string> {
  setGold(app, who, 500);
  const id = await buyOwl(app, who, 'waldkauz', name);
  app.db.run('UPDATE owls SET energy = 540 WHERE id = ?', id);
  return id;
}

interface Choice {
  id: string;
  kind: string;
  offer?: boolean;
  guest?: boolean;
  moreStops?: boolean;
  arrivals: { recipientId: string; at: number }[];
  returnsAt: number | null;
}

async function preview(who: Person, recipients: Person[], body: Record<string, unknown> = {}) {
  const result = await who.agent.json<{ owls: Choice[] }>('POST', '/api/flights/preview', {
    recipients: recipients.map((r) => r.id),
    ...body,
  });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body.owls;
}

interface Menagerie {
  loans: number;
  offer: { species: string; loaned: boolean }[];
}

const menagerie = async (who: Person) =>
  (await who.agent.json<Menagerie>('GET', '/api/menagerie')).body;

describe('loan offers per account (v0.8.5, SPEC 9.6)', () => {
  it('rolls four species per account and day, stable until the next day, without the two days before', () => {
    let at = app.clock.now;
    const history: string[][] = [];
    for (let day = 0; day < 15; day++) {
      const offer = offerOf(app.ctx, anna.id, utcDay(at));
      expect(offer).toHaveLength(MENAGERIE.OFFER_SPECIES_COUNT);
      expect(offerOf(app.ctx, anna.id, utcDay(at))).toEqual(offer);
      for (const before of history.slice(-2))
        for (const s of offer) expect(before).not.toContain(s);
      history.push(offer);
      at += TIME.DAY;
    }
    // Rolled per account: over a few days two accounts do not see the same offers every time.
    const differs = [0, 1, 2, 3, 4, 5].some((back) => {
      const day = utcDay(app.clock.now + back * TIME.DAY);
      return (
        JSON.stringify(offerOf(app.ctx, anna.id, day)) !==
        JSON.stringify(offerOf(app.ctx, ben.id, day))
      );
    });
    expect(differs).toBe(true);
  });

  it('on the update day the shared offer of that day still counts, with the loans made', async () => {
    const today = utcDay(app.clock.now);
    const shared = ['bartkauz', 'elfenkauz', 'haubenkauz', 'kanincheneule'];
    app.db.run(
      'INSERT INTO menagerie_offers (day, species) VALUES (?, ?)',
      today,
      JSON.stringify(shared),
    );
    app.db.run(
      'INSERT INTO loan_days (user_id, day, species) VALUES (?, ?, ?)',
      anna.id,
      today,
      'elfenkauz',
    );
    const offer = await menagerie(anna);
    expect(offer.loans).toBe(1);
    // The loan from before the update is over (no owl any more): its offer is hidden.
    expect(offer.offer.map((o) => o.species)).toEqual(['bartkauz', 'haubenkauz', 'kanincheneule']);
    expect((await menagerie(ben)).offer.map((o) => o.species)).toEqual(shared);
    // The next day: an own offer without the species of the shared one.
    app.clock.now += TIME.DAY;
    const tomorrow = await menagerie(anna);
    expect(tomorrow.loans).toBe(0);
    for (const item of tomorrow.offer) expect(shared).not.toContain(item.species);
  });

  it('keeps a loan visible while it lasts, hides it when it is over, and still counts it', async () => {
    setGold(app, anna, 500);
    const loanId = await borrowOwl(anna);
    const during = await menagerie(anna);
    expect(during.offer).toHaveLength(4);
    expect(during.offer.filter((o) => o.loaned)).toHaveLength(1);
    // The loan owl delivers to Ben and vanishes (no rest, no reply).
    const sent = await send(anna, [ben], loanId);
    advanceTo(app, sent.letters[0]!.arrivesAt + TIME.MINUTE);
    expect(app.db.get('SELECT 1 FROM owls WHERE id = ?', loanId)).toBeUndefined();
    const after = await menagerie(anna);
    expect(after.offer).toHaveLength(3);
    expect(after.offer.every((o) => !o.loaned)).toBe(true);
    expect(after.loans).toBe(1);
    // An unused loan that expires is hidden as well.
    const second = await borrowOwl(anna);
    advanceTo(app, app.clock.now + MENAGERIE.LOAN_EXPIRY_HOURS * TIME.HOUR + TIME.MINUTE);
    expect(app.db.get('SELECT 1 FROM owls WHERE id = ?', second)).toBeUndefined();
  });
});

describe('the owl choice (v0.8.5, SPEC 8.4)', () => {
  it('offers the loan owls always and plans each kind with its own rest', async () => {
    const own = await owl(anna, 'Waldi');
    const two = [ben, carla];
    const plain = await preview(anna, two, { rest: 2, restLoan: 0 });
    expect(plain[0]?.id).toBe(own);
    expect(plain.slice(1).length).toBeGreaterThan(0);
    expect(plain.slice(1).every((choice) => choice.offer)).toBe(true);
    const rested = await preview(anna, two, { rest: 2, restLoan: 24 });
    const loan = (list: Choice[]) => list.find((choice) => choice.id === plain[1]!.id)!;
    // The own owl is planned as before …
    expect(rested[0]?.arrivals).toEqual(plain[0]?.arrivals);
    // … the loan owls rest 24 hours at the first recipient: as if 24 hours counted for all.
    const allDay = await preview(anna, two, { rest: 24 });
    expect(loan(rested).arrivals).toEqual(loan(allDay).arrivals);
    expect(loan(rested).arrivals[1]!.at).toBeGreaterThan(loan(plain).arrivals[1]!.at);
    // Without restLoan the rest counts for all owls (older apps).
    const older = await preview(anna, two, { rest: 2 });
    expect(loan(older).arrivals[1]!.at).toBeLessThan(loan(rested).arrivals[1]!.at);
  });

  it('a visiting owl with letters for others says so – without naming them', async () => {
    const own = await owl(anna, 'Waldi');
    const sent = await send(anna, [ben, carla], own, 2);
    const toBen = sent.letters.find(
      (l) => l.arrivesAt === Math.min(...sent.letters.map((x) => x.arrivesAt)),
    )!;
    advanceTo(app, toBen.arrivesAt + TIME.MINUTE);
    const host = sent.letters[0]!.arrivesAt <= sent.letters[1]!.arrivesAt ? ben : carla;
    const guestChoice = (await preview(host, [anna], { guests: true })).find((c) => c.guest);
    expect(guestChoice?.moreStops).toBe(true);
    const guests = await host.agent.json<{ guests: { moreStops: boolean }[] }>('GET', '/api/owls');
    expect(guests.body.guests[0]?.moreStops).toBe(true);
    expect(JSON.stringify(guests.body)).not.toContain(host === ben ? 'Carla' : 'Ben');
  });
});

describe('a resting owl (v0.8.5, SPEC 8.4)', () => {
  it('shows as a little owl in the chat list (no system message), and its rest on the map', async () => {
    const own = await owl(anna, 'Waldi');
    const sent = await send(anna, [ben], own, 2);
    advanceTo(app, sent.letters[0]!.arrivesAt + TIME.MINUTE);
    const chats = async () =>
      (
        await ben.agent.json<{ chats: { peerId: string; owlResting: boolean }[] }>(
          'GET',
          '/api/chats',
        )
      ).body.chats;
    expect((await chats()).find((c) => c.peerId === anna.id)?.owlResting).toBe(true);
    expect(
      app.db.all(
        "SELECT 1 FROM system_messages WHERE type = 'owl_resting' AND user_id = ?",
        ben.id,
      ),
    ).toEqual([]);
    expect(
      app.db.all("SELECT 1 FROM notifications WHERE type = 'owl_resting' AND user_id = ?", ben.id),
    ).toHaveLength(1);
    const map = await anna.agent.json<{
      flights: { stops: { status: string; restUntil: number | null }[] }[];
    }>('GET', '/api/map');
    const stop = map.body.flights[0]!.stops[0]!;
    expect(stop.status).toBe('resting');
    expect(stop.restUntil).toBe(sent.letters[0]!.arrivesAt + 2 * TIME.HOUR);
    // The owl's own picture: resting away, so the owl list marks it resting.
    const owls = await anna.agent.json<{ owls: { absence: { resting: unknown } | null }[] }>(
      'GET',
      '/api/owls',
    );
    expect(owls.body.owls[0]?.absence?.resting).toBeTruthy();
    advanceTo(app, sent.letters[0]!.arrivesAt + 3 * TIME.HOUR);
    expect((await chats()).find((c) => c.peerId === anna.id)?.owlResting).toBe(false);
  });
});

describe('releasing owls (v0.8.5, SPEC 9.2.8)', () => {
  it('needs more than 20 own owls', () => {
    const home = { state: 'home', kind: 'own', isChick: false } as const;
    expect(OWL.RELEASE_ABOVE_OWN_OWLS).toBe(20);
    expect(releaseAllowed(home, 20)).toBe(false);
    expect(releaseAllowed(home, 21)).toBe(true);
    expect(releaseAllowed({ ...home, state: 'flying' }, 30)).toBe(false);
    expect(releaseAllowed({ ...home, kind: 'loan' }, 30)).toBe(false);
  });
});

describe('chicks get five days (v0.8.5, SPEC 9.9)', () => {
  it('moves the deadlines of clutches still waiting (migration 0020)', () => {
    const hatched = app.clock.now - TIME.HOUR;
    for (const [id, state] of [
      ['clutch-open', 'open'],
      ['clutch-one', 'none'],
    ] as const) {
      app.db.run(
        'INSERT INTO clutches (id, owner_id, species, hatched_at, gift_state) VALUES (?, ?, ?, ?, ?)',
        id,
        anna.id,
        'waldkauz',
        hatched,
        state,
      );
      app.ctx.queue.schedule('clutch_names', id, hatched + 24 * TIME.HOUR);
    }
    app.ctx.queue.schedule('clutch_gift', 'clutch-open', hatched + 24 * TIME.HOUR);
    app.ctx.queue.schedule('clutch_reminder', 'clutch-open', hatched + 20 * TIME.HOUR);
    app.db.run(
      "INSERT INTO scheduled_events (type, ref, due_at, logical_at) VALUES ('daily:menagerie_offer', 'menagerie_offer', 1, 1)",
    );
    const sql = fs.readFileSync(
      path.join(import.meta.dirname, '../migrations/0020_v085.sql'),
      'utf8',
    );
    // Only the data part (the table exists already in the test database).
    for (const statement of sql.split(';').map((part) => part.trim()))
      if (/^(--[^\n]*\n\s*)*(UPDATE|DELETE)/.test(statement)) app.db.run(statement);
    const due = (type: string, ref: string) =>
      app.db.get<{ due_at: number; logical_at: number }>(
        'SELECT due_at, logical_at FROM scheduled_events WHERE type = ? AND ref = ?',
        type,
        ref,
      );
    expect(due('clutch_names', 'clutch-open')).toEqual({
      due_at: hatched + 5 * TIME.DAY,
      logical_at: hatched + 5 * TIME.DAY,
    });
    expect(due('clutch_names', 'clutch-one')?.due_at).toBe(hatched + 5 * TIME.DAY);
    expect(due('clutch_gift', 'clutch-open')?.due_at).toBe(hatched + 5 * TIME.DAY);
    expect(due('clutch_reminder', 'clutch-open')?.due_at).toBe(hatched + 4 * TIME.DAY);
    expect(due('daily:menagerie_offer', 'menagerie_offer')).toBeUndefined();
    expect(OWL.CHICK_GIFT_DEADLINE_HOURS).toBe(120);
    expect(OWL.CHICK_NAME_DEADLINE_HOURS).toBe(120);
  });
});

describe('weekly deletion by age (v0.8.5, SPEC 8.4.1)', () => {
  const oldMessage = (id: string) =>
    app.db.run(
      "INSERT INTO system_messages (id, user_id, type, params, created_at) VALUES (?, ?, 'owl_sick', '{}', 0)",
      id,
      anna.id,
    );
  const present = (id: string) =>
    app.db.get('SELECT 1 FROM system_messages WHERE id = ?', id) !== undefined;
  const runJobAt = (day: string, clockAt: number) => {
    app.db.run("DELETE FROM scheduled_events WHERE type = 'daily:inactivity'");
    app.ctx.queue.schedule('daily:inactivity', 'inactivity', Date.parse(`${day}T04:00:00Z`));
    advanceTo(app, clockAt);
  };

  it('only runs on Mondays; a missed Monday waits for the next one', async () => {
    expect(isRetentionDay('2026-11-09')).toBe(true);
    expect(isRetentionDay('2026-11-10')).toBe(false);
    oldMessage('message-a-0000000000');
    // Tuesday, 10 Nov 2026: nothing.
    runJobAt('2026-11-10', Date.parse('2026-11-10T05:00:00Z'));
    expect(present('message-a-0000000000')).toBe(true);
    // The Monday run planned for 16 Nov only happens on Tuesday (downtime): still nothing.
    runJobAt('2026-11-16', Date.parse('2026-11-17T05:00:00Z'));
    expect(present('message-a-0000000000')).toBe(true);
    // A shorter period does not delete at once either.
    await anna.agent.json('PATCH', '/api/account/letters', { retentionDays: 30, print: false });
    expect(present('message-a-0000000000')).toBe(true);
    // Monday, 23 Nov: gone.
    runJobAt('2026-11-23', Date.parse('2026-11-23T05:00:00Z'));
    expect(present('message-a-0000000000')).toBe(false);
  });
});

describe('old events of bots (v0.8.5, SPEC 10.10)', () => {
  it('are deleted 36 months after sending, with deliveries and unused pictures; statistics stay', () => {
    const now = app.clock.now;
    app.db.run(
      `INSERT INTO central_bots (id, name, name_key, owl_sex, created_at, updated_at)
       VALUES ('bot-0000000000000000001', 'Tante Test', 'tante test', 'f', 0, 0)`,
    );
    const media = (id: string) =>
      app.db.run(
        `INSERT INTO central_bot_media (id, bot_id, sha256, data, width, height, created_at)
         VALUES (?, 'bot-0000000000000000001', ?, x'00', 1, 1, 0)`,
        id,
        id,
      );
    media('media-old');
    media('media-shared');
    const event = (id: string, dueAt: number, state: string, pictures: string[]) =>
      app.db.run(
        `INSERT INTO central_bot_events (id, bot_id, due_at, state, media, created_at, updated_at)
         VALUES (?, 'bot-0000000000000000001', ?, ?, ?, 0, 0)`,
        id,
        dueAt,
        state,
        JSON.stringify(pictures),
      );
    const cutoff = eventCutoff(now);
    expect(new Date(cutoff).toISOString().slice(0, 10)).toBe('2023-11-05');
    event('event-old', cutoff - TIME.DAY, 'archived', ['media-old', 'media-shared']);
    event('event-skipped', cutoff - TIME.DAY, 'skipped', []);
    event('event-young', cutoff + TIME.DAY, 'archived', ['media-shared']);
    app.db.run(
      `INSERT INTO central_bot_deliveries (id, bot_id, event_id, user_id, state, not_before, created_at)
       VALUES ('delivery-1', 'bot-0000000000000000001', 'event-old', ?, 'done', 0, 0)`,
      anna.id,
    );
    app.db.run(
      `INSERT INTO central_bot_stats (bot_id, day, sent) VALUES ('bot-0000000000000000001', '2023-01-01', 5)`,
    );
    expect(app.db.transaction(() => pruneOldEvents(app.ctx, now))).toBe(2);
    const ids = (table: string) =>
      app.db.all<{ id: string }>(`SELECT id FROM ${table} ORDER BY id`).map((row) => row.id);
    expect(ids('central_bot_events')).toEqual(['event-young']);
    expect(ids('central_bot_deliveries')).toEqual([]);
    expect(ids('central_bot_media')).toEqual(['media-shared']);
    expect(app.db.get('SELECT sent FROM central_bot_stats')).toEqual({ sent: 5 });
  });
});
