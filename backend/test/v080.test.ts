/**
 * Version 0.8: bots of the control centre (SPEC 10.6 ff., Anhang S, T) – one identity for all,
 * isolated conversations, events, own and loan owls, AI personalisation, deletion, export/import.
 */
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import { AiError, storeApiKey, type AiClient, type AiMessage } from '../src/bots/ai.ts';
import { removeRelatives } from '../src/bots/relatives.ts';
import { startFlight } from '../src/flights/service.ts';
import {
  ADMIN_ORIGIN,
  Agent,
  BERLIN,
  BOTS_ORIGIN,
  advanceTo,
  borrowOwl,
  buyOwl,
  PARIS,
  person,
  register,
  setGold,
  testApp,
  USER_ORIGIN,
  type Person,
  type TestApp,
} from './auth-helpers.ts';

class FakeAi implements AiClient {
  calls: { messages: readonly AiMessage[] }[] = [];
  answers: (string | Error)[] = [];
  async complete(_key: string, _model: string, messages: readonly AiMessage[]) {
    this.calls.push({ messages });
    const next = this.answers.shift() ?? 'KI-Brief: Danke für deine Zeilen!';
    if (next instanceof Error) throw next;
    return next;
  }
  async listModels() {
    return ['gpt-test'];
  }
}

let app: TestApp;
let ai: FakeAi;
let centre: Agent;

async function panelAgent(api: 'bots' | 'admin', password: string): Promise<Agent> {
  const agent =
    api === 'bots' ? new Agent(app.botsApi, BOTS_ORIGIN) : new Agent(app.adminApi, ADMIN_ORIGIN);
  await client.ready();
  const start = client.startLogin(password);
  const first = await agent.json<{ attemptId: string; loginResponse: string }>(
    'POST',
    '/api/login/start',
    { startLoginRequest: start.request },
  );
  const result = client.finishLogin(password, start.state, first.body.loginResponse)!;
  await agent.json('POST', '/api/login/finish', {
    attemptId: first.body.attemptId,
    finishLoginRequest: result.finishRequest,
  });
  return agent;
}

/** Lets time pass in small steps: the runner starts letters at the real time (SPEC 10.8). */
async function settle(at = app.clock.now): Promise<void> {
  const step = 10 * TIME.MINUTE;
  for (let t = Math.min(app.clock.now + step, at); ; t = Math.min(t + step, at)) {
    for (let i = 0; i < 3; i++) {
      advanceTo(app, t);
      await app.ctx.centralBots.idle();
    }
    if (t >= at) break;
  }
  // The control centre stays signed in during the test (12 hours idle expiry, SPEC 10.12).
  app.db.run('UPDATE bots_admin_sessions SET last_used_at = ?', app.clock.now);
}

const TEXTS = {
  de: { first: 'Hallo, ich bin neu hier!', follow: 'Hallo wieder!' },
  en: { first: 'Hello, I am new here!', follow: 'Hello again!' },
};

