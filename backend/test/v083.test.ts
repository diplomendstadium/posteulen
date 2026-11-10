/**
 * Version 0.8.3: longer bot names and larger pictures, first and last arrival of an event,
 * free care of visiting bot owls, and the AI context of the control-centre bots (follow-up letter,
 * the last 15 letters, the previous letter in the AI test).
 */
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIME } from '@posteulen/shared/constants.ts';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import { storeApiKey, type AiClient, type AiMessage } from '../src/bots/ai.ts';
import { botMotivationAfter } from '../src/central/care.ts';
import {
  Agent,
  BERLIN,
  BOTS_ORIGIN,
  HAMBURG,
  advanceTo,
  borrowOwl,
  PARIS,
  person,
  testApp,
  type TestApp,
} from './auth-helpers.ts';

class FakeAi implements AiClient {
  calls: { messages: readonly AiMessage[] }[] = [];
  async complete(_key: string, _model: string, messages: readonly AiMessage[]) {
    this.calls.push({ messages });
    return 'KI-Brief: Danke für deine Zeilen!';
  }
  async listModels() {
    return ['gpt-test'];
  }
}

let app: TestApp;
let ai: FakeAi;
let centre: Agent;

async function settle(at = app.clock.now): Promise<void> {
  const step = 10 * TIME.MINUTE;
  for (let t = Math.min(app.clock.now + step, at); ; t = Math.min(t + step, at)) {
    for (let i = 0; i < 3; i++) {
      advanceTo(app, t);
      await app.ctx.centralBots.idle();
    }
    if (t >= at) break;
  }
  app.db.run('UPDATE bots_admin_sessions SET last_used_at = ?', app.clock.now);
}

const TEXTS = {
  de: { first: 'Hallo, ich bin neu hier!', follow: 'Hallo wieder!' },
  en: { first: 'Hello, I am new here!', follow: 'Hello again!' },
};

async function newBot(name: string, settings: Partial<Record<string, unknown>> = {}) {
  const created = await centre.json<{ id: string }>('POST', '/api/bots', { name });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
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
  const active = await centre.json('POST', `/api/bots/${id}/state`, { state: 'active' });
  expect(active.status, JSON.stringify(active.body)).toBe(200);
  return id;
}

async function planLetter(botId: string, dueAt: number, texts = TEXTS): Promise<string> {
  const result = await centre.json<{ id: string }>('POST', `/api/bots/${botId}/events`, {
    dueAt,
    move: null,
    letter: { parchment: 'small', owlMode: 'default', texts, media: [] },
    gift: null,
    context: '',
  });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body.id;
}

interface Reach {
  first: { at: number; estimated: boolean };
  last: { at: number; estimated: boolean };
  players: number;
}

beforeEach(async () => {
  ai = new FakeAi();
  app = await testApp({ aiClient: ai });
  const password = await setInitialAdminPassword(
    app.db,
    app.secrets.opaqueServerSetup,
    'bots_admin',
  );
  centre = new Agent(app.botsApi, BOTS_ORIGIN);
  await client.ready();
  const start = client.startLogin(password);
  const first = await centre.json<{ attemptId: string; loginResponse: string }>(
    'POST',
    '/api/login/start',
    { startLoginRequest: start.request },
  );
  const result = client.finishLogin(password, start.state, first.body.loginResponse)!;
  await centre.json('POST', '/api/login/finish', {
    attemptId: first.body.attemptId,
    finishLoginRequest: result.finishRequest,
  });
  app.db.run('UPDATE bots_admin SET must_change_password = 0');
});
afterEach(async () => {
  await app.ctx.centralBots.idle();
  await app.close();
});

