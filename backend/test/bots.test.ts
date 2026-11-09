import { helpAsText } from '@posteulen/shared/texts/help.ts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BOTS, LETTER, TIME } from '@posteulen/shared/constants.ts';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { distanceKm } from '@posteulen/shared/game/geo.ts';
import { EXPLAINER_LETTERS } from '@posteulen/shared/texts/bots.ts';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import {
  AiError,
  openAiClient,
  storeApiKey,
  type AiClient,
  type AiMessage,
} from '../src/bots/ai.ts';
import { finishReply } from '../src/bots/replies.ts';
import { ensureBotsForAllUsers } from '../src/bots/service.ts';
import {
  ADMIN_ORIGIN,
  Agent,
  advanceTo,
  borrowOwl,
  buyOwl,
  couple,
  PARIS,
  person,
  setGold,
  testApp,
  type Person,
  type SentPush,
  type TestApp,
} from './auth-helpers.ts';

/** Fake OpenAI: records every request, answers in order (SPEC 10.5 without network). */
class FakeAi implements AiClient {
  calls: { model: string; messages: readonly AiMessage[]; maxTokens: number }[] = [];
  answers: (string | Error)[] = [];
  models = ['gpt-6-luna', 'gpt-test'];
  async complete(_key: string, model: string, messages: readonly AiMessage[], maxTokens: number) {
    this.calls.push({ model, messages, maxTokens });
    const next = this.answers.shift() ?? 'Danke für deinen Brief! Wie geht es dir heute?';
    if (next instanceof Error) throw next;
    return next;
  }
  async listModels(key: string) {
    if (key === 'sk-ungueltig-0000000000000000') throw new AiError('api error', 401);
    return this.models;
  }
}

let app: TestApp & { pushes: SentPush[] };
let ai: FakeAi;
let anna: Person;

beforeEach(async () => {
  ai = new FakeAi();
  app = await testApp({ aiClient: ai });
  anna = await person(app, 'Anna');
});
afterEach(async () => {
  await app.ctx.botReplies.idle();
  await app.close();
});

interface Bot {
  userId: string;
  name: string;
  type: 'explainer' | 'central';
  writableFrom: number | null;
}

async function bots(who: Person): Promise<Bot[]> {
  return (await who.agent.json<{ bots: Bot[] }>('GET', '/api/contacts')).body.bots;
}

function botRow(who: Person, type: string) {
  return app.db.get<{ id: string; first_name: string | null; home_lat: number; home_lon: number }>(
    'SELECT id, first_name, home_lat, home_lon FROM bots WHERE owner_id = ? AND type = ?',
    who.id,
    type,
  )!;
}

async function botLetters(who: Person, botId: string) {
  return (
    await who.agent.json<{
      letters: {
        id: string;
        role: string;
        status: string;
        plaintext: string | null;
        read: boolean;
        kind: string;
      }[];
    }>('GET', `/api/chats/${botId}/letters`)
  ).body.letters;
}

async function writeToBot(who: Person, botId: string, text: string) {
  const owl = await borrowOwl(who);
  return who.agent.json<{ letters: { arrivesAt: number }[] }>('POST', '/api/bot-letters/send', {
    botId,
    owlId: owl,
    parchment: 'small',
    text,
  });
}

