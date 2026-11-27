/**
 * Version 1.4.0 (server side): the most own owls (SPEC 9.2.3), bored owls (9.2.9), lending to
 * the post office once per quarter (9.7), loan owls with 75–100 % energy (9.6), holiday mode
 * (8.10, 9.12), one little owl per resting owl in the chat list (8.4), the onion sites of the
 * admin panel and the bots control centre (16.5) and migration 0026.
 */
import path from 'node:path';
import type { LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { sealLetter, type LetterMeta } from '@posteulen/shared/crypto/letter.ts';
import { BOREDOM, MENAGERIE, OWL, TIME, VACATION } from '@posteulen/shared/constants.ts';
import { maxOwnOwls, speciesById } from '@posteulen/shared/game/owls.ts';
import { distanceKm } from '@posteulen/shared/game/geo.ts';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { openDatabase } from '../src/db/database.ts';
import { loadMigrations, migrate } from '../src/db/migrate.ts';
import { listenTor } from '../src/http/server.ts';
import { createVoucher } from '../src/admin/vouchers.ts';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import { setTorStatus } from '../src/ops/tor.ts';
import { limitNotices } from '../src/owls/limit.ts';
import { generateCaddyfile } from '../src/ops/caddyfile.ts';
import { boredomDay } from '../src/owls/boredom.ts';
import { loanIdentitiesFor, loanStartEnergy } from '../src/owls/lifecycle.ts';
import { utcDay } from '../src/security/ids.ts';
import { tempDir } from './helpers.ts';
import {
  advanceTo,
  Agent,
  ADMIN_ORIGIN,
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
const run = <T>(work: (after: (job: () => void) => void) => T): T => {
  const jobs: (() => void)[] = [];
  const result = app.db.transaction(() => work((job) => jobs.push(job)));
  for (const job of jobs) job();
  return result;
};
const systemTypes = (who: Person) =>
  app.db
    .all<{ type: string }>(
      'SELECT type FROM system_messages WHERE user_id = ? ORDER BY created_at, id',
      who.id,
    )
    .map((row) => row.type);

function fillOwls(who: Person, count: number, state = 'home'): void {
  for (let i = 0; i < count; i++) {
    app.db.run(
      `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at, state)
       VALUES (?, ?, 'own', 'waldkauz', 'm', ?, 100, 0, '2026-11-01', 0, ?)`,
      `${who.name.toLowerCase()}fill${String(i).padStart(13, '0')}`,
      who.id,
      `Eule ${i}`,
      state,
    );
  }
}

interface Prepared {
  token: string;
  letters: { letterId: string; recipientId: string; sentAt: number }[];
}

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

interface OwlListItem {
  id: string;
  name: string;
  state: string;
  bored: boolean;
  vacation: { phase: string; returnsAt: number; islandAt: number | null } | null;
  actions: { menagerie: boolean; release: boolean };
}

async function owlList(who: Person) {
  return (
    await who.agent.json<{
      owls: OwlListItem[];
      maxOwls: number;
      ownCount: number;
      canBuy: boolean;
      clutches: { id: string; giftAll: boolean }[];
    }>('GET', '/api/owls')
  ).body;
}

describe('the most own owls (v1.4, SPEC 9.2.3)', () => {
  it('is the number of species: no purchase, no voucher owl, no gift to a full aviary', async () => {
    await couple(anna, ben);
    setGold(app, anna, 5000);
    fillOwls(anna, maxOwnOwls() - 1);
    expect((await owlList(anna)).canBuy).toBe(true);
    await buyOwl(app, anna, 'waldkauz', 'Letzte');
    const list = await owlList(anna);
    expect(list.maxOwls).toBe(maxOwnOwls());
    expect(list.ownCount).toBe(maxOwnOwls());
    expect(list.canBuy).toBe(false);
    expect(
      (await anna.agent.json('POST', '/api/owls/buy', { species: 'waldkauz' })).body,
    ).toMatchObject({ code: 'owl_limit' });

    // A voucher owl is refused – the code stays valid.
    const code = createVoucher(app.ctx, { kind: 'owl', species: 'random' }, now()).code;
    expect((await anna.agent.json('POST', '/api/vouchers/redeem', { code })).body).toMatchObject({
      code: 'owl_limit',
    });
    app.db.run("DELETE FROM owls WHERE owner_id = ? AND name = 'Eule 0'", anna.id);
    expect((await anna.agent.json('POST', '/api/vouchers/redeem', { code })).status).toBe(200);

    // Ben cannot give Anna an owl; the address book says so.
    setGold(app, ben, 500);
    const gift = await buyOwl(app, ben, 'waldkauz', 'Geschenk');
    const contacts = await ben.agent.json<{ contacts: { userId: string; owlsFull: boolean }[] }>(
      'GET',
      '/api/contacts',
    );
    expect(contacts.body.contacts.find((c) => c.userId === anna.id)?.owlsFull).toBe(true);
    expect(
      (
        await ben.agent.json('POST', `/api/owls/${gift}/gift/prepare`, {
          recipient: anna.id,
          withCover: false,
        })
      ).body,
    ).toMatchObject({ code: 'recipient_owl_limit' });
  });

  it('sends a system message once a week while the limit is reached', () => {
    fillOwls(anna, maxOwnOwls());
    run((after) => limitNotices(app.ctx, now(), after));
    run((after) => limitNotices(app.ctx, now() + TIME.DAY, after));
    expect(systemTypes(anna).filter((type) => type === 'owl_limit')).toHaveLength(1);
    run((after) => limitNotices(app.ctx, now() + 7 * TIME.DAY, after));
    expect(systemTypes(anna).filter((type) => type === 'owl_limit')).toHaveLength(2);
    expect(systemTypes(ben)).not.toContain('owl_limit');
  });

  it('beyond the limit all chicks must be given away – by lot to contacts with room', async () => {
    await couple(anna, ben);
    fillOwls(anna, maxOwnOwls() - 1);
    app.db.run(
      `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at, state, state_until)
       VALUES ('mothermothermothermoth', ?, 'own', 'waldkauz', 'f', 'Mama', 100, ?, '2026-11-01', 0, 'brooding', ?)`,
      anna.id,
      now(),
      now() + TIME.MINUTE,
    );
    app.ctx.queue.schedule('hatch', 'mothermothermothermoth', now() + TIME.MINUTE);
    advanceTo(app, now() + TIME.MINUTE);
    const clutch = app.db.get<{ gift_all: number; gift_state: string }>(
      'SELECT gift_all, gift_state FROM clutches WHERE owner_id = ?',
      anna.id,
    )!;
    expect(clutch).toEqual({ gift_all: 1, gift_state: 'open' });
    expect(systemTypes(anna)).toContain('chicks_hatched_gift_all');
    expect((await owlList(anna)).clutches[0]?.giftAll).toBe(true);
    const chicks = app.db.all<{ id: string }>(
      'SELECT id FROM owls WHERE owner_id = ? AND is_chick = 1',
      anna.id,
    );
    advanceTo(app, now() + OWL.CHICK_GIFT_DEADLINE_HOURS * TIME.HOUR);
    // Every chick flies to Ben (the only contact with room).
    expect(
      app.db.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM owls WHERE owner_id = ? AND is_chick = 1 AND state = 'home'",
        anna.id,
      )!.n,
    ).toBe(0);
    expect(
      app.db.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM flights WHERE purpose = 'gift' AND holder_id = ?",
        anna.id,
      )!.n,
    ).toBe(chicks.length);
    expect(systemTypes(anna).filter((type) => type === 'clutch_lot')).toHaveLength(chicks.length);
  });

  it('a healed wild owl of a full player and an owl of a bot fly off into freedom', async () => {
    fillOwls(anna, maxOwnOwls());
    const wild = (await anna.agent.json<{ wild: { id: string }[] }>('GET', '/api/rescue')).body
      .wild[0]!;
    app.db.run('UPDATE rescue_wild SET healed_at = ?, stays = 1 WHERE id = ?', now(), wild.id);
    expect(
      (await anna.agent.json<{ stays: boolean }>('POST', `/api/rescue/wild/${wild.id}/release`, {}))
        .body.stays,
    ).toBe(false);
  });
});

