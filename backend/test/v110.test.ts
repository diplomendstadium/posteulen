/**
 * Version 1.1: Christmas parchment decided at sending by the sender's local time and kept, the
 * parchment pair of a chat the same for both sides, owl arrivals shown at the first opportunity
 * (`/api/arrivals`), one team of the post office per day, the next stop of a travelling owl and
 * the accounts created through the onion service.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { sealLetter } from '@posteulen/shared/crypto/letter.ts';
import { TIME } from '@posteulen/shared/constants.ts';
import { LOAN_TEAMS } from '@posteulen/shared/species.ts';
import { listenTor } from '../src/http/server.ts';
import { adminStats } from '../src/admin/operations.ts';
import { christmasAt, christmasPaperOf } from '../src/letters/season.ts';
import { offerTeamOf } from '../src/owls/lifecycle.ts';
import { utcDay } from '../src/security/ids.ts';
import {
  Agent,
  advanceTo,
  borrowOwl,
  buyOwl,
  couple,
  HAMBURG,
  ONION,
  person,
  register,
  setGold,
  testApp,
  TorAgent,
  USER_ORIGIN,
  withoutBots,
  type Person,
  type SentPush,
  type TestApp,
} from './auth-helpers.ts';

const LISBON = { lat: 38.72, lon: -9.14 };

let app: TestApp & { pushes: SentPush[] };
let anna: Person;
let ben: Person;

afterEach(async () => {
  await app.close();
});

async function send(from: Person, to: Person, owlId: string) {
  const prepared = await from.agent.json<{
    token: string;
    letters: { recipientId: string; letterId: string; sentAt: number }[];
  }>('POST', '/api/letters/prepare', { recipients: [to.id], parchment: 'small', owlId });
  expect(prepared.status, JSON.stringify(prepared.body)).toBe(200);
  const letter = prepared.body.letters[0]!;
  const sealed = await sealLetter(
    {
      letterId: letter.letterId,
      senderId: from.id,
      recipientId: to.id,
      sentAt: letter.sentAt,
      kind: 'letter',
      parchment: 'small',
    },
    'Frohe Weihnachten!',
    {
      senderEd25519Secret: from.identity.ed25519Secret,
      senderX25519Public: from.identity.x25519Public,
      recipientX25519Public: to.identity.x25519Public,
    },
  );
  const sent = await from.agent.json<{ letters: { id: string; arrivesAt: number }[] }>(
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
  expect(sent.status, JSON.stringify(sent.body)).toBe(200);
  return sent.body.letters[0]!;
}

async function ownOwl(who: Person, name: string): Promise<string> {
  setGold(app, who, 500);
  const id = await buyOwl(app, who, 'waldkauz', name);
  app.db.run('UPDATE owls SET energy = 540 WHERE id = ?', id);
  return id;
}

interface ChatLetters {
  christmasPaper: number;
  letters: { id: string; christmas: boolean; role: string }[];
}

describe('Christmas parchment (v1.1, SPEC 8.4, 9.11)', () => {
  beforeEach(async () => {
    app = await testApp();
    anna = await person(app, 'Anna');
    ben = await person(app, 'Ben', LISBON);
    withoutBots(app);
    await couple(anna, ben);
  });

  it('marks letters by the local time at the sender’s home and keeps the mark', async () => {
    // 28 Nov 2026, 23:30 UTC: in Berlin (Anna) the first Sunday of Advent, in Lisbon (Ben) not.
    app.clock.now = Date.UTC(2026, 10, 28, 23, 30);
    // Both were online just now (no inactive contacts after the jump in time).
    app.db.run('UPDATE users SET last_active_date = ?', utcDay(app.clock.now));
    expect(christmasAt(app.ctx, anna.id, app.clock.now)).toBe(1);
    expect(christmasAt(app.ctx, ben.id, app.clock.now)).toBe(0);
    expect(christmasAt(app.ctx, 'nobody', app.clock.now)).toBe(0);
    const fromAnna = await send(anna, ben, await ownOwl(anna, 'Waldi'));
    const fromBen = await send(ben, anna, await ownOwl(ben, 'Wilma'));
    const annaView = (await anna.agent.json<ChatLetters>('GET', `/api/chats/${ben.id}/letters`))
      .body;
    const byId = (id: string) => annaView.letters.find((letter) => letter.id === id);
    expect(byId(fromAnna.id)?.christmas).toBe(true);
    // Ben's letter is not delivered yet; Ben sees his own copy.
    const benView = (await ben.agent.json<ChatLetters>('GET', `/api/chats/${anna.id}/letters`))
      .body;
    expect(benView.letters.find((letter) => letter.id === fromBen.id)?.christmas).toBe(false);
    // Both sides see the same pair of the chat.
    expect(annaView.christmasPaper).toBe(benView.christmasPaper);
    expect(annaView.christmasPaper).toBe(christmasPaperOf(app.ctx, ben.id, anna.id));
    // Delivered, the recipient sees the same parchment; after Christmas it stays (stored).
    advanceTo(app, fromAnna.arrivesAt + TIME.MINUTE);
    const received = (await ben.agent.json<ChatLetters>('GET', `/api/chats/${anna.id}/letters`))
      .body;
    expect(received.letters.find((letter) => letter.id === fromAnna.id)?.christmas).toBe(true);
    app.clock.now = Date.UTC(2027, 1, 1, 12);
    const stored = (id: string) =>
      app.db.get<{ christmas: number }>('SELECT christmas FROM letters WHERE id = ?', id)
        ?.christmas;
    expect(stored(fromAnna.id)).toBe(1);
    expect(stored(fromBen.id)).toBe(0);
  });

  it('spreads the chats over all four pairs', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 64; i++) seen.add(christmasPaperOf(app.ctx, `a${i}`, `b${i}`));
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('arrivals at the first opportunity (v1.1, SPEC 9.2.6)', () => {
  beforeEach(async () => {
    app = await testApp();
    anna = await person(app, 'Anna');
    ben = await person(app, 'Ben', HAMBURG);
    withoutBots(app);
    await couple(anna, ben);
  });

  it('lists landed letters not seen yet, with owl and sender, until they are marked seen', async () => {
    const letter = await send(anna, ben, await ownOwl(anna, 'Waldi'));
    type Arrivals = { arrivals: { id: string; owl: string; species: string; from: string }[] };
    expect((await ben.agent.json<Arrivals>('GET', '/api/arrivals')).body.arrivals).toEqual([]);
    advanceTo(app, letter.arrivesAt + TIME.MINUTE);
    const arrivals = (await ben.agent.json<Arrivals>('GET', '/api/arrivals')).body.arrivals;
    expect(arrivals).toEqual([
      expect.objectContaining({ id: letter.id, owl: 'Waldi', species: 'waldkauz', from: 'Anna' }),
    ]);
    // The sender never learns anything about it; others see nothing.
    expect((await anna.agent.json<Arrivals>('GET', '/api/arrivals')).body.arrivals).toEqual([]);
    await ben.agent.json('POST', '/api/letters/arrival-seen', { ids: [letter.id] });
    expect((await ben.agent.json<Arrivals>('GET', '/api/arrivals')).body.arrivals).toEqual([]);
    expect((await new Agent(app.userApi, USER_ORIGIN).json('GET', '/api/arrivals')).status).toBe(
      401,
    );
  });
});

describe('the post office and travelling owls (v1.1, SPEC 8.5, 9.6)', () => {
  beforeEach(async () => {
    app = await testApp();
    anna = await person(app, 'Anna');
    ben = await person(app, 'Ben', HAMBURG);
    withoutBots(app);
    await couple(anna, ben);
  });

  it('offers a whole team, says which, and lets each owl of it be borrowed once', async () => {
    setGold(app, anna, 500);
    const offer = await anna.agent.json<{
      team: string;
      maxLoans: number;
      offer: { species: string }[];
    }>('GET', '/api/menagerie');
    const team = offer.body.team as keyof typeof LOAN_TEAMS;
    expect(Object.keys(LOAN_TEAMS)).toContain(team);
    expect(offer.body.offer.map((o) => o.species)).toEqual(LOAN_TEAMS[team]);
    expect(offer.body.maxLoans).toBe(LOAN_TEAMS[team].length);
    for (let i = 0; i < LOAN_TEAMS[team].length; i++) await borrowOwl(anna);
    await expect(borrowOwl(anna)).rejects.toThrow();
    // The next day another team.
    const tomorrow = utcDay(app.clock.now + TIME.DAY);
    expect(offerTeamOf(app.ctx, anna.id, tomorrow)).not.toBe(team);
  });

  it('tells the next stop and its time of a travelling owl', async () => {
    const id = await ownOwl(anna, 'Waldi');
    const letter = await send(anna, ben, id);
    const list = await anna.agent.json<{
      owls: { id: string; absence: { nextStop: { name: string; arrivesAt: number } | null } }[];
    }>('GET', '/api/owls');
    const absence = list.body.owls.find((owl) => owl.id === id)?.absence;
    expect(absence?.nextStop).toEqual({ name: 'Ben', arrivesAt: letter.arrivesAt });
    // On the way home there is no next recipient any more.
    advanceTo(app, letter.arrivesAt + TIME.MINUTE);
    const home = await anna.agent.json<{
      owls: { id: string; absence: { nextStop: unknown } | null }[];
    }>('GET', '/api/owls');
    expect(home.body.owls.find((owl) => owl.id === id)?.absence?.nextStop ?? null).toBeNull();
  });
});

describe('accounts created through the onion service (v1.1, SPEC 13)', () => {
  let torPort: number;

  beforeEach(async () => {
    app = await testApp({ env: { POSTEULEN_ONION: ONION } });
    torPort = await listenTor(app.userApi, '127.0.0.1', 0);
    await client.ready();
  });

  it('counts them in the admin statistics', async () => {
    await register(new Agent(app.userApi, USER_ORIGIN), 'Anna', 'ein sehr langes Passwort');
    expect(adminStats(app.ctx, app.clock.now).accounts.viaOnion).toBe(0);
    const viaTor = await register(new TorAgent(app, torPort), 'Ben', 'ein sehr langes Passwort');
    expect(viaTor.status, JSON.stringify(viaTor.body)).toBe(200);
    const stats = adminStats(app.ctx, app.clock.now).accounts;
    expect(stats.viaOnion).toBe(1);
    expect(stats.current).toBeGreaterThanOrEqual(2);
  });
});