describe('bots of a new account (SPEC 10, 17.2)', () => {
  it('only the Erklärbär (v0.8: no aunt, no uncle); on the map once written to', async () => {
    const paula = await person(app, 'Paula', PARIS);
    const mapBots = async () =>
      (
        await paula.agent.json<{ contacts: { bot: boolean; name: string }[] }>('GET', '/api/map')
      ).body.contacts
        .filter((c) => c.bot)
        .map((c) => c.name);
    expect((await bots(paula)).map((bot) => bot.type)).toEqual(['explainer']);
    expect(app.db.all('SELECT type FROM bots WHERE owner_id = ?', paula.id)).toEqual([
      { type: 'explainer' },
    ]);
    const explainer = (await bots(paula))[0]!;
    expect(await botLetters(paula, explainer.userId)).toEqual([
      expect.objectContaining({
        role: 'recipient',
        status: 'delivered',
        plaintext: EXPLAINER_LETTERS.day0,
      }),
    ]);
    const chats = await paula.agent.json<{
      chats: { peerKind: string; name: string; unread: number }[];
    }>('GET', '/api/chats');
    expect(chats.body.chats).toEqual([
      expect.objectContaining({ peerKind: 'bot', name: 'Erklärbär', unread: 1 }),
    ]);
    expect(await mapBots()).toEqual([]);
    advanceTo(app, app.clock.now + 30 * TIME.DAY);
    expect((await bots(paula)).map((bot) => bot.type)).toEqual(['explainer']);
    expect(await writeToBot(paula, explainer.userId, 'Hallo Bär!')).toMatchObject({ status: 200 });
    expect(await mapBots()).toEqual(['Erklärbär']);
    // The database refuses aunt and uncle (v0.8).
    expect(() =>
      app.db.run(
        "INSERT INTO bots (id, owner_id, type, home_lat, home_lon, in_addressbook) VALUES ('x', ?, 'aunt', 0, 0, 0)",
        paula.id,
      ),
    ).toThrow();
    // Bot letters are plain text by design (SPEC 10.1) – and nothing of them is encrypted.
    expect(
      app.db.get<{ n: number }>(
        'SELECT COUNT(*) AS n FROM letters WHERE plaintext IS NOT NULL AND ciphertext IS NULL',
      )?.n,
    ).toBe(app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM letters')?.n);
  });

  it('the Erklärbär flies 200 km/h with unlimited energy; letters on days 1, 2, 3, 4 and 7', async () => {
    const paula = await person(app, 'Paula', PARIS);
    const explainer = botRow(paula, 'explainer');
    advanceTo(app, app.clock.now + TIME.DAY);
    const letter = app.db.get<{ sent_at: number; arrives_at: number }>(
      "SELECT sent_at, arrives_at FROM letters WHERE sender_id = ? AND status = 'in_flight'",
      explainer.id,
    )!;
    const km = distanceKm({ lat: 52.52, lon: 13.41 }, PARIS);
    expect((letter.arrives_at - letter.sent_at) / TIME.HOUR).toBeCloseTo(
      km / BOTS.EXPLAINER_SPEED_KMH,
      1,
    );
    advanceTo(app, app.clock.now + 7 * TIME.DAY);
    const texts = (await botLetters(paula, explainer.id)).map((l) => l.plaintext);
    expect(texts).toEqual([
      EXPLAINER_LETTERS.day0,
      EXPLAINER_LETTERS.day1,
      EXPLAINER_LETTERS.day2,
      EXPLAINER_LETTERS.day3,
      EXPLAINER_LETTERS.day4,
      EXPLAINER_LETTERS.day7,
    ]);
  });

  it('accounts from before stage 5 get their bots once', async () => {
    app.db.run('DELETE FROM bots');
    app.db.run('UPDATE users SET bots_created = 0');
    expect(ensureBotsForAllUsers(app.ctx)).toBe(1);
    expect(ensureBotsForAllUsers(app.ctx)).toBe(0);
    expect(app.db.all('SELECT 1 FROM bots WHERE owner_id = ?', anna.id)).toHaveLength(1);
  });

  it('removed bots never come back, also not after a restart (v0.7.2)', async () => {
    expect(
      (await anna.agent.json<{ removed: number }>('POST', '/api/bots/remove-all', {})).body,
    ).toEqual({ removed: 1 });
    expect(app.db.all('SELECT 1 FROM bots WHERE owner_id = ?', anna.id)).toEqual([]);
    expect(ensureBotsForAllUsers(app.ctx)).toBe(0);
    expect(app.db.all('SELECT 1 FROM bots WHERE owner_id = ?', anna.id)).toEqual([]);
    expect(
      app.db.all("SELECT 1 FROM scheduled_events WHERE type LIKE 'bot!_%' ESCAPE '!'"),
    ).toEqual([]);
    const contacts = await anna.agent.json<{ bots: unknown[]; allBots: number }>(
      'GET',
      '/api/contacts',
    );
    expect(contacts.body).toMatchObject({ bots: [], allBots: 0, botsDisabled: true });
  });
});

describe('removing a bot (SPEC 10.1, 8.8)', () => {
  it('is final: chat and planned letters vanish; own owls on their way turn back', async () => {
    const explainer = botRow(anna, 'explainer');
    setGold(app, anna, 200);
    const owl = await buyOwl(app, anna);
    app.db.run('UPDATE owls SET energy = 540 WHERE id = ?', owl);
    expect(
      (
        await anna.agent.json('POST', '/api/bot-letters/send', {
          botId: explainer.id,
          owlId: owl,
          parchment: 'small',
          text: 'Hallo Bär!',
        })
      ).status,
    ).toBe(200);
    expect((await anna.agent.json('DELETE', `/api/contacts/${explainer.id}`)).status).toBe(200);
    expect(app.db.get('SELECT 1 FROM bots WHERE id = ?', explainer.id)).toBeUndefined();
    expect(
      app.db.all(
        'SELECT 1 FROM letters WHERE sender_id = ? OR recipient_id = ?',
        explainer.id,
        explainer.id,
      ),
    ).toEqual([]);
    expect(
      app.db.all(
        "SELECT 1 FROM scheduled_events WHERE type = 'bot_letter' AND ref LIKE ?",
        `${explainer.id}:%`,
      ),
    ).toEqual([]);
    const flight = app.db.get<{ route: string }>(
      "SELECT route FROM flights WHERE state = 'active'",
    );
    expect(
      (JSON.parse(flight!.route) as { type: string; status: string }[]).map((s) => [
        s.type,
        s.status,
      ]),
    ).toEqual([
      ['deliver', 'skipped'],
      ['home', 'pending'],
    ]);
    expect(await bots(anna)).toEqual([]);
  });
});

describe('letters to bots and replies (SPEC 10.1, 10.5)', () => {
  beforeEach(async () => {
    await storeApiKey(app.ctx, 'sk-test-0000000000000000', app.clock.now);
  });

  it('plain text, one recipient, once per UTC day (v0.8); no gold and no gifts to bots', async () => {
    const explainer = botRow(anna, 'explainer');
    const ben = await person(app, 'Ben');
    await couple(anna, ben);
    const owl = await borrowOwl(anna);
    expect(
      (
        await anna.agent.json('POST', '/api/flights/preview', {
          recipients: [explainer.id, ben.id],
        })
      ).body,
    ).toMatchObject({ code: 'recipient_invalid' });
    setGold(app, anna, 200);
    expect(
      (
        await anna.agent.json('POST', '/api/gold/prepare', {
          recipient: explainer.id,
          amount: 5,
          owlId: owl,
          withCover: false,
        })
      ).body,
    ).toMatchObject({ code: 'recipient_invalid' });
    expect(
      (
        await anna.agent.json('POST', '/api/letters/prepare', {
          recipients: [explainer.id],
          parchment: 'small',
          owlId: owl,
        })
      ).body,
    ).toMatchObject({ code: 'recipient_invalid' });
    expect(
      (await anna.agent.json('POST', '/api/flights/preview', { recipients: [explainer.id] }))
        .status,
    ).toBe(200);
    expect((await writeToBot(anna, explainer.id, 'Wie füttere ich eine Eule?')).status).toBe(200);
    expect(JSON.stringify(app.db.all('SELECT plaintext FROM letters'))).toContain(
      'Wie füttere ich',
    );
    const lock = (await bots(anna)).find((b) => b.userId === explainer.id)!;
    // v0.8: one letter per calendar day (UTC) – writable again at the next midnight.
    const midnight =
      Date.parse(`${new Date(app.clock.now).toISOString().slice(0, 10)}T00:00:00Z`) + TIME.DAY;
    expect(lock.writableFrom).toBe(midnight);
    expect((await writeToBot(anna, explainer.id, 'Noch eine Frage')).body).toMatchObject({
      code: 'bot_write_lock',
    });
    advanceTo(app, midnight);
    expect(
      (
        await anna.agent.json('POST', '/api/bot-letters/send', {
          botId: explainer.id,
          owlId: owl,
          parchment: 'small',
          text: 'x'.repeat(LETTER.SMALL_MAX_CHARS + 1),
        })
      ).body,
    ).toMatchObject({ code: 'letter_too_long' });
  });

  it('replies 2 hours after arrival with system prompt, summary, last 6 letters, no names', async () => {
    const explainer = botRow(anna, 'explainer');
    ai.answers = ['Schön, dass du fragst! 🦉 Füttern kostet 0,1 Gold und gibt Energie.'];
    const sent = await writeToBot(anna, explainer.id, 'Wie füttere ich eine Eule?');
    const arrival = sent.body.letters[0]!.arrivesAt;
    advanceTo(app, arrival + 2 * TIME.HOUR - 1000);
    await app.ctx.botReplies.idle();
    expect(ai.calls).toHaveLength(0);
    advanceTo(app, arrival + 2 * TIME.HOUR);
    await app.ctx.botReplies.idle();
    expect(ai.calls).toHaveLength(1);
    const request = ai.calls[0]!;
    expect(request.messages[0]).toMatchObject({ role: 'system' });
    expect(request.messages[0]!.content).toContain('Erklärbär');
    // Knowledge base = help text (SPEC 10.2, D-88).
    expect(request.messages[0]!.content).toContain(helpAsText());
    expect(request.messages.at(-1)).toEqual({
      role: 'user',
      content: 'Wie füttere ich eine Eule?',
    });
    expect(request.messages).toContainEqual({ role: 'assistant', content: EXPLAINER_LETTERS.day0 });
    // No names and no identifiers (user, bot, letter IDs) go to OpenAI (SPEC 10.5).
    const payload = JSON.stringify(request);
    const ids = app.db
      .all<{ id: string }>(
        'SELECT id FROM users UNION SELECT id FROM bots UNION SELECT id FROM letters',
      )
      .map((row) => row.id);
    for (const value of ['Anna', anna.id, explainer.id, ...ids])
      expect(payload).not.toContain(value);
    const letters = await botLetters(anna, explainer.id);
    expect(letters.find((l) => l.role === 'sender')?.read).toBe(true);
    advanceTo(app, app.clock.now + TIME.DAY);
    const reply = (await botLetters(anna, explainer.id)).find((l) =>
      l.plaintext?.startsWith('Schön'),
    )!;
    expect(reply).toMatchObject({ role: 'recipient', status: 'delivered' });
    // Same text rules as letters: no emojis.
    expect(reply.plaintext).toBe(
      'Schön, dass du fragst!  Füttern kostet 0,1 Gold und gibt Energie.',
    );
  });

  it('folds older letters into a summary (one extra call)', async () => {
    const explainer = botRow(anna, 'explainer');
    // Eight letters already exchanged.
    for (let i = 0; i < 8; i++) {
      app.db.run(
        `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, plaintext, status, owl_name, owl_species)
         VALUES (?, ?, ?, 'letter', 'small', ?, ?, ?, 'delivered', 'Momo', 'waldkauz')`,
        `oldLetter${String(i).padStart(13, '0')}`,
        i % 2 === 0 ? anna.id : explainer.id,
        i % 2 === 0 ? explainer.id : anna.id,
        app.clock.now - (10 - i) * TIME.HOUR,
        app.clock.now - (10 - i) * TIME.HOUR,
        `Brief Nummer ${i}`,
      );
    }
    ai.answers = ['Zusammenfassung: Es ging um Eulen.', 'Gern geschehen!'];
    const sent = await writeToBot(anna, explainer.id, 'Neue Frage');
    advanceTo(app, sent.body.letters[0]!.arrivesAt + 2 * TIME.HOUR);
    await app.ctx.botReplies.idle();
    expect(ai.calls).toHaveLength(2);
    expect(ai.calls[0]!.messages[1]!.content).toContain('Gegenüber: Brief Nummer 0');
    const replyMessages = ai.calls[1]!.messages;
    expect(replyMessages[1]).toEqual({
      role: 'system',
      content: 'Bisheriger Briefwechsel in Kürze: Zusammenfassung: Es ging um Eulen.',
    });
    // System prompt, summary, 6 letters, the new letter.
    expect(replyMessages).toHaveLength(1 + 1 + BOTS.CONTEXT_LETTERS + 1);
    const chat = app.db.get<{ bot_summary: string }>(
      'SELECT bot_summary FROM chats WHERE peer_id = ?',
      explainer.id,
    );
    expect(chat?.bot_summary).toBe('Zusammenfassung: Es ging um Eulen.');
    // Deleting the chat deletes the summary too.
    await anna.agent.json('DELETE', `/api/chats/${explainer.id}`);
    expect(
      app.db.get('SELECT bot_summary FROM chats WHERE peer_id = ?', explainer.id),
    ).toBeUndefined();
  });

  it('daily limit: the reply moves to the next day; without key: again in 24 hours', async () => {
    const explainer = botRow(anna, 'explainer');
    const bea = await person(app, 'Bea');
    app.db.run("INSERT INTO settings (key, value) VALUES ('ai_daily_limit', '1')");
    const first = await writeToBot(anna, explainer.id, 'Frage eins');
    const second = await writeToBot(bea, botRow(bea, 'explainer').id, 'Hallo Bär, Frage zwei');
    const due =
      Math.max(first.body.letters[0]!.arrivesAt, second.body.letters[0]!.arrivesAt) + 2 * TIME.HOUR;
    advanceTo(app, due);
    await app.ctx.botReplies.idle();
    expect(ai.calls).toHaveLength(1);
    const postponed = app.db.get<{ due_at: number }>('SELECT due_at FROM bot_jobs')!;
    expect(new Date(postponed.due_at).toISOString().slice(0, 10)).toBe(
      new Date(due + TIME.DAY).toISOString().slice(0, 10),
    );

    // Next day without a key: error log, retry in 24 hours.
    app.db.run("DELETE FROM settings WHERE key = 'openai_key'");
    advanceTo(app, postponed.due_at);
    await app.ctx.botReplies.idle();
    expect(ai.calls).toHaveLength(1);
    const job = app.db.get<{ due_at: number; attempts: number }>(
      'SELECT due_at, attempts FROM bot_jobs',
    )!;
    expect(job.attempts).toBe(1);
    expect(job.due_at).toBe(app.clock.now + 24 * TIME.HOUR);
    const log = app.db.all<{ what: string; cause: string }>('SELECT what, cause FROM error_log');
    expect(log).toContainEqual(
      expect.objectContaining({ what: 'Eine Bot-Antwort konnte nicht erzeugt werden.' }),
    );
    expect(JSON.stringify(log)).not.toContain('Frage zwei');

    // API errors are retried as well.
    await storeApiKey(app.ctx, 'sk-test-0000000000000000', app.clock.now);
    ai.answers = [new AiError('api error', 500)];
    advanceTo(app, job.due_at);
    await app.ctx.botReplies.idle();
    expect(app.db.get<{ attempts: number }>('SELECT attempts FROM bot_jobs')?.attempts).toBe(2);
    advanceTo(app, app.clock.now + 24 * TIME.HOUR);
    await app.ctx.botReplies.idle();
    expect(app.db.all('SELECT 1 FROM bot_jobs')).toEqual([]);
  });

  it('cuts long replies at a sentence end to 500 characters', () => {
    const long = `${'Das ist ein Satz. '.repeat(40)}Ende`;
    const cut = finishReply(long);
    expect(Array.from(cut).length).toBeLessThanOrEqual(500);
    expect(cut.endsWith('.')).toBe(true);
    const noStop = 'wort '.repeat(200);
    const cutWords = finishReply(noStop);
    expect(Array.from(cutWords).length).toBeLessThanOrEqual(500);
    expect(cutWords.endsWith('…')).toBe(true);
    expect(finishReply('Kurz und gut.')).toBe('Kurz und gut.');
  });
});

describe('OpenAI client (D-20)', () => {
  it('fixed URL, no redirects, store: false, completion token limit', async () => {
    const original = globalThis.fetch;
    const seen: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      if (url.endsWith('/models'))
        return new Response(JSON.stringify({ data: [{ id: 'b' }, { id: 'a' }] }));
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Hallo!' } }] }));
    }) as typeof fetch;
    try {
      expect(
        await openAiClient.complete('sk-x', 'gpt-test', [{ role: 'user', content: 'Hi' }], 400),
      ).toBe('Hallo!');
      expect(await openAiClient.listModels('sk-x')).toEqual(['a', 'b']);
    } finally {
      globalThis.fetch = original;
    }
    expect(seen[0]!.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(seen[0]!.init.redirect).toBe('error');
    expect(JSON.parse(String(seen[0]!.init.body))).toMatchObject({
      store: false,
      max_completion_tokens: 400,
      model: 'gpt-test',
    });
    expect((seen[0]!.init.headers as Record<string, string>)['authorization']).toBe('Bearer sk-x');
  });

  it('reports HTTP errors and empty answers', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response('{}', { status: 401 })) as typeof fetch;
    await expect(openAiClient.complete('k', 'm', [], 1)).rejects.toMatchObject({ status: 401 });
    globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [] }))) as typeof fetch;
    await expect(openAiClient.complete('k', 'm', [], 1)).rejects.toThrow('empty');
    globalThis.fetch = (async () => {
      throw new TypeError('network');
    }) as typeof fetch;
    await expect(openAiClient.listModels('k')).rejects.toMatchObject({ status: null });
    globalThis.fetch = original;
  });
});