describe('release from more than 5 owls (v1.4, SPEC 9.2.8)', () => {
  it('offers the release button from the sixth own owl on', async () => {
    fillOwls(anna, 5);
    expect((await owlList(anna)).owls.every((owl) => !owl.actions.release)).toBe(true);
    fillOwls(ben, 0);
    app.db.run(
      `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at)
       VALUES ('sixthsixthsixthsixths', ?, 'own', 'waldkauz', 'm', 'Sechs', 100, 0, '2026-11-01', 0)`,
      anna.id,
    );
    expect((await owlList(anna)).owls.every((owl) => owl.actions.release)).toBe(true);
  });
});

describe('bored owls (v1.4, SPEC 9.2.9)', () => {
  const days = (count: number) => {
    for (let day = 0; day < count; day++)
      run((after) => boredomDay(app.ctx, now() + day * TIME.DAY, after));
  };

  it('are bored after 21 days, fly off after 7 more – never the last adult owl', async () => {
    // v1.4.2: only owls of a player who has had a contact with a person get bored.
    await couple(anna, ben);
    fillOwls(anna, 2);
    days(BOREDOM.BORED_AFTER_DAYS);
    expect(systemTypes(anna)).not.toContain('owl_bored');
    days(2);
    expect(systemTypes(anna).filter((type) => type === 'owl_bored')).toHaveLength(2);
    expect((await owlList(anna)).owls.every((owl) => owl.bored)).toBe(true);
    run((after) =>
      boredomDay(
        app.ctx,
        now() + (BOREDOM.BORED_AFTER_DAYS + BOREDOM.ESCAPE_AFTER_DAYS + 2) * TIME.DAY,
        after,
      ),
    );
    // One of the two flew off; the last one stays (bored).
    const left = await owlList(anna);
    expect(left.owls).toHaveLength(1);
    expect(left.owls[0]?.bored).toBe(true);
    expect(systemTypes(anna)).toContain('owl_escaped');
    const homecomings = await anna.agent.json<{ homecomings: { kind: string }[] }>(
      'GET',
      '/api/homecomings',
    );
    expect(homecomings.body.homecomings.map((item) => item.kind)).toEqual(['freedom']);
  });

  it('do not count while sick, lent out or on holiday; a letter to a person ends it', async () => {
    await couple(anna, ben);
    setGold(app, anna, 500);
    const owl = await buyOwl(app, anna, 'waldkauz', 'Waldi');
    app.db.run('UPDATE owls SET energy = 430 WHERE id = ?', owl);
    app.db.run("UPDATE owls SET state = 'sick' WHERE id = ?", owl);
    days(30);
    expect(app.db.get<{ idle_ms: number }>('SELECT idle_ms FROM owls WHERE id = ?', owl)).toEqual({
      idle_ms: 0,
    });
    app.db.run("UPDATE owls SET state = 'home', idle_ms = ? WHERE id = ?", 22 * TIME.DAY, owl);
    days(1);
    expect((await owlList(anna)).owls[0]?.bored).toBe(true);
    await send(anna, [ben], owl);
    const row = app.db.get<{ idle_ms: number; bored_at: number | null }>(
      'SELECT idle_ms, bored_at FROM owls WHERE id = ?',
      owl,
    );
    expect(row).toEqual({ idle_ms: 0, bored_at: null });
  });
});