describe('names and pictures (v0.8.3)', () => {
  it('bot names up to 30 characters, pictures up to 5 MB', async () => {
    const long = 'Phodilus van Uylenburgh Junior';
    expect(Array.from(long)).toHaveLength(30);
    const ok = await centre.json<{ id: string }>('POST', '/api/bots', { name: long });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect((await centre.json('POST', '/api/bots', { name: `${long}s` })).body).toMatchObject({
      code: 'bot_name_too_long',
    });
    // A picture of about 4 MB (random noise compresses badly) goes in; more than 5 MB does not.
    const png = await sharp(randomBytes(1300 * 1100 * 3), {
      raw: { width: 1300, height: 1100, channels: 3 },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    expect(png.length).toBeGreaterThan(3 * 1024 * 1024);
    expect(png.length).toBeLessThan(5 * 1024 * 1024);
    const upload = await centre.raw(`/api/bots/${ok.body.id}/media`, 'image/png', png);
    expect(upload.statusCode, upload.body).toBe(200);
    const tooLarge = await centre.raw(
      `/api/bots/${ok.body.id}/media`,
      'image/png',
      Buffer.alloc(5 * 1024 * 1024 + 1),
    );
    expect(tooLarge.json()).toMatchObject({ code: 'media_too_large' });
    expect(
      (
        await centre.raw(
          `/api/bots/${ok.body.id}/media`,
          'image/png',
          Buffer.alloc(6 * 1024 * 1024),
        )
      ).statusCode,
    ).toBe(413);
  });
});

describe('first and last arrival of an event (v0.8.3)', () => {
  it('estimated while planned, real once the owls are on their way', async () => {
    await person(app, 'Anna', BERLIN);
    await person(app, 'Ben', HAMBURG);
    const bot = await newBot('Kapitän Ahoi', { owlMode: 'loan', restHours: 0 });
    const dueAt = app.clock.now + TIME.HOUR;
    await planLetter(bot, dueAt);
    const before = await centre.json<{ planned: { reach: Reach | null }[] }>(
      'GET',
      `/api/bots/${bot}/events`,
    );
    const planned = before.body.planned[0]!.reach!;
    expect(planned).toMatchObject({
      players: 2,
      first: { estimated: true },
      last: { estimated: true },
    });
    expect(planned.first.at).toBeGreaterThan(dueAt);
    expect(planned.last.at).toBeGreaterThanOrEqual(planned.first.at);
    await settle(dueAt + 10 * TIME.MINUTE);
    const after = await centre.json<{ past: { reach: Reach | null }[] }>(
      'GET',
      `/api/bots/${bot}/events`,
    );
    const real = after.body.past[0]!.reach!;
    const arrivals = app.db
      .all<{ arrives_at: number }>(
        'SELECT arrives_at FROM letters WHERE sender_id = ? ORDER BY arrives_at',
        bot,
      )
      .map((row) => row.arrives_at);
    expect(arrivals).toHaveLength(2);
    expect(real).toEqual({
      players: 2,
      first: { at: arrivals[0], estimated: false },
      last: { at: arrivals[1], estimated: false },
    });
  });
});

describe('visiting bot owls are cared for (v0.8.3)', () => {
  it('free of charge, energy as usual, motivation at most 1.2 and never lowered', async () => {
    expect(botMotivationAfter(10, false)).toBe(11);
    expect(botMotivationAfter(11, true)).toBe(11);
    expect(botMotivationAfter(12, false)).toBe(12);
    expect(botMotivationAfter(200, false)).toBe(200);
    const anna = await person(app, 'Anna', BERLIN);
    // A slow owl (motivation 1.0) needs about two days from Paris; it rests a whole week.
    const bot = await newBot('Kapitän Ahoi', { motivation: 10, restHours: 168 });
    await planLetter(bot, app.clock.now + TIME.HOUR);
    const until = app.clock.now + 4 * TIME.DAY;
    while (app.clock.now < until) {
      await settle(app.clock.now + 6 * TIME.HOUR);
      if (app.db.get("SELECT 1 FROM letters WHERE sender_id = ? AND status = 'delivered'", bot))
        break;
    }
    const guests = async () =>
      (
        await anna.agent.json<{
          guests: {
            id: string;
            bot: boolean;
            energy: number;
            motivation: number;
            fedToday: boolean;
            wateredToday: boolean;
          }[];
        }>('GET', '/api/owls')
      ).body.guests;
    const [owl] = await guests();
    expect(owl).toMatchObject({ bot: true, fedToday: false, wateredToday: false, motivation: 10 });
    const gold = app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', anna.id)!.gold;
    expect((await anna.agent.json('POST', `/api/owls/${owl!.id}/pet`, {})).status).toBe(200);
    expect((await anna.agent.json('POST', `/api/owls/${owl!.id}/pet`, {})).status).toBe(200);
    expect((await anna.agent.json('POST', `/api/owls/${owl!.id}/water`, {})).status).toBe(200);
    const fed = await anna.agent.json<{ guest: { fedToday: boolean; motivation: number } }>(
      'POST',
      `/api/owls/${owl!.id}/feed`,
      {},
    );
    expect(fed.status, JSON.stringify(fed.body)).toBe(200);
    // Pet (once a day) and water raise it to 1.2, the biscuit cannot go higher.
    expect(fed.body.guest).toMatchObject({ fedToday: true, motivation: 12 });
    expect((await anna.agent.json('POST', `/api/owls/${owl!.id}/feed`, {})).body).toMatchObject({
      code: 'owl_fed_today',
    });
    expect((await anna.agent.json('POST', `/api/owls/${owl!.id}/snack`, {})).status).toBe(200);
    // Nothing of it costs gold.
    expect(app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', anna.id)!.gold).toBe(
      gold,
    );
    // The care marks are per day.
    expect(app.db.all('SELECT kind FROM bot_owl_care ORDER BY kind')).toEqual([
      { kind: 'feed' },
      { kind: 'pet' },
      { kind: 'snack' },
      { kind: 'water' },
    ]);
  });

  it('a highly motivated bot owl keeps its motivation', async () => {
    const anna = await person(app, 'Anna', BERLIN);
    const bot = await newBot('Kapitän Ahoi', { motivation: 200 });
    await planLetter(bot, app.clock.now + TIME.HOUR);
    await settle(app.clock.now + 8 * TIME.HOUR);
    const owls = await anna.agent.json<{ guests: { id: string; motivation: number }[] }>(
      'GET',
      '/api/owls',
    );
    const owl = owls.body.guests[0]!;
    expect(owl.motivation).toBe(200);
    const petted = await anna.agent.json<{ guest: { motivation: number } }>(
      'POST',
      `/api/owls/${owl.id}/pet`,
      {},
    );
    expect(petted.body.guest.motivation).toBe(200);
  });
});

describe('AI context of the control-centre bots (v0.8.3)', () => {
  it('a player who wrote gets the follow-up letter adapted, with the last 15 letters', async () => {
    const anna = await person(app, 'Anna', BERLIN);
    const bot = await newBot('Kapitän Ahoi', { owlMode: 'loan', restHours: 0, playerOwls: true });
    await planLetter(bot, app.clock.now + TIME.HOUR);
    await settle(app.clock.now + 8 * TIME.HOUR);
    // An older conversation of 20 letters (as if over weeks).
    for (let i = 1; i <= 20; i++) {
      app.db.run(
        `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, plaintext, status, owl_name, owl_species)
         VALUES (?, ?, ?, 'letter', 'small', ?, ?, ?, 'delivered', 'Uhu', 'waldkauz')`,
        `OldLetter${String(i).padStart(13, '0')}`,
        i % 2 === 0 ? bot : anna.id,
        i % 2 === 0 ? anna.id : bot,
        i,
        i,
        `Alter Brief Nummer ${i}.`,
      );
    }
    const owl = await borrowOwl(anna);
    const sent = await anna.agent.json<{ letters: { arrivesAt: number }[] }>(
      'POST',
      '/api/bot-letters/send',
      { botId: bot, owlId: owl, parchment: 'small', text: 'Wie geht es dir?' },
    );
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    await settle(sent.body.letters[0]!.arrivesAt);
    // Even if the server had forgotten that the first letter went out: a reply means follow-up.
    app.db.run('UPDATE central_bot_players SET first_started = 0');
    await storeApiKey(app.ctx, 'sk-test-0000000000000000', app.clock.now);
    await planLetter(bot, app.clock.now + 30 * TIME.MINUTE);
    await settle(app.clock.now + TIME.HOUR);
    const personalise = ai.calls.find((call) =>
      JSON.stringify(call.messages).includes('Geplanter Brief'),
    )!;
    const text = JSON.stringify(personalise.messages);
    // The planned letter given to the AI is the follow-up one (the first one is only history).
    const instruction = personalise.messages.find((message) =>
      message.content.includes('Geplanter Brief'),
    )!.content;
    expect(instruction).toContain(`"""\n${TEXTS.de.follow}\n"""`);
    expect(instruction).not.toContain(TEXTS.de.first);
    const history = personalise.messages.filter(
      (message) => message.role === 'assistant' || message.role === 'user',
    );
    // 15 letters of the conversation word for word plus the player's unanswered letter.
    expect(history).toHaveLength(16);
    expect(text).toContain('Alter Brief Nummer 20.');
    expect(text).not.toContain('Alter Brief Nummer 2.');
    // The older ones went into the summary.
    expect(text).toContain('Bisheriger Briefwechsel in Kürze');
  });

  it('the AI test adapts the follow-up letter with the previous letter as history', async () => {
    const bot = await newBot('Kapitän Ahoi');
    await planLetter(bot, app.clock.now + TIME.DAY, {
      de: { first: 'Erster Brief.', follow: 'Ich bin gerade in Lissabon angekommen.' },
      en: { first: 'First letter.', follow: 'I have just arrived in Lisbon.' },
    });
    const second = await planLetter(bot, app.clock.now + 3 * TIME.DAY);
    await storeApiKey(app.ctx, 'sk-test-0000000000000000', app.clock.now);
    const result = await centre.json<{ text?: string }>('POST', `/api/bots/${bot}/ai-test`, {
      language: 'de',
      variant: 'follow',
      planned: TEXTS.de.follow,
      context: '',
      playerLetter: 'Wie war die Reise?',
      dueAt: app.clock.now + 3 * TIME.DAY,
      eventId: second,
    });
    expect(result.body.text).toBe('KI-Brief: Danke für deine Zeilen!');
    const messages = ai.calls.at(-1)!.messages;
    expect(messages).toContainEqual({
      role: 'assistant',
      content: 'Ich bin gerade in Lissabon angekommen.',
    });
  });
});