describe('admin: OpenAI settings (SPEC 13 item 5)', () => {
  async function adminAgent(): Promise<Agent> {
    const password = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
    const admin = new Agent(app.adminApi, ADMIN_ORIGIN);
    await client.ready();
    const start = client.startLogin(password);
    const first = await admin.json<{ attemptId: string; loginResponse: string }>(
      'POST',
      '/api/login/start',
      {
        startLoginRequest: start.request,
      },
    );
    const result = client.finishLogin(password, start.state, first.body.loginResponse)!;
    await admin.json('POST', '/api/login/finish', {
      attemptId: first.body.attemptId,
      finishLoginRequest: result.finishRequest,
    });
    app.db.run('UPDATE admin SET must_change_password = 0');
    return admin;
  }

  it('key is write-only and stored encrypted; models, settings and connection test', async () => {
    const admin = await adminAgent();
    expect((await admin.json('GET', '/api/openai')).body).toMatchObject({
      keySince: null,
      dailyLimit: 200,
      usedToday: 0,
    });
    expect((await admin.json('POST', '/api/openai/test', {})).body).toEqual({
      ok: false,
      code: 'openai_no_key',
    });
    const key = 'sk-proj-geheim-1234567890abcdef';
    expect((await admin.json('PUT', '/api/openai/key', { key })).status).toBe(200);
    const info = await admin.json<Record<string, unknown>>('GET', '/api/openai');
    expect(info.body['keySince']).toBe(app.clock.now);
    expect(JSON.stringify(info.body)).not.toContain('geheim');
    expect(JSON.stringify(app.db.all('SELECT * FROM settings'))).not.toContain('geheim');
    expect((await admin.json('GET', '/api/openai/models')).body).toEqual({
      models: ['gpt-6-luna', 'gpt-test'],
    });
    expect((await admin.json('POST', '/api/openai/test', {})).body).toEqual({ ok: true });
    expect(
      (await admin.json('PUT', '/api/openai/settings', { model: 'gpt-neu', dailyLimit: 50 }))
        .status,
    ).toBe(200);
    expect((await admin.json('POST', '/api/openai/test', {})).body).toEqual({
      ok: false,
      code: 'openai_model_unknown',
    });
    expect(
      (await admin.json('PUT', '/api/openai/settings', { model: 'x y', dailyLimit: 50 })).status,
    ).toBe(400);
    await admin.json('PUT', '/api/openai/key', { key: 'sk-ungueltig-0000000000000000' });
    expect((await admin.json('POST', '/api/openai/test', {})).body).toEqual({
      ok: false,
      code: 'openai_key_invalid',
    });
    expect((await admin.json('DELETE', '/api/openai/key')).status).toBe(200);
    expect((await admin.json('GET', '/api/openai')).body).toMatchObject({
      keySince: null,
      model: 'gpt-neu',
      dailyLimit: 50,
    });
    // Users cannot reach any of it.
    expect((await anna.agent.json('GET', '/api/openai')).status).toBe(404);
  });
});