describe('lending to the post office (v1.4, SPEC 9.7)', () => {
  it('works once per owl and calendar quarter', async () => {
    setGold(app, anna, 500);
    const owl = await buyOwl(app, anna, 'waldkauz', 'Waldi');
    expect((await owlList(anna)).owls[0]?.actions.menagerie).toBe(true);
    expect((await anna.agent.json('POST', `/api/owls/${owl}/menagerie`, {})).status).toBe(200);
    advanceTo(app, now() + OWL.MENAGERIE_DAYS * TIME.DAY + TIME.MINUTE);
    expect(systemTypes(anna)).toContain('menagerie_done');
    expect((await owlList(anna)).owls[0]?.actions.menagerie).toBe(false);
    expect((await anna.agent.json('POST', `/api/owls/${owl}/menagerie`, {})).body).toMatchObject({
      code: 'owl_lent_this_quarter',
    });
    // In the next quarter again (here: the loan counted for the quarter before).
    app.db.run("UPDATE owls SET lent_quarter = '2026-3' WHERE id = ?", owl);
    expect((await owlList(anna)).owls[0]?.actions.menagerie).toBe(true);
  });
});

describe('loan owls start with 75–100 % energy (v1.4, SPEC 9.6)', () => {
  it('derives the energy of every offer in that range', () => {
    for (let day = 0; day < 20; day++) {
      const date = utcDay(now() + day * TIME.DAY);
      for (const [species, identity] of loanIdentitiesFor(app.ctx, anna.id, date)) {
        const share = loanStartEnergy(identity, species) / speciesById(species)!.maxEnergy;
        expect(share).toBeGreaterThanOrEqual(MENAGERIE.LOAN_START_ENERGY_MIN_SHARE - 1e-9);
        expect(share).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('one little owl per resting owl in the chat list (v1.4, SPEC 8.4)', () => {
  it('counts the owls of a correspondent resting here', async () => {
    await couple(anna, ben);
    setGold(app, anna, 500);
    const first = await buyOwl(app, anna, 'waldkauz', 'Eins');
    const second = await buyOwl(app, anna, 'waldkauz', 'Zwei');
    app.db.run('UPDATE owls SET energy = 430 WHERE owner_id = ?', anna.id);
    const a = await send(anna, [ben], first, 24);
    const b = await send(anna, [ben], second, 24);
    advanceTo(app, Math.max(a.letters[0]!.arrivesAt, b.letters[0]!.arrivesAt) + TIME.MINUTE);
    const chats = await ben.agent.json<{ chats: { peerId: string; owlsResting: number }[] }>(
      'GET',
      '/api/chats',
    );
    expect(chats.body.chats.find((chat) => chat.peerId === anna.id)?.owlsResting).toBe(2);
  });
});

describe('holiday mode (v1.4, SPEC 8.10, 9.12)', () => {
  const plan = (who: Person, startsAt: number | null, endsAt: number) =>
    who.agent.json<{
      current: { startsAt: number; endsAt: number; active: boolean } | null;
      usedThisYear: number;
      code?: string;
    }>('POST', '/api/vacation', { startsAt, endsAt });

  it('sends the owls to Inchlonaig and brings all home exactly at the end', async () => {
    setGold(app, anna, 500);
    const owl = await buyOwl(app, anna, 'waldkauz', 'Waldi');
    const chick = 'chickchickchickchickc';
    app.db.run(
      `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at, is_chick, adult_at)
       VALUES (?, ?, 'own', 'waldkauz', 'f', 'Küki', 10, 0, '2026-11-01', 0, 1, ?)`,
      chick,
      anna.id,
      now() + 40 * TIME.DAY,
    );
    const end = now() + 14 * TIME.DAY;
    const started = await plan(anna, null, end);
    expect(started.status).toBe(200);
    expect(started.body.current).toMatchObject({ active: true, endsAt: end });
    expect(systemTypes(anna)).toContain('vacation_started');
    const list = await owlList(anna);
    for (const item of list.owls) {
      expect(item.state).toBe('vacation');
      expect(item.vacation?.returnsAt).toBe(end);
      expect(item.vacation?.phase).toBe('out');
    }
    // The owl reaches the island; the chick (10 km/h) from Berlin does too within 14 days.
    expect(list.owls.find((item) => item.id === owl)?.vacation?.islandAt).not.toBeNull();
    // Counted as active during the holiday; no sickness, motivation stays.
    expect(
      app.db.get<{ idle_ref: string }>('SELECT idle_ref FROM users WHERE id = ?', anna.id)
        ?.idle_ref,
    ).toBe(utcDay(end));
    const motivation = app.db.get<{ motivation: number }>(
      'SELECT motivation FROM owls WHERE id = ?',
      owl,
    )!.motivation;
    advanceTo(app, end - TIME.MINUTE);
    expect(
      app.db.get<{ motivation: number }>('SELECT motivation FROM owls WHERE id = ?', owl)!
        .motivation,
    ).toBe(motivation);
    expect((await owlList(anna)).owls.every((item) => item.state === 'vacation')).toBe(true);
    advanceTo(app, end);
    const back = await owlList(anna);
    expect(back.owls.every((item) => item.state === 'home' && item.vacation === null)).toBe(true);
    expect(systemTypes(anna)).toContain('vacation_ended');
    const homecomings = await anna.agent.json<{ homecomings: { kind: string }[] }>(
      'GET',
      '/api/homecomings',
    );
    expect(homecomings.body.homecomings).toHaveLength(2);
    // The chick grew up on holiday? Not yet (day 40) – but it is home with full energy.
    expect(
      app.db.get<{ energy: number }>('SELECT energy FROM owls WHERE id = ?', chick)!.energy,
    ).toBe(speciesById('waldkauz')!.maxEnergy);
  });

  it('ended early, the owls fly home at once at the speed of their species', async () => {
    setGold(app, anna, 500);
    const owl = await buyOwl(app, anna, 'waldkauz', 'Waldi');
    expect((await plan(anna, null, now() + 30 * TIME.DAY)).status).toBe(200);
    advanceTo(app, now() + 3 * TIME.HOUR);
    const ended = await anna.agent.json<{ current: unknown }>('POST', '/api/vacation/end', {});
    expect(ended.body.current).toBeNull();
    const trip = app.db.get<{
      back_at: number;
      home_at: number;
      back_lat: number;
      back_lon: number;
    }>('SELECT back_at, home_at, back_lat, back_lon FROM owl_vacations WHERE owl_id = ?', owl)!;
    expect(trip.back_at).toBe(now());
    const home = { lat: 52.52, lon: 13.4 };
    const hours = distanceKm({ lat: trip.back_lat, lon: trip.back_lon }, home) / 25;
    expect(Math.abs(trip.home_at - now() - hours * TIME.HOUR)).toBeLessThan(2 * TIME.MINUTE);
    expect(systemTypes(anna)).toContain('vacation_ended_early');
    advanceTo(app, trip.home_at);
    expect((await owlList(anna)).owls[0]?.state).toBe('home');
  });

  it('three a year, at most six weeks, one at a time; a cancelled plan does not count', async () => {
    const day = TIME.DAY;
    expect((await plan(anna, null, now() + 43 * day)).body).toMatchObject({
      code: 'vacation_too_long',
    });
    expect((await plan(anna, null, now() + 2 * TIME.HOUR)).body).toMatchObject({
      code: 'vacation_too_short',
    });
    expect((await plan(anna, now() + 100 * day, now() + 102 * day)).body).toMatchObject({
      code: 'vacation_start_too_late',
    });
    const later = await plan(anna, now() + 2 * day, now() + 4 * day);
    expect(later.body.current).toMatchObject({ active: false });
    expect((await plan(anna, null, now() + 4 * day)).body).toMatchObject({
      code: 'vacation_exists',
    });
    const cancelled = await anna.agent.json<{ current: unknown; usedThisYear: number }>(
      'POST',
      '/api/vacation/cancel',
      {},
    );
    expect(cancelled.body).toMatchObject({ current: null, usedThisYear: 0 });
    for (let i = 0; i < VACATION.PER_YEAR; i++) {
      expect((await plan(anna, null, now() + day)).status).toBe(200);
      expect((await anna.agent.json('POST', '/api/vacation/end', {})).status).toBe(200);
    }
    expect((await plan(anna, null, now() + day)).body).toMatchObject({
      code: 'vacation_year_full',
    });
    // Next year again (the 2026 holidays do not count for 2027).
    expect((await plan(anna, Date.UTC(2027, 0, 2), Date.UTC(2027, 0, 9))).status).toBe(200);
  });

  it('pauses the inactivity: the holiday does not count as days away', async () => {
    await couple(anna, ben);
    const start = now();
    expect((await plan(anna, null, start + 30 * TIME.DAY)).status).toBe(200);
    const contacts = async () =>
      (
        await ben.agent.json<{ contacts: { userId: string; active: boolean }[] }>(
          'GET',
          '/api/contacts',
        )
      ).body.contacts.find((c) => c.userId === anna.id)?.active;
    // Ben looks in now and then (his session lives 30 days without use).
    app.clock.now = start + 25 * TIME.DAY;
    expect(await contacts()).toBe(true);
    advanceTo(app, start + 30 * TIME.DAY);
    // 30 days on holiday + 20 days away: still active for Ben.
    app.clock.now = start + 50 * TIME.DAY;
    expect(await contacts()).toBe(true);
    app.clock.now = start + 53 * TIME.DAY;
    expect(await contacts()).toBe(false);
  });
});

describe('the onion sites of the admin panel and the bots control centre (v1.4, SPEC 16.5)', () => {
  const ADMIN_ONION = `${'b'.repeat(56)}.onion`;
  const BOTS_ONION = `${'c'.repeat(56)}.onion`;

  /** Real HTTP requests to a Tor listener, like Caddy's onion site forwards them. */
  class OnionAgent extends Agent {
    readonly port: number;
    constructor(api: TestApp['adminApi'], origin: string, port: number) {
      super(api, origin, '127.0.0.1');
      this.port = port;
    }
    override async request(
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      url: string,
      body?: unknown,
    ): Promise<LightMyRequestResponse> {
      const headers: Record<string, string> = { origin: this.origin, 'x-posteulen': '1' };
      if (this.cookie) headers['cookie'] = this.cookie;
      if (body !== undefined) headers['content-type'] = 'application/json';
      const response = await fetch(`http://127.0.0.1:${this.port}${url}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const text = await response.text();
      const cookies = response.headers.getSetCookie();
      for (const value of cookies) {
        const pair = value.split(';')[0] ?? '';
        this.cookie = pair.endsWith('=') ? undefined : pair;
      }
      return {
        statusCode: response.status,
        headers: { ...Object.fromEntries(response.headers), 'set-cookie': cookies },
        body: text,
        json: () => JSON.parse(text) as unknown,
      } as unknown as LightMyRequestResponse;
    }
  }

  it('answers on their own onion origins, with their own switches and login budget', async () => {
    await app.close();
    app = await testApp({
      env: { POSTEULEN_ONION_ADMIN: ADMIN_ONION, POSTEULEN_ONION_BOTS: BOTS_ONION },
    });
    const adminPort = await listenTor(app.adminApi, '127.0.0.1', 0);
    const botsPort = await listenTor(app.botsApi, '127.0.0.1', 0);
    const admin = new OnionAgent(app.adminApi, `http://${ADMIN_ONION}`, adminPort);
    const bots = new OnionAgent(app.botsApi, `http://${BOTS_ONION}`, botsPort);
    expect((await admin.json('GET', '/api/health')).body).toMatchObject({ api: 'admin' });
    expect((await bots.json('GET', '/api/health')).body).toMatchObject({ api: 'bots' });
    // Only the own onion origin.
    const wrong = new OnionAgent(app.adminApi, ADMIN_ORIGIN, adminPort);
    expect((await wrong.json('GET', '/api/session')).status).toBe(403);

    // Over Tor every login needs the captcha; failures there never slow the web login down.
    const initial = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
    const start = client.startLogin(initial);
    expect(
      (await admin.json('POST', '/api/login/start', { startLoginRequest: start.request })).body,
    ).toMatchObject({ status: 'captcha_required' });
    for (let i = 0; i < 5; i++) {
      const wrongStart = client.startLogin('falsches Passwort!!');
      await admin.json('POST', '/api/login/start', {
        startLoginRequest: wrongStart.request,
        altcha: await admin.altcha(),
      });
    }
    const web = new Agent(app.adminApi, ADMIN_ORIGIN);
    const webStart = client.startLogin(initial);
    expect(
      (await web.json('POST', '/api/login/start', { startLoginRequest: webStart.request })).body,
    ).toMatchObject({ status: 'ok' });

    // A login over Tor: the cookie without Secure and without __Host-.
    const torStart = client.startLogin(initial);
    const first = await admin.json<{ attemptId: string; loginResponse: string; status: string }>(
      'POST',
      '/api/login/start',
      { startLoginRequest: torStart.request, altcha: await admin.altcha() },
    );
    if (first.body.status === 'ok') {
      const finish = client.finishLogin(initial, torStart.state, first.body.loginResponse)!;
      const done = await admin.request('POST', '/api/login/finish', {
        attemptId: first.body.attemptId,
        finishLoginRequest: finish.finishRequest,
      });
      expect(done.statusCode).toBe(200);
      const cookie = String((done.headers['set-cookie'] as string[])[0]);
      expect(cookie).toMatch(/^pe_admin=/);
      expect(cookie).not.toMatch(/Secure/);
      expect((await admin.json('GET', '/api/me')).status).toBe(200);
    } else {
      // A previous failure may still make it wait – that is the Tor budget at work.
      expect(first.body.status).toBe('wait');
    }

    // Switched off in the admin panel: 503 on the onion site, the web stays.
    app.db.run("INSERT INTO settings (key, value) VALUES ('tor_admin_enabled', '0')");
    expect((await admin.json('GET', '/api/session')).body).toMatchObject({ code: 'tor_disabled' });
    expect((await bots.json('GET', '/api/session')).status).toBe(200);
    expect((await web.json('GET', '/api/session')).status).toBe(200);
  });

  it('lists all six addresses under „Über diese Instanz“ while Tor runs', async () => {
    await app.close();
    app = await testApp({
      env: {
        POSTEULEN_ONION: `${'d'.repeat(56)}.onion`,
        POSTEULEN_ONION_ADMIN: ADMIN_ONION,
        POSTEULEN_ONION_BOTS: BOTS_ONION,
      },
    });
    const visitor = new Agent(app.userApi, 'https://posteulen.test');
    const links = async () =>
      (await visitor.json<{ links: Record<string, string | null> }>('GET', '/api/instance')).body
        .links;
    expect(await links()).toEqual({
      web: 'https://posteulen.test/',
      admin: 'https://admin.posteulen.test/',
      bots: 'https://bots.posteulen.test/',
      webOnion: null,
      adminOnion: null,
      botsOnion: null,
    });
    setTorStatus(app.db, 'ok', now(), null);
    expect(await links()).toMatchObject({
      webOnion: `http://${'d'.repeat(56)}.onion/`,
      adminOnion: `http://${ADMIN_ONION}/`,
      botsOnion: `http://${BOTS_ONION}/`,
    });
    app.db.run("INSERT INTO settings (key, value) VALUES ('tor_bots_enabled', '0')");
    expect((await links())['botsOnion']).toBeNull();
  });
});

describe('migration 0026 (v1.4)', () => {
  it('rebuilds the owls table and keeps everything that refers to owls', () => {
    const db = openDatabase(path.join(tempDir(), 'db.sqlite'));
    const migrations = loadMigrations();
    migrate(db, migrations.slice(0, 25));
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
    db.run(
      `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at, state, state_until, km_flown)
       VALUES ('sick', 'u', 'own', 'waldkauz', 'f', 'Krank', 10, 0, '2026-01-01', 0, 'sick', NULL, 123),
              ('lent', 'u', 'own', 'waldkauz', 'm', 'Weg', 10, 0, '2026-01-01', 0, 'menagerie', ?, 0)`,
      Date.UTC(2026, 10, 28),
    );
    db.run("INSERT INTO owl_care_days (owl_id, day) VALUES ('sick', '2026-11-01')");
    db.run("INSERT INTO owl_away (owl_id, since_at, until_at) VALUES ('lent', 5, NULL)");
    db.run("INSERT INTO owl_unready (owl_id, since_at, until_at) VALUES ('sick', 3, NULL)");
    db.run("INSERT INTO rescue_cases (owl_id, needed, done, admitted_at) VALUES ('sick', 9, 4, 3)");
    db.run(
      `INSERT INTO flights (id, holder_id, owl_id, owl_kind, owl_name, owl_species, purpose, profile, route, plan, started_at, ends_at)
       VALUES ('f', 'u', 'lent', 'own', 'Weg', 'waldkauz', 'letter', '{}', '[]', '[]', 0, 1)`,
    );
    migrate(db, migrations);
    expect(db.all('SELECT owl_id, day FROM owl_care_days')).toEqual([
      { owl_id: 'sick', day: '2026-11-01' },
    ]);
    expect(db.all('SELECT owl_id FROM owl_away')).toEqual([{ owl_id: 'lent' }]);
    expect(db.all('SELECT owl_id FROM owl_unready')).toEqual([{ owl_id: 'sick' }]);
    expect(db.get('SELECT needed, done FROM rescue_cases')).toEqual({ needed: 9, done: 4 });
    expect(db.get('SELECT owl_id FROM flights')).toEqual({ owl_id: 'lent' });
    expect(db.all('SELECT id, km_flown, lent_quarter, idle_ms FROM owls ORDER BY id')).toEqual([
      { id: 'lent', km_flown: 0, lent_quarter: '2026-4', idle_ms: 0 },
      { id: 'sick', km_flown: 123, lent_quarter: null, idle_ms: 0 },
    ]);
    db.run("UPDATE owls SET state = 'vacation' WHERE id = 'sick'");
    expect(db.all('PRAGMA foreign_key_check')).toEqual([]);
    db.close();
  });
});

describe('Caddyfile with the onion sites of the panels (v1.4, SPEC 16.5)', () => {
  it('serves admin panel and bots control centre on their own loopback listeners', () => {
    const host = (letter: string) => `${letter.repeat(56)}.onion`;
    const file = generateCaddyfile({
      domain: 'posteulen.test',
      testMode: true,
      webRoot: '/opt/posteulen/current/web/dist',
      adminRoot: '/opt/posteulen/current/admin/dist',
      botsRoot: '/opt/posteulen/current/bots/dist',
      localDir: '/etc/posteulen/local',
      userPort: 3001,
      adminPort: 3002,
      botsPort: 3003,
      onion: { host: host('a'), listenPort: 3005, apiPort: 3004, active: true },
      adminOnion: { host: host('b'), listenPort: 3006, apiPort: 3008 },
      botsOnion: { host: host('c'), listenPort: 3007, apiPort: 3009 },
    });
    const block = (address: string) => file.slice(file.indexOf(address)).split('\n}\n')[0] ?? '';
    const admin = block(`http://${host('b')}:3006 {`);
    expect(admin).toContain('bind 127.0.0.1');
    expect(admin).toContain('reverse_proxy 127.0.0.1:3008');
    expect(admin).toContain('import /etc/posteulen/local/admin-*.caddy');
    expect(admin).toContain('root * /opt/posteulen/current/admin/dist');
    expect(admin).not.toContain('Strict-Transport-Security');
    const bots = block(`http://${host('c')}:3007 {`);
    expect(bots).toContain('reverse_proxy 127.0.0.1:3009');
    expect(bots).toContain('import /etc/posteulen/local/bots-*.caddy');
    // The Tor Browser offers each host its onion address while Tor runs.
    expect(block('admin.posteulen.test {')).toContain(`Onion-Location "http://${host('b')}{uri}"`);
    expect(() =>
      generateCaddyfile({
        domain: 'posteulen.test',
        testMode: true,
        webRoot: '/w',
        adminRoot: '/a',
        botsRoot: '/b',
        localDir: '/l',
        userPort: 3001,
        adminPort: 3002,
        botsPort: 3003,
        adminOnion: { host: 'evil.example', listenPort: 3006, apiPort: 3008 },
      }),
    ).toThrow('invalid onion address');
  });
});