async function newBot(
  name = 'Kapitän Ahoi',
  settings: Partial<Record<string, unknown>> = {},
): Promise<string> {
  const created = await centre.json<{ id: string }>('POST', '/api/bots', { name });
  expect(created.status).toBe(200);
  const id = created.body.id;
  const saved = await centre.json('PUT', `/api/bots/${id}/settings`, {
    name,
    character: 'Ein freundlicher Seefahrer.',
    home: PARIS,
    owlMode: 'own',
    owlSpecies: 'waldkauz',
    owlName: 'Möwe',
    motivation: 200,
    restHours: 24,
    playerOwls: false,
    ...settings,
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  return id;
}

async function activate(id: string): Promise<void> {
  const result = await centre.json('POST', `/api/bots/${id}/state`, { state: 'active' });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
}

async function planLetter(
  botId: string,
  dueAt: number,
  extra: Partial<Record<string, unknown>> = {},
): Promise<string> {
  const result = await centre.json<{ id: string }>('POST', `/api/bots/${botId}/events`, {
    dueAt,
    move: null,
    letter: { parchment: 'small', owlMode: 'default', texts: TEXTS, media: [] },
    gift: null,
    context: 'Er ist gerade auf großer Fahrt.',
    ...extra,
  });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body.id;
}

function lettersOf(botId: string, userId: string) {
  return app.db.all<{ id: string; plaintext: string; status: string; flight_id: string }>(
    'SELECT id, plaintext, status, flight_id FROM letters WHERE sender_id = ? AND recipient_id = ? ORDER BY sent_at, id',
    botId,
    userId,
  );
}

beforeEach(async () => {
  ai = new FakeAi();
  app = await testApp({ aiClient: ai });
  const password = await setInitialAdminPassword(
    app.db,
    app.secrets.opaqueServerSetup,
    'bots_admin',
  );
  centre = await panelAgent('bots', password);
  app.db.run('UPDATE bots_admin SET must_change_password = 0');
});
afterEach(async () => {
  await app.ctx.centralBots.idle();
  await app.close();
});

describe('aunt and uncle are gone (v0.8, SPEC Anhang T)', () => {
  it('removes them with chats, letters, bookings and messages; gold stays; own owls turn back', async () => {
    const anna = await person(app, 'Anna');
    app.db.run('DROP TRIGGER bots_explainer_only');
    app.db.run(
      "INSERT INTO bots (id, owner_id, type, first_name, home_lat, home_lon, in_addressbook) VALUES ('AuntAuntAuntAuntAunt01', ?, 'aunt', 'Emma', 4886, 235, 1)",
      anna.id,
    );
    app.db.run(
      "INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, plaintext, status, owl_name, owl_species) VALUES ('LetterLetterLetterLe01', 'AuntAuntAuntAuntAunt01', ?, 'letter', 'small', 0, 0, 'Hallo Herzchen', 'delivered', 'Uhu', 'waldkauz')",
      anna.id,
    );
    app.db.run(
      "INSERT INTO chats (owner_id, peer_id, peer_kind, last_activity_at, unread) VALUES (?, 'AuntAuntAuntAuntAunt01', 'bot', 0, 1)",
      anna.id,
    );
    app.db.run(
      "INSERT INTO transactions (user_id, at, type, amount, counterpart_label) VALUES (?, 0, 'aunt_gift', 40, 'Tante Emma')",
      anna.id,
    );
    app.db.run(
      `INSERT INTO system_messages (id, user_id, type, params, created_at) VALUES ('MessageMessageMessag01', ?, 'gold_arrived', '{"name":"Tante Emma","amount":40,"owl":""}', 0)`,
      anna.id,
    );
    app.ctx.queue.schedule('bot_gold', 'AuntAuntAuntAuntAunt01', app.clock.now + TIME.DAY);
    // v0.8.1: an own owl on its way to the aunt (crashed the start of 0.8.0 on a real server).
    setGold(app, anna, 200);
    const owl = await buyOwl(app, anna);
    app.db.run("UPDATE owls SET state = 'flying' WHERE id = ?", owl);
    startFlight(app.ctx, {
      holderId: anna.id,
      owl: {
        id: owl,
        kind: 'own',
        name: 'Waldi',
        species: 'waldkauz',
        energy: 540,
        motivation: 10,
      },
      recipients: ['AuntAuntAuntAuntAunt01'],
      returnsHome: true,
      now: app.clock.now,
      purpose: 'letter',
    });
    const gold = app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', anna.id)!.gold;
    expect(removeRelatives(app.ctx)).toBe(1);
    // The owl turns back home; no message names the aunt.
    const flight = app.db.get<{ route: string }>(
      "SELECT route FROM flights WHERE state = 'active'",
    )!;
    expect(
      (JSON.parse(flight.route) as { type: string; status: string }[]).map((stop) => [
        stop.type,
        stop.status,
      ]),
    ).toEqual([
      ['deliver', 'skipped'],
      ['home', 'pending'],
    ]);
    expect(app.db.all("SELECT 1 FROM system_messages WHERE type = 'letter_returned'")).toEqual([]);
    expect(removeRelatives(app.ctx)).toBe(0);
    for (const sql of [
      "SELECT 1 FROM bots WHERE type != 'explainer'",
      "SELECT 1 FROM letters WHERE sender_id = 'AuntAuntAuntAuntAunt01'",
      "SELECT 1 FROM chats WHERE peer_id = 'AuntAuntAuntAuntAunt01'",
      "SELECT 1 FROM transactions WHERE type = 'aunt_gift'",
      "SELECT 1 FROM system_messages WHERE params LIKE '%Tante%'",
      "SELECT 1 FROM scheduled_events WHERE type = 'bot_gold'",
    ])
      expect(app.db.all(sql), sql).toEqual([]);
    expect(app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', anna.id)!.gold).toBe(
      gold,
    );
  });
});

describe('access to the control centre (SPEC 10.12)', () => {
  it('own password, own cookie, password change first, 12 hours idle expiry', async () => {
    const password = await setInitialAdminPassword(
      app.db,
      app.secrets.opaqueServerSetup,
      'bots_admin',
    );
    const fresh = await panelAgent('bots', password);
    expect((await fresh.json('GET', '/api/bots')).body).toMatchObject({
      code: 'password_change_required',
    });
    // The admin password does not open the control centre, and its cookie is not valid there.
    const adminPassword = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
    const admin = await panelAgent('admin', adminPassword);
    const stranger = new Agent(app.botsApi, BOTS_ORIGIN);
    stranger.cookie = admin.cookie?.replace('pe_admin', 'pe_bots');
    expect((await stranger.json('GET', '/api/bots')).status).toBe(401);
    expect((await centre.json('GET', '/api/bots')).status).toBe(401);
    app.db.run('UPDATE bots_admin SET must_change_password = 0');
    expect((await fresh.json('GET', '/api/bots')).status).toBe(200);
    app.clock.now += ACCOUNT.BOTS_SESSION_IDLE_HOURS * TIME.HOUR - TIME.MINUTE;
    expect((await fresh.json('GET', '/api/bots')).status).toBe(200);
    app.clock.now += ACCOUNT.BOTS_SESSION_IDLE_HOURS * TIME.HOUR + TIME.MINUTE;
    expect((await fresh.json('GET', '/api/bots')).body).toMatchObject({ code: 'unauthorized' });
  });
});

describe('bots of the control centre (SPEC 10.6–10.10)', () => {
  it('a new bot is an empty draft; activation needs name, home on land and an owl', async () => {
    const created = await centre.json<{ id: string }>('POST', '/api/bots', { name: 'Leuchtturm' });
    const id = created.body.id;
    const view = await centre.json<{ state: string; problems: string[] }>('GET', `/api/bots/${id}`);
    expect(view.body).toMatchObject({
      state: 'draft',
      problems: ['home', 'owl_species', 'owl_name'],
    });
    expect(
      (await centre.json('POST', `/api/bots/${id}/state`, { state: 'active' })).body,
    ).toMatchObject({
      code: 'bot_incomplete',
    });
    const base = {
      name: 'Leuchtturm',
      character: '',
      owlMode: 'loan',
      owlSpecies: null,
      owlName: null,
      motivation: 10,
      restHours: 0,
      playerOwls: true,
    };
    // In the Pacific: water. In Sydney: land anywhere in the world is fine for bots.
    expect(
      (
        await centre.json('PUT', `/api/bots/${id}/settings`, {
          ...base,
          home: { lat: 0, lon: -150 },
        })
      ).body,
    ).toMatchObject({ code: 'home_not_land' });
    expect(
      (
        await centre.json('PUT', `/api/bots/${id}/settings`, {
          ...base,
          home: { lat: -33.87, lon: 151 },
        })
      ).status,
    ).toBe(200);
    // The phoenix is not for bots.
    expect(
      (
        await centre.json('PUT', `/api/bots/${id}/settings`, {
          ...base,
          home: PARIS,
          owlMode: 'own',
          owlSpecies: 'phoenix',
          owlName: 'Fu',
        })
      ).status,
    ).toBe(400);
    await activate(id);
    // Names are unique among bots and players – in both directions.
    expect((await centre.json('POST', '/api/bots', { name: 'leuchtturm' })).body).toMatchObject({
      code: 'name_unavailable',
    });
    await person(app, 'Anna');
    expect((await centre.json('POST', '/api/bots', { name: 'Anna' })).body).toMatchObject({
      code: 'name_unavailable',
    });
    expect(
      (
        await register(
          new Agent(app.userApi, USER_ORIGIN),
          'Leuchtturm',
          'ein sehr langes Passwort',
        )
      ).body,
    ).toMatchObject({ code: 'name_unavailable' });
  });

  it('events: first contact and follow-up variant, once per player, appears with the first letter', async () => {
    const anna = await person(app, 'Anna', BERLIN);
    const ben = await person(app, 'Ben', BERLIN, 'en');
    const carla = await person(app, 'Carla', BERLIN);
    app.db.run('UPDATE users SET bots_disabled = 1 WHERE id = ?', carla.id);
    const bot = await newBot('Kapitän Ahoi', { owlMode: 'loan', restHours: 0 });
    await activate(bot);
    const first = await planLetter(bot, app.clock.now + TIME.HOUR);
    const second = await planLetter(bot, app.clock.now + 2 * TIME.HOUR);
    await settle(app.clock.now + TIME.HOUR);
    // Restart-safe: running the event again changes nothing (stable ID, unique per player).
    app.ctx.queue.schedule('cbot_event', first, app.clock.now);
    await settle();
    expect(lettersOf(bot, anna.id).map((l) => l.plaintext)).toEqual([TEXTS.de.first]);
    expect(lettersOf(bot, ben.id).map((l) => l.plaintext)).toEqual([TEXTS.en.first]);
    expect(lettersOf(bot, carla.id)).toEqual([]);
    // Not visible before the letter has arrived.
    const chats = async (who: Person) =>
      (
        await who.agent.json<{ chats: { peerId: string; name: string | null }[] }>(
          'GET',
          '/api/chats',
        )
      ).body.chats.filter((chat) => chat.peerId === bot);
    expect(await chats(anna)).toEqual([]);
    await settle(app.clock.now + 2 * TIME.HOUR);
    expect(await chats(anna)).toEqual([expect.objectContaining({ name: 'Kapitän Ahoi' })]);
    const map = await anna.agent.json<{ contacts: { id: string; bot: boolean }[] }>(
      'GET',
      '/api/map',
    );
    expect(map.body.contacts).toContainEqual(expect.objectContaining({ id: bot, bot: true }));
    expect(
      (await anna.agent.json<{ bots: { userId: string }[] }>('GET', '/api/contacts')).body.bots.map(
        (b) => b.userId,
      ),
    ).toContain(bot);
    // A new player gets nothing of an event that already ran.
    const dora = await person(app, 'Dora', BERLIN);
    await settle(app.clock.now + 10 * TIME.HOUR);
    expect(lettersOf(bot, anna.id).map((l) => l.plaintext)).toEqual([
      TEXTS.de.first,
      TEXTS.de.follow,
    ]);
    expect(lettersOf(bot, dora.id)).toEqual([]);
    const events = await centre.json<{
      past: { id: string; state: string; stats: { sent: number } }[];
    }>('GET', `/api/bots/${bot}/events`);
    expect(events.body.past.map((e) => [e.id, e.state, e.stats.sent])).toEqual([
      [first, 'archived', 2],
      [second, 'archived', 2],
    ]);
    const overview = await centre.json<{
      bots: { stats: { total: { sent: number; delivered: number } } }[];
    }>('GET', '/api/bots');
    expect(overview.body.bots[0]!.stats.total).toMatchObject({ sent: 4, delivered: 4 });
    // Started events cannot be changed any more.
    expect((await centre.json('DELETE', `/api/bots/${bot}/events/${first}`)).status).toBe(409);
  });

  it('own owl: the next letter waits until the owl is back; a reply with the resting owl', async () => {
    const anna = await person(app, 'Anna', BERLIN);
    const bot = await newBot('Kapitän Ahoi', { restHours: 24 });
    await activate(bot);
    await planLetter(bot, app.clock.now + TIME.HOUR);
    await planLetter(bot, app.clock.now + 2 * TIME.HOUR);
    await settle(app.clock.now + 6 * TIME.HOUR);
    // The bot's owl rests at Anna's: the second letter has not started yet.
    expect(lettersOf(bot, anna.id)).toHaveLength(1);
    const owls = await anna.agent.json<{
      guests: { id: string; holderName: string; bot?: boolean }[];
    }>('GET', '/api/owls');
    expect(owls.body.guests).toEqual([
      expect.objectContaining({ holderName: 'Kapitän Ahoi', bot: true, name: 'Möwe' }),
    ]);
    // v0.8.3: a bot owl can be cared for (free; details in v083.test.ts).
    expect(
      (await anna.agent.json('POST', `/api/owls/${owls.body.guests[0]!.id}/pet`, {})).status,
    ).toBe(200);
    // Writing with own or loan owls is not allowed for this bot – the resting owl always is.
    const loan = await borrowOwl(anna);
    expect(
      (
        await anna.agent.json('POST', '/api/bot-letters/send', {
          botId: bot,
          owlId: loan,
          parchment: 'small',
          text: 'Hallo Kapitän!',
        })
      ).body,
    ).toMatchObject({ code: 'bot_owls_only' });
    const reply = await anna.agent.json('POST', '/api/bot-letters/send', {
      botId: bot,
      owlId: `guest:${owls.body.guests[0]!.id}`,
      parchment: 'small',
      text: 'Hallo Kapitän, wie ist das Meer?',
    });
    expect(reply.status, JSON.stringify(reply.body)).toBe(200);
    // One letter per calendar day.
    expect(
      (
        await anna.agent.json('POST', '/api/bot-letters/send', {
          botId: bot,
          owlId: `guest:${owls.body.guests[0]!.id}`,
          parchment: 'small',
          text: 'Noch einer',
        })
      ).body,
    ).toMatchObject({ code: 'bot_write_lock' });
    // The owl flies home with the reply; then the second letter goes – personalised by the AI.
    await storeApiKey(app.ctx, 'sk-test-0000000000000000', app.clock.now);
    await settle(app.clock.now + 12 * TIME.HOUR);
    const letters = lettersOf(bot, anna.id);
    expect(letters).toHaveLength(2);
    expect(letters[1]!.plaintext).toBe('KI-Brief: Danke für deine Zeilen!');
    expect(JSON.stringify(ai.calls[0]!.messages)).toContain('Hallo wieder!');
    expect(JSON.stringify(ai.calls[0]!.messages)).toContain('wie ist das Meer');
    expect(JSON.stringify(ai.calls[0]!.messages)).not.toContain('Anna');
    expect(app.db.all('SELECT state FROM central_bot_inbox')).toEqual([{ state: 'answered' }]);
    expect(
      app.db.get<{ replies: number }>('SELECT SUM(replies) AS replies FROM central_bot_stats')
        ?.replies,
    ).toBe(1);
  });

  it('without AI the planned letter goes unchanged; spontaneous replies wait for the AI', async () => {
    const anna = await person(app, 'Anna', BERLIN);
    const bot = await newBot('Kapitän Ahoi', { owlMode: 'loan', restHours: 0, playerOwls: true });
    await activate(bot);
    await planLetter(bot, app.clock.now + TIME.HOUR);
    await settle(app.clock.now + 8 * TIME.HOUR);
    const loan = await borrowOwl(anna);
    const sent = await anna.agent.json<{ letters: { arrivesAt: number }[] }>(
      'POST',
      '/api/bot-letters/send',
      {
        botId: bot,
        owlId: loan,
        parchment: 'small',
        text: 'Ahoi zurück!',
      },
    );
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    await settle(sent.body.letters[0]!.arrivesAt);
    expect(app.db.all('SELECT state FROM central_bot_inbox')).toEqual([{ state: 'arrived' }]);
    // Nothing planned for four weeks: a spontaneous reply after 2 hours – without a key it waits.
    await settle(app.clock.now + 2 * TIME.HOUR);
    expect(lettersOf(bot, anna.id)).toHaveLength(1);
    const delivery = app.db.get<{ not_before: number; attempts: number }>(
      "SELECT not_before, attempts FROM central_bot_deliveries WHERE event_id IS NULL AND state = 'pending'",
    )!;
    expect(delivery.attempts).toBe(1);
    await storeApiKey(app.ctx, 'sk-test-0000000000000000', app.clock.now);
    await settle(delivery.not_before);
    expect(lettersOf(bot, anna.id).map((l) => l.plaintext)).toEqual([
      TEXTS.de.first,
      'KI-Brief: Danke für deine Zeilen!',
    ]);
    // An event with an API error: the planned letter goes anyway, the player's letter stays open.
    const loan2 = app.clock.now + TIME.DAY;
    await settle(loan2);
    const owl = await borrowOwl(anna);
    const again = await anna.agent.json<{ letters: { arrivesAt: number }[] }>(
      'POST',
      '/api/bot-letters/send',
      {
        botId: bot,
        owlId: owl,
        parchment: 'small',
        text: 'Und noch was!',
      },
    );
    await settle(again.body.letters[0]!.arrivesAt);
    await planLetter(bot, app.clock.now + TIME.MINUTE * 30);
    ai.answers = [new AiError('api error', 500)];
    await settle(app.clock.now + TIME.MINUTE * 30);
    expect(lettersOf(bot, anna.id).at(-1)!.plaintext).toBe(TEXTS.de.follow);
    expect(app.db.all("SELECT 1 FROM central_bot_inbox WHERE state = 'arrived'")).toHaveLength(1);
  });

  it('deleting a bot is atomic and final; only players with contact get a message', async () => {
    const anna = await person(app, 'Anna', BERLIN);
    const ben = await person(app, 'Ben', BERLIN);
    const bot = await newBot('Kapitän Ahoi', { restHours: 24 });
    await activate(bot);
    await planLetter(bot, app.clock.now + TIME.HOUR);
    await settle(app.clock.now + 6 * TIME.HOUR);
    // Ben removed the bot before: no message for him.
    expect((await ben.agent.json('DELETE', `/api/contacts/${bot}`)).status).toBe(200);
    await planLetter(bot, app.clock.now + TIME.DAY);
    expect(
      (await centre.json('POST', `/api/bots/${bot}/delete`, { name: 'Falscher Name' })).body,
    ).toMatchObject({
      code: 'name_mismatch',
    });
    expect(
      (await centre.json('POST', `/api/bots/${bot}/delete`, { name: 'kapitän ahoi' })).status,
    ).toBe(200);
    for (const table of [
      'central_bots',
      'central_bot_events',
      'central_bot_players',
      'central_bot_deliveries',
      'central_bot_stats',
    ])
      expect(app.db.all(`SELECT 1 FROM ${table}`), table).toEqual([]);
    expect(
      app.db.all('SELECT 1 FROM letters WHERE sender_id = ? OR recipient_id = ?', bot, bot),
    ).toEqual([]);
    expect(
      app.db.all("SELECT 1 FROM flights WHERE holder_kind = 'bot' AND state = 'active'"),
    ).toEqual([]);
    expect(app.db.all("SELECT 1 FROM scheduled_events WHERE type = 'cbot_event'")).toEqual([]);
    const messages = (who: Person) =>
      app.db.all<{ params: string }>(
        "SELECT params FROM system_messages WHERE user_id = ? AND type = 'bot_deleted'",
        who.id,
      );
    expect(messages(anna)).toEqual([{ params: JSON.stringify({ name: 'Kapitän Ahoi' }) }]);
    expect(messages(ben)).toEqual([]);
  });

  it('"Alle Bots entfernen" also keeps away bots created later', async () => {
    const anna = await person(app, 'Anna', BERLIN);
    expect((await anna.agent.json('POST', '/api/bots/remove-all', {})).status).toBe(200);
    const bot = await newBot('Kapitän Ahoi', { owlMode: 'loan', restHours: 0 });
    await activate(bot);
    await planLetter(bot, app.clock.now + TIME.HOUR);
    await settle(app.clock.now + 5 * TIME.HOUR);
    expect(lettersOf(bot, anna.id)).toEqual([]);
  });

  it('pictures: normalised once, without metadata; players see only their own letters’ pictures', async () => {
    const anna = await person(app, 'Anna', BERLIN);
    const bot = await newBot('Kapitän Ahoi', { owlMode: 'loan', restHours: 0 });
    await activate(bot);
    const png = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#88aacc' },
    })
      .withMetadata({ exif: { IFD0: { Copyright: 'Geheim' } } })
      .png()
      .toBuffer();
    const upload = await centre.raw(`/api/bots/${bot}/media`, 'image/png', png);
    expect(upload.statusCode, upload.body).toBe(200);
    const { id, width, height } = upload.json() as { id: string; width: number; height: number };
    expect([width, height]).toEqual([1600, 1067]);
    expect((await centre.raw(`/api/bots/${bot}/media`, 'image/png', png)).json()).toMatchObject({
      id,
    });
    const stored = app.db.get<{ data: Uint8Array }>(
      'SELECT data FROM central_bot_media WHERE id = ?',
      id,
    )!;
    const meta = await sharp(Buffer.from(stored.data)).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    expect(
      (await centre.raw(`/api/bots/${bot}/media`, 'image/png', Buffer.from('kein Bild')))
        .statusCode,
    ).toBe(400);
    expect(
      (await centre.raw(`/api/bots/${bot}/media`, 'image/png', Buffer.alloc(6 * 1024 * 1024)))
        .statusCode,
    ).toBe(413);
    await planLetter(bot, app.clock.now + TIME.HOUR, {
      letter: { parchment: 'small', owlMode: 'default', texts: TEXTS, media: [id] },
    });
    const ben = await person(app, 'Ben', BERLIN);
    expect((await anna.agent.request('GET', `/api/bot-media/${id}`)).statusCode).toBe(404);
    app.db.run('UPDATE users SET bots_disabled = 1 WHERE id = ?', ben.id);
    await settle(app.clock.now + 5 * TIME.HOUR);
    const letters = await anna.agent.json<{ letters: { media: string[] }[] }>(
      'GET',
      `/api/chats/${bot}/letters`,
    );
    expect(letters.body.letters[0]!.media).toEqual([id]);
    const picture = await anna.agent.request('GET', `/api/bot-media/${id}`);
    expect(picture.statusCode).toBe(200);
    expect(picture.headers['content-type']).toBe('image/webp');
    expect((await ben.agent.request('GET', `/api/bot-media/${id}`)).statusCode).toBe(404);
  });

  it('gold and owl gifts in events (like vouchers)', async () => {
    const anna = await person(app, 'Anna', BERLIN);
    setGold(app, anna, 30);
    const bot = await newBot('Kapitän Ahoi', { owlMode: 'loan', restHours: 0 });
    await activate(bot);
    await planLetter(bot, app.clock.now + TIME.HOUR, { gift: { gold: 25 } });
    await planLetter(bot, app.clock.now + 2 * TIME.HOUR, {
      letter: null,
      gift: { species: 'schneeeule' },
    });
    await settle(app.clock.now + 8 * TIME.HOUR);
    expect(app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', anna.id)?.gold).toBe(
      55,
    );
    expect(
      app.db.all(
        "SELECT species, name FROM owls WHERE owner_id = ? AND species = 'schneeeule'",
        anna.id,
      ),
    ).toEqual([{ species: 'schneeeule', name: null }]);
    expect(lettersOf(bot, anna.id)).toHaveLength(1);
    expect(
      app.db.all(
        "SELECT type FROM system_messages WHERE user_id = ? AND type IN ('gold_arrived', 'bot_owl_gift')",
        anna.id,
      ),
    ).toEqual([{ type: 'gold_arrived' }, { type: 'bot_owl_gift' }]);
  });

  it('export and import: adds, never overwrites; past events are not sent again; conflicts first', async () => {
    const anna = await person(app, 'Anna', BERLIN);
    const bot = await newBot('Kapitän Ahoi', { owlMode: 'loan', restHours: 0 });
    await activate(bot);
    const past = await planLetter(bot, app.clock.now + TIME.HOUR);
    await settle(app.clock.now + 5 * TIME.HOUR);
    const future = await planLetter(bot, app.clock.now + 5 * TIME.DAY);
    const exported = await centre.request('POST', '/api/export', {});
    expect(exported.headers['content-type']).toBe('application/zip');
    const zip = exported.rawPayload;
    // Nothing of players is in it.
    expect(zip.toString('latin1')).not.toContain(anna.id);
    // Importing into the same server: everything exists already.
    const same = await centre.raw('/api/import/preview', 'application/zip', zip);
    expect(same.json()).toMatchObject({
      bots: [{ action: 'merge', events: [{ action: 'skip' }, { action: 'skip' }] }],
    });
    // On an empty server (bot deleted here): a draft again, the past event only in the archive.
    await centre.json('POST', `/api/bots/${bot}/delete`, { name: 'Kapitän Ahoi' });
    const imported = await centre.raw('/api/import', 'application/zip', zip);
    expect(imported.json()).toMatchObject({
      bots: [
        {
          action: 'new',
          events: [
            { id: past, action: 'past' },
            { id: future, action: 'planned' },
          ],
        },
      ],
    });
    expect(app.db.get('SELECT state FROM central_bots WHERE id = ?', bot)).toEqual({
      state: 'draft',
    });
    await activate(bot);
    await settle(app.clock.now + 6 * TIME.DAY);
    // Only the future event was sent – the archived one never again.
    expect(lettersOf(bot, anna.id).map((l) => l.plaintext)).toEqual([TEXTS.de.first]);
    // A bot with a name that is taken is shown as a conflict and skipped.
    await centre.json('POST', `/api/bots/${bot}/delete`, { name: 'Kapitän Ahoi' });
    await centre.json('POST', '/api/bots', { name: 'Kapitän Ahoi' });
    expect((await centre.raw('/api/import/preview', 'application/zip', zip)).json()).toMatchObject({
      bots: [{ action: 'conflict', conflict: 'name_taken' }],
    });
    expect(
      (await centre.raw('/api/import/preview', 'application/zip', Buffer.from('PK'))).statusCode,
    ).toBe(400);
  });

  it('the AI test sends and stores nothing', async () => {
    const bot = await newBot();
    await storeApiKey(app.ctx, 'sk-test-0000000000000000', app.clock.now);
    const before = app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM letters')?.n;
    const result = await centre.json('POST', `/api/bots/${bot}/ai-test`, {
      language: 'de',
      variant: 'follow',
      planned: 'Geplanter Brief über das Meer.',
      context: 'Sturm zieht auf.',
      playerLetter: 'Wie geht es dir?',
    });
    expect(result.body).toEqual({ text: 'KI-Brief: Danke für deine Zeilen!' });
    expect(JSON.stringify(ai.calls[0]!.messages)).toContain('Sturm zieht auf.');
    expect(app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM letters')?.n).toBe(before);
    expect(app.db.all('SELECT 1 FROM central_bot_stats')).toEqual([]);
  });
});
