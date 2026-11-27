/**
 * v1.4.3: second factor (SPEC 5.11), safety filter of the bots (SPEC 10.5), sex of the bot owl
 * (SPEC 10.6) and „Server der Instanz“ (SPEC 13 item 13).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { TIME, TWO_FACTOR } from '@posteulen/shared/constants.ts';
import { VERSION } from '@posteulen/shared/version.ts';
import { storeApiKey, type AiClient, type AiMessage } from '../src/bots/ai.ts';
import { FILTER_EMPTY, FILTER_PROMPT } from '../src/bots/prompts.ts';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import {
  base32Decode,
  base32Encode,
  hotp,
  matchTotp,
  otpauthUri,
  timeStep,
} from '../src/auth/totp.ts';
import { normalizeBackupCode } from '../src/auth/two-factor.ts';
import {
  compareVersions,
  parseBlocklists,
  parseKeyValues,
  serverInfo,
  syncAutoUpdateSwitch,
} from '../src/admin/server-info.ts';
import {
  ADMIN_ORIGIN,
  advanceTo,
  Agent,
  BERLIN,
  BOTS_ORIGIN,
  borrowOwl,
  login,
  PARIS,
  person,
  testApp,
  unlockFromLogin,
  type Person,
  type TestApp,
} from './auth-helpers.ts';

/** Fake OpenAI: the filter is a function of its own; every other call is recorded. */
class FakeAi implements AiClient {
  calls: { messages: readonly AiMessage[] }[] = [];
  filterCalls: (readonly AiMessage[])[] = [];
  filter: (text: string) => string = (text) => text;
  async complete(_key: string, _model: string, messages: readonly AiMessage[]) {
    if (messages[0]?.content === FILTER_PROMPT) {
      this.filterCalls.push(messages);
      return this.filter(messages[1]?.content ?? '');
    }
    this.calls.push({ messages });
    return 'KI-Brief: Danke für deine Zeilen!';
  }
  async listModels() {
    return ['gpt-test'];
  }
}

const PASSWORD = 'ein sehr langes Passwort';

let app: TestApp;
let ai: FakeAi;

beforeEach(async () => {
  ai = new FakeAi();
  app = await testApp({ aiClient: ai });
});
afterEach(async () => {
  await app.ctx.botReplies.idle();
  await app.ctx.centralBots.idle();
  await app.close();
});

// ── TOTP (RFC 6238, Anhang B: SHA-1) ─────────────────────────────────────────────────────

describe('TOTP after RFC 6238 (SPEC 5.11)', () => {
  const secret = new TextEncoder().encode('12345678901234567890');

  it('gives the values of the RFC test vectors', () => {
    const at = (seconds: number) => Math.floor(seconds / 30);
    expect(hotp(secret, at(59), 8)).toBe('94287082');
    expect(hotp(secret, at(1111111109), 8)).toBe('07081804');
    expect(hotp(secret, at(1234567890), 8)).toBe('89005924');
    expect(hotp(secret, at(2000000000), 8)).toBe('69279037');
    // Six digits are the last six.
    expect(hotp(secret, at(1111111109))).toBe('081804');
  });

  it('Base32 both ways, an otpauth address for the apps', () => {
    expect(base32Encode(secret)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(Array.from(base32Decode('gezd gnbv-gy3tqojqgezdgnbvgy3tqojq'))).toEqual(
      Array.from(secret),
    );
    expect(() => base32Decode('ABC1')).toThrow();
    const uri = otpauthUri('GEZDGNBV', 'Anna', 'PostEulen');
    expect(uri).toBe(
      'otpauth://totp/PostEulen%3AAnna?secret=GEZDGNBV&issuer=PostEulen&algorithm=SHA1&digits=6&period=30',
    );
  });

  it('accepts one step of clock drift either way, never an old or used step', () => {
    const now = 1_111_111_109_000;
    const step = timeStep(now);
    expect(matchTotp(secret, hotp(secret, step), now, 0)).toBe(step);
    expect(matchTotp(secret, hotp(secret, step - 1), now, 0)).toBe(step - 1);
    expect(matchTotp(secret, hotp(secret, step + 1), now, 0)).toBe(step + 1);
    expect(matchTotp(secret, hotp(secret, step - 2), now, 0)).toBeNull();
    // A step already used does not work again.
    expect(matchTotp(secret, hotp(secret, step), now, step)).toBeNull();
    expect(matchTotp(secret, '12345', now, 0)).toBeNull();
    expect(matchTotp(secret, 'abcdef', now, 0)).toBeNull();
  });

  it('backup codes are compared without dashes, spaces and case', () => {
    expect(normalizeBackupCode(' abcde-fgh23 ')).toBe('ABCDEFGH23');
  });
});

// ── Second factor of players ────────────────────────────────────────────────────────────

async function reauth(
  agent: Agent,
  purpose: 'password' | 'delete' | 'two_factor',
  code?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  await client.ready();
  const start = client.startLogin(PASSWORD);
  const first = await agent.json<{ attemptId: string; loginResponse: string }>(
    'POST',
    '/api/reauth/start',
    { purpose, startLoginRequest: start.request },
  );
  const result = client.finishLogin(PASSWORD, start.state, first.body.loginResponse)!;
  return agent.json('POST', '/api/reauth/finish', {
    attemptId: first.body.attemptId,
    finishLoginRequest: result.finishRequest,
    ...(code ? { code } : {}),
  });
}

const codeNow = (secret: string): string => hotp(base32Decode(secret), timeStep(app.clock.now));

/** Next time step, so that a fresh code is valid (each step works once). */
const nextStep = (): void => {
  app.clock.now += TWO_FACTOR.PERIOD_SECONDS * 1000;
};

async function enable(who: Person): Promise<{ secret: string; codes: string[] }> {
  const token = (await reauth(who.agent, 'two_factor')).body['token'] as string;
  const setup = await who.agent.json<{ secret: string; uri: string }>(
    'POST',
    '/api/two-factor/setup',
    { token },
  );
  expect(setup.status, JSON.stringify(setup.body)).toBe(200);
  expect(setup.body.uri).toContain(`secret=${setup.body.secret}`);
  const enabled = await who.agent.json<{ backupCodes: string[] }>(
    'POST',
    '/api/two-factor/enable',
    { code: codeNow(setup.body.secret) },
  );
  expect(enabled.status, JSON.stringify(enabled.body)).toBe(200);
  nextStep();
  return { secret: setup.body.secret, codes: enabled.body.backupCodes };
}

const systemTypes = (who: Person): string[] =>
  app.db
    .all<{ type: string }>('SELECT type FROM system_messages WHERE user_id = ?', who.id)
    .map((row) => row.type);

describe('second factor of players (SPEC 5.11)', () => {
  it('switching on needs the password and a first code; ten backup codes once', async () => {
    const anna = await person(app, 'Anna');
    // Without a fresh login no setup.
    expect(
      (await anna.agent.json('POST', '/api/two-factor/setup', { token: 'AAAAAAAAAAAAAAAAAAAAAA' }))
        .status,
    ).toBe(403);
    // A token for the password change does not do.
    const other = (await reauth(anna.agent, 'password')).body['token'] as string;
    expect((await anna.agent.json('POST', '/api/two-factor/setup', { token: other })).status).toBe(
      403,
    );
    const token = (await reauth(anna.agent, 'two_factor')).body['token'] as string;
    const setup = await anna.agent.json<{ secret: string }>('POST', '/api/two-factor/setup', {
      token,
    });
    expect(setup.body.secret).toMatch(/^[A-Z2-7]{32}$/);
    // A wrong first code changes nothing.
    expect(
      (await anna.agent.json('POST', '/api/two-factor/enable', { code: '000000' })).body,
    ).toMatchObject({ code: 'two_factor_wrong' });
    const enabled = await anna.agent.json<{
      backupCodes: string[];
      profile: { twoFactor: { active: boolean; backupLeft: number } };
    }>('POST', '/api/two-factor/enable', { code: codeNow(setup.body.secret) });
    expect(enabled.body.backupCodes).toHaveLength(10);
    for (const code of enabled.body.backupCodes) expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(new Set(enabled.body.backupCodes).size).toBe(10);
    expect(enabled.body.profile.twoFactor).toEqual({ active: true, backupLeft: 10 });
    expect(systemTypes(anna)).toContain('two_factor_on');
    // Stored: the secret only encrypted, the backup codes only as HMAC.
    const row = app.db.get<{ secret: Uint8Array; backup: string; user_id: string }>(
      'SELECT secret, backup, user_id FROM two_factor WHERE subject = ?',
      `user:${anna.id}`,
    )!;
    expect(row.user_id).toBe(anna.id);
    expect(Buffer.from(row.secret).toString('latin1')).not.toContain(
      Buffer.from(base32Decode(setup.body.secret)).toString('latin1'),
    );
    for (const code of enabled.body.backupCodes) expect(row.backup).not.toContain(code);
    // A second setup while it is on is refused.
    nextStep();
    const again = (await reauth(anna.agent, 'two_factor', codeNow(setup.body.secret))).body[
      'token'
    ] as string;
    expect(
      (await anna.agent.json('POST', '/api/two-factor/setup', { token: again })).body,
    ).toMatchObject({ code: 'two_factor_active' });
  });

  it('a login waits for the code; wrong codes count, a code works once; then keys and session', async () => {
    const anna = await person(app, 'Anna');
    const { secret } = await enable(anna);
    const device = new Agent(app.userApi, 'https://posteulen.test');
    const first = await login(device, 'Anna', PASSWORD);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ twoFactor: true, ticket: expect.any(String) });
    // The password alone opens no session.
    expect((await device.json('GET', '/api/session')).body).toEqual({ state: 'none' });
    const ticket = first.body['ticket'] as string;
    expect(
      (await device.json('POST', '/api/login/two-factor', { ticket, code: '000000' })).body,
    ).toMatchObject({ code: 'two_factor_wrong' });
    const done = await device.json<{ userId: string; keyPackage: unknown }>(
      'POST',
      '/api/login/two-factor',
      { ticket, code: codeNow(secret) },
    );
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body.userId).toBe(anna.id);
    await unlockFromLogin({ ...first, body: done.body as Record<string, unknown> });
    expect((await device.json('GET', '/api/session')).body).toMatchObject({ state: 'active' });
    // The ticket is used up, and so is the code of this time step.
    expect(
      (await device.json('POST', '/api/login/two-factor', { ticket, code: codeNow(secret) })).body,
    ).toMatchObject({ code: 'login_failed' });
    const second = await login(new Agent(app.userApi, 'https://posteulen.test'), 'Anna', PASSWORD);
    const replay = await device.json('POST', '/api/login/two-factor', {
      ticket: second.body['ticket'],
      code: codeNow(secret),
    });
    expect(replay.body).toMatchObject({ code: 'two_factor_wrong' });
  });

  it('five wrong codes end the login; a backup code works exactly once', async () => {
    const anna = await person(app, 'Anna');
    const { codes } = await enable(anna);
    const device = new Agent(app.userApi, 'https://posteulen.test');
    const first = await login(device, 'Anna', PASSWORD);
    const ticket = first.body['ticket'] as string;
    for (let i = 1; i < TWO_FACTOR.TICKET_TRIES; i++) {
      expect(
        (await device.json('POST', '/api/login/two-factor', { ticket, code: '111111' })).body,
      ).toMatchObject({ code: 'two_factor_wrong' });
    }
    expect(
      (await device.json('POST', '/api/login/two-factor', { ticket, code: '111111' })).body,
    ).toMatchObject({ code: 'login_failed' });
    // After the failures the login waits (login guard, forgotten after a day); then with a
    // backup code.
    app.clock.now += TIME.DAY + TIME.MINUTE;
    const again = await login(device, 'Anna', PASSWORD);
    const backup = codes[0]!.toLowerCase();
    const done = await device.json('POST', '/api/login/two-factor', {
      ticket: again.body['ticket'],
      code: backup,
    });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(
      (await device.json<{ profile: { twoFactor: { backupLeft: number } } }>('GET', '/api/sync'))
        .body.profile.twoFactor.backupLeft,
    ).toBe(9);
    const third = await login(new Agent(app.userApi, 'https://posteulen.test'), 'Anna', PASSWORD);
    expect(
      (
        await device.json('POST', '/api/login/two-factor', {
          ticket: third.body['ticket'],
          code: backup,
        })
      ).body,
    ).toMatchObject({ code: 'two_factor_wrong' });
  });

  it('critical actions need the code too; a backup code also switches it off', async () => {
    const anna = await person(app, 'Anna');
    const { codes, secret } = await enable(anna);
    // Password change and deletion: without a code no token (a success in between resets the
    // login guard, which would otherwise ask for the captcha).
    expect((await reauth(anna.agent, 'password')).body).toMatchObject({ code: 'two_factor_wrong' });
    expect((await reauth(anna.agent, 'password', codeNow(secret))).body['token']).toEqual(
      expect.any(String),
    );
    expect((await reauth(anna.agent, 'delete', '000000')).body).toMatchObject({
      code: 'two_factor_wrong',
    });
    // Switching off with a backup code (the app is lost).
    const token = (await reauth(anna.agent, 'two_factor', codes[3])).body['token'] as string;
    const off = await anna.agent.json<{ profile: { twoFactor: { active: boolean } } }>(
      'POST',
      '/api/two-factor/disable',
      { token },
    );
    expect(off.body.profile.twoFactor.active).toBe(false);
    expect(systemTypes(anna)).toContain('two_factor_off');
    // From now on the password alone is enough again.
    const plain = await login(new Agent(app.userApi, 'https://posteulen.test'), 'Anna', PASSWORD);
    expect(plain.body['userId']).toBe(anna.id);
  });

  it('the second factor goes with the account', async () => {
    const anna = await person(app, 'Anna');
    const { secret } = await enable(anna);
    const token = (await reauth(anna.agent, 'delete', codeNow(secret))).body['token'] as string;
    expect((await anna.agent.json('POST', '/api/account/delete', { token })).status).toBe(200);
    app.db.run('DELETE FROM users WHERE id = ?', anna.id);
    expect(app.db.get('SELECT 1 FROM two_factor WHERE user_id = ?', anna.id)).toBeUndefined();
  });
});

// ── Second factor of the panels ─────────────────────────────────────────────────────────

async function panelLogin(
  agent: Agent,
  password: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  await client.ready();
  const start = client.startLogin(password);
  const first = await agent.json<{ attemptId: string; loginResponse: string }>(
    'POST',
    '/api/login/start',
    { startLoginRequest: start.request },
  );
  const result = client.finishLogin(password, start.state, first.body.loginResponse)!;
  return agent.json('POST', '/api/login/finish', {
    attemptId: first.body.attemptId,
    finishLoginRequest: result.finishRequest,
  });
}

async function panelReauth(agent: Agent, password: string, purpose: string, code?: string) {
  const start = client.startLogin(password);
  const first = await agent.json<{ attemptId: string; loginResponse: string }>(
    'POST',
    '/api/reauth/start',
    { startLoginRequest: start.request, purpose },
  );
  const result = client.finishLogin(password, start.state, first.body.loginResponse)!;
  return agent.json<{ token: string }>('POST', '/api/reauth/finish', {
    attemptId: first.body.attemptId,
    finishLoginRequest: result.finishRequest,
    ...(code ? { code } : {}),
  });
}

describe('second factor of the admin panel and the control centre (SPEC 5.11)', () => {
  it('each panel has its own; the reset on the server switches it off', async () => {
    const adminPassword = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
    const botsPassword = await setInitialAdminPassword(
      app.db,
      app.secrets.opaqueServerSetup,
      'bots_admin',
    );
    app.db.run('UPDATE admin SET must_change_password = 0');
    app.db.run('UPDATE bots_admin SET must_change_password = 0');
    const admin = new Agent(app.adminApi, ADMIN_ORIGIN);
    expect((await panelLogin(admin, adminPassword)).status).toBe(200);
    expect((await admin.json('GET', '/api/me')).body).toMatchObject({
      twoFactor: { active: false, backupLeft: 0 },
    });
    // A token for the password change does not set up the second factor.
    const wrong = (await panelReauth(admin, adminPassword, 'password')).body.token;
    expect((await admin.json('POST', '/api/two-factor/setup', { token: wrong })).status).toBe(403);
    const token = (await panelReauth(admin, adminPassword, 'two_factor')).body.token;
    const setup = await admin.json<{ secret: string; uri: string }>(
      'POST',
      '/api/two-factor/setup',
      { token },
    );
    expect(setup.body.uri).toContain('Adminpanel');
    const enabled = await admin.json<{ backupCodes: string[] }>('POST', '/api/two-factor/enable', {
      code: codeNow(setup.body.secret),
    });
    expect(enabled.body.backupCodes).toHaveLength(10);
    nextStep();
    // The password change now needs the code as well.
    expect((await panelReauth(admin, adminPassword, 'password')).body).toMatchObject({
      code: 'two_factor_wrong',
    });
    // Login: the password alone gives a ticket, no session.
    const fresh = new Agent(app.adminApi, ADMIN_ORIGIN);
    const first = await panelLogin(fresh, adminPassword);
    expect(first.body).toEqual({ twoFactor: true, ticket: expect.any(String) });
    expect((await fresh.json('GET', '/api/session')).body).toEqual({ state: 'none' });
    const done = await fresh.json('POST', '/api/login/two-factor', {
      ticket: first.body['ticket'],
      code: codeNow(setup.body.secret),
    });
    expect(done.body).toEqual({ mustChangePassword: false });
    expect((await fresh.json('GET', '/api/session')).body).toMatchObject({ state: 'active' });
    // The control centre is not affected.
    const centre = new Agent(app.botsApi, BOTS_ORIGIN);
    expect((await panelLogin(centre, botsPassword)).body).toEqual({ mustChangePassword: false });
    // A ticket of the admin panel does not open the control centre.
    const adminTicket = (await panelLogin(new Agent(app.adminApi, ADMIN_ORIGIN), adminPassword))
      .body['ticket'];
    nextStep();
    expect(
      (
        await centre.json('POST', '/api/login/two-factor', {
          ticket: adminTicket,
          code: codeNow(setup.body.secret),
        })
      ).body,
    ).toMatchObject({ code: 'login_failed' });
    // Root resets: new initial password, the second factor is gone.
    const reset = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
    expect(app.db.get("SELECT 1 FROM two_factor WHERE subject = 'admin'")).toBeUndefined();
    expect((await panelLogin(new Agent(app.adminApi, ADMIN_ORIGIN), reset)).body).toEqual({
      mustChangePassword: true,
    });
  });
});

// ── Safety filter of the bots ───────────────────────────────────────────────────────────

function explainerOf(who: Person) {
  return app.db.get<{ id: string }>(
    "SELECT id FROM bots WHERE owner_id = ? AND type = 'explainer'",
    who.id,
  )!.id;
}

async function writeToBot(who: Person, botId: string, text: string) {
  const owl = await borrowOwl(who);
  const sent = await who.agent.json<{ letters: { id: string; arrivesAt: number }[] }>(
    'POST',
    '/api/bot-letters/send',
    { botId, owlId: owl, parchment: 'small', text },
  );
  expect(sent.status, JSON.stringify(sent.body)).toBe(200);
  return sent.body.letters[0]!;
}

const letterOf = (id: string) =>
  app.db.get<{ ai_text: string | null; read: number; plaintext: string }>(
    'SELECT ai_text, read, plaintext FROM letters WHERE id = ?',
    id,
  );

describe('safety filter before the AI (SPEC 10.5)', () => {
  beforeEach(async () => {
    await storeApiKey(app.ctx, 'sk-test-0000000000000000', app.clock.now);
  });

  it('the Erklärbär: the letter alone first, the AI only sees the filtered version', async () => {
    const anna = await person(app, 'Anna');
    const bear = explainerOf(anna);
    ai.filter = (text) =>
      text
        .split('\n\n')
        .filter((paragraph) => !paragraph.includes('Messer'))
        .join('\n\n');
    const letter = await writeToBot(
      anna,
      bear,
      'Hallo Bär!\n\nIch habe ein Messer.\n\nWie geht es dir?',
    );
    advanceTo(app, letter.arrivesAt + 2 * TIME.HOUR);
    await app.ctx.botReplies.idle();
    // The filter got only the letter: its own instruction and the text, nothing else.
    expect(ai.filterCalls).toHaveLength(1);
    expect(ai.filterCalls[0]).toEqual([
      { role: 'system', content: FILTER_PROMPT },
      { role: 'user', content: 'Hallo Bär!\n\nIch habe ein Messer.\n\nWie geht es dir?' },
    ]);
    expect(letterOf(letter.id)?.ai_text).toBe('Hallo Bär!\n\nWie geht es dir?');
    // The reply was written from the filtered version only.
    expect(ai.calls).toHaveLength(1);
    const sent = JSON.stringify(ai.calls[0]!.messages);
    expect(sent).toContain('Wie geht es dir?');
    expect(sent).not.toContain('Messer');
    // The player keeps their own letter.
    expect(letterOf(letter.id)?.plaintext).toContain('Messer');

    // The next reply (a bot takes one letter a day): the earlier letter goes into the history
    // filtered, without filtering it again.
    advanceTo(
      app,
      Date.parse(new Date(app.clock.now + TIME.DAY).toISOString().slice(0, 10)) + 8 * TIME.HOUR,
    );
    const next = await writeToBot(anna, bear, 'Noch eine Frage.');
    advanceTo(app, next.arrivesAt + 2 * TIME.HOUR);
    await app.ctx.botReplies.idle();
    expect(ai.filterCalls).toHaveLength(2);
    const history = JSON.stringify(ai.calls.at(-1)!.messages);
    expect(history).toContain('Hallo Bär!');
    expect(history).not.toContain('Messer');
  });

  it('nothing left: no reply, the letter counts as answered', async () => {
    const anna = await person(app, 'Anna');
    const bear = explainerOf(anna);
    ai.filter = () => FILTER_EMPTY;
    const letter = await writeToBot(anna, bear, 'Nur Gewalt.');
    advanceTo(app, letter.arrivesAt + 2 * TIME.HOUR);
    await app.ctx.botReplies.idle();
    expect(ai.calls).toHaveLength(0);
    expect(letterOf(letter.id)).toMatchObject({ ai_text: '', read: 1 });
    expect(app.db.get('SELECT 1 FROM bot_jobs WHERE letter_id = ?', letter.id)).toBeUndefined();
  });

  it('a filter answer longer than the letter is no filtered letter: retry later', async () => {
    const anna = await person(app, 'Anna');
    const bear = explainerOf(anna);
    ai.filter = () => 'Lieber Briefschreiber, vielen Dank für deinen netten Brief! '.repeat(3);
    const letter = await writeToBot(anna, bear, 'Kurz.');
    advanceTo(app, letter.arrivesAt + 2 * TIME.HOUR);
    await app.ctx.botReplies.idle();
    expect(ai.calls).toHaveLength(0);
    expect(letterOf(letter.id)?.ai_text).toBeNull();
    expect(
      app.db.get<{ attempts: number }>(
        'SELECT attempts FROM bot_jobs WHERE letter_id = ?',
        letter.id,
      )?.attempts,
    ).toBe(1);
    expect(app.db.get<{ cause: string }>('SELECT cause FROM error_log')?.cause).toContain(
      'Vorfilter',
    );
  });
});

// ── Bots of the control centre ──────────────────────────────────────────────────────────

describe('control-centre bots: owl sex and safety filter (SPEC 10.5, 10.6)', () => {
  let centre: Agent;

  async function settle(at: number): Promise<void> {
    for (
      let t = Math.min(app.clock.now + 10 * TIME.MINUTE, at);
      ;
      t = Math.min(t + 10 * TIME.MINUTE, at)
    ) {
      for (let i = 0; i < 3; i++) {
        advanceTo(app, t);
        await app.ctx.centralBots.idle();
      }
      if (t >= at) break;
    }
    app.db.run('UPDATE bots_admin_sessions SET last_used_at = ?', app.clock.now);
  }

  async function newBot(settings: Record<string, unknown> = {}): Promise<string> {
    const id = (await centre.json<{ id: string }>('POST', '/api/bots', { name: 'Kapitän Ahoi' }))
      .body.id;
    const saved = await centre.json('PUT', `/api/bots/${id}/settings`, {
      name: 'Kapitän Ahoi',
      character: 'Ein freundlicher Seefahrer.',
      home: PARIS,
      owlMode: 'loan',
      owlSpecies: null,
      owlName: null,
      motivation: 200,
      restHours: 0,
      playerOwls: true,
      ...settings,
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect((await centre.json('POST', `/api/bots/${id}/state`, { state: 'active' })).status).toBe(
      200,
    );
    return id;
  }

  beforeEach(async () => {
    const password = await setInitialAdminPassword(
      app.db,
      app.secrets.opaqueServerSetup,
      'bots_admin',
    );
    app.db.run('UPDATE bots_admin SET must_change_password = 0');
    centre = new Agent(app.botsApi, BOTS_ORIGIN);
    await panelLogin(centre, password);
    await storeApiKey(app.ctx, 'sk-test-0000000000000000', app.clock.now);
  });

  it('the sex of the own owl can be chosen; without it, it stays', async () => {
    const id = await newBot({
      owlMode: 'own',
      owlSpecies: 'waldkauz',
      owlName: 'Möwe',
      owlSex: 'm',
    });
    expect((await centre.json<{ owlSex: string }>('GET', `/api/bots/${id}`)).body.owlSex).toBe('m');
    const female = await centre.json<{ owlSex: string }>('PUT', `/api/bots/${id}/settings`, {
      name: 'Kapitän Ahoi',
      character: 'Ein freundlicher Seefahrer.',
      home: PARIS,
      owlMode: 'own',
      owlSpecies: 'waldkauz',
      owlName: 'Möwe',
      owlSex: 'f',
      motivation: 200,
      restHours: 0,
      playerOwls: true,
    });
    expect(female.body.owlSex).toBe('f');
    const kept = await centre.json<{ owlSex: string }>('PUT', `/api/bots/${id}/settings`, {
      name: 'Kapitän Ahoi',
      character: 'Ein anderer Charakter.',
      home: PARIS,
      owlMode: 'own',
      owlSpecies: 'waldkauz',
      owlName: 'Möwe',
      motivation: 200,
      restHours: 0,
      playerOwls: true,
    });
    expect(kept.body.owlSex).toBe('f');
    expect(
      (
        await centre.json('PUT', `/api/bots/${id}/settings`, {
          name: 'Kapitän Ahoi',
          character: '',
          home: PARIS,
          owlMode: 'own',
          owlSpecies: 'waldkauz',
          owlName: 'Möwe',
          owlSex: 'x',
          motivation: 200,
          restHours: 0,
          playerOwls: true,
        })
      ).status,
    ).toBe(400);
  });

  it('nothing left of the letters: no spontaneous reply, the letters count as answered', async () => {
    const anna = await person(app, 'Anna', BERLIN);
    const bot = await newBot();
    // The bot introduces itself first (so Anna knows it).
    await centre.json('POST', `/api/bots/${bot}/events`, {
      dueAt: app.clock.now + TIME.HOUR,
      move: null,
      letter: {
        parchment: 'small',
        owlMode: 'default',
        texts: {
          de: { first: 'Ahoi!', follow: 'Ahoi wieder!' },
          en: { first: 'Ahoy!', follow: 'Ahoy again!' },
        },
        media: [],
      },
      gift: null,
      context: '',
    });
    await settle(app.clock.now + 8 * TIME.HOUR);
    ai.filter = () => FILTER_EMPTY;
    const letter = await writeToBot(anna, bot, 'Etwas über Drogen.');
    await settle(letter.arrivesAt + 4 * TIME.HOUR);
    expect(ai.filterCalls.length).toBeGreaterThanOrEqual(1);
    expect(ai.calls).toHaveLength(0);
    expect(
      app.db.get<{ state: string }>(
        'SELECT state FROM central_bot_inbox WHERE letter_id = ?',
        letter.id,
      )?.state,
    ).toBe('answered');
    expect(letterOf(letter.id)).toMatchObject({ ai_text: '', read: 1 });
  });

  it('the AI test goes through the filter as well', async () => {
    const bot = await newBot();
    ai.filter = () => FILTER_EMPTY;
    const empty = await centre.json('POST', `/api/bots/${bot}/ai-test`, {
      language: 'de',
      variant: 'follow',
      planned: 'Hallo wieder!',
      context: '',
      playerLetter: 'Nur Gewalt.',
    });
    expect(empty.body).toEqual({ problem: 'filtered' });
    expect(ai.calls).toHaveLength(0);
    ai.filter = (text) => text.replace(' und ein Messer', '');
    const ok = await centre.json<{ text: string }>('POST', `/api/bots/${bot}/ai-test`, {
      language: 'de',
      variant: 'follow',
      planned: 'Hallo wieder!',
      context: '',
      playerLetter: 'Ich habe einen Hund und ein Messer.',
    });
    expect(ok.body.text).toBe('KI-Brief: Danke für deine Zeilen!');
    const sent = JSON.stringify(ai.calls.at(-1)!.messages);
    expect(sent).toContain('Ich habe einen Hund.');
    expect(sent).not.toContain('Messer');
  });
});

// ── Server der Instanz ──────────────────────────────────────────────────────────────────

describe('„Server der Instanz“ (SPEC 13 item 13)', () => {
  it('reads key=value lines and blocklist results, ignores everything else', () => {
    expect(parseKeyValues('a_b=1\nfoo\nX=2\nc=\n')).toEqual(
      new Map([
        ['a_b', '1'],
        ['c', ''],
      ]),
    );
    const parsed = parseBlocklists(
      [
        'checked_at=1795800000',
        'result zen.spamhaus.org 203.0.113.5 listed',
        'result dbl.spamhaus.org posteulen.test clean',
        'result oisd-big posteulen.test unknown',
        'result unbekannt.example 203.0.113.5 listed',
        'result zen.spamhaus.org 203.0.113.5 vielleicht',
        'result zen.spamhaus.org <script> listed',
      ].join('\n'),
    );
    expect(parsed.checkedAt).toBe(1_795_800_000_000);
    expect(parsed.results).toEqual([
      {
        list: 'zen.spamhaus.org',
        name: 'Spamhaus ZEN',
        group: 'spam_ip',
        target: '203.0.113.5',
        state: 'listed',
      },
      {
        list: 'dbl.spamhaus.org',
        name: 'Spamhaus DBL',
        group: 'spam_domain',
        target: 'posteulen.test',
        state: 'clean',
      },
      {
        list: 'oisd-big',
        name: 'OISD big',
        group: 'ads',
        target: 'posteulen.test',
        state: 'unknown',
      },
    ]);
  });

  it('compares versions with pre-releases', () => {
    expect(compareVersions('1.4.3', '1.4.2')).toBe(1);
    expect(compareVersions('1.4.10', '1.4.9')).toBe(1);
    expect(compareVersions('1.4.3', '1.4.3')).toBe(0);
    expect(compareVersions('1.4.3-stufe.2', '1.4.3')).toBe(-1);
    expect(compareVersions('v1.5.0', '1.4.3')).toBe(1);
  });

  it('uptime, updates, nightly run and blocklists; the switch reaches the night helper', async () => {
    const password = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
    app.db.run('UPDATE admin SET must_change_password = 0');
    const admin = new Agent(app.adminApi, ADMIN_ORIGIN);
    await panelLogin(admin, password);
    // Before the helpers ran: nothing known yet.
    expect((await admin.json('GET', '/api/server-info')).body).toMatchObject({
      version: VERSION,
      checkedAt: null,
      bootAt: null,
      aptUpdates: null,
      latest: null,
      updateAvailable: null,
      autoUpdate: { enabled: true, lastRunAt: null, result: null },
      blocklists: { torOnly: false, checkedAt: null, results: [] },
    });
    fs.writeFileSync(
      app.config.serverInfoFile,
      'checked_at=1795800000\nboot_at=1795000000\napt_ok=1\napt_updates=7\nreboot_required=1\nposteulen_latest=v9.0.0\n',
    );
    fs.writeFileSync(
      app.config.autoUpdateFile,
      'run_at=1795790000\nresult=error\napt=ok\napt_upgraded=12\nposteulen=error\nreboot=0\n',
    );
    fs.writeFileSync(
      app.config.blocklistFile,
      'checked_at=1795700000\nresult bl.spamcop.net 203.0.113.5 clean\n',
    );
    expect((await admin.json('GET', '/api/server-info')).body).toMatchObject({
      checkedAt: 1_795_800_000_000,
      bootAt: 1_795_000_000_000,
      aptUpdates: 7,
      rebootRequired: true,
      latest: '9.0.0',
      updateAvailable: true,
      autoUpdate: {
        enabled: true,
        lastRunAt: 1_795_790_000_000,
        result: 'error',
        aptUpgraded: 12,
        posteulen: 'error',
        rebooted: false,
      },
      blocklists: {
        torOnly: false,
        checkedAt: 1_795_700_000_000,
        results: [{ list: 'bl.spamcop.net', target: '203.0.113.5', state: 'clean' }],
      },
    });
    // apt could not be asked: unknown, not 0.
    fs.writeFileSync(app.config.serverInfoFile, 'checked_at=1795800000\napt_ok=0\napt_updates=0\n');
    expect((await admin.json('GET', '/api/server-info')).body).toMatchObject({ aptUpdates: null });
    // The switch.
    const off = await admin.json('PUT', '/api/settings/auto-update', { enabled: false });
    expect(off.body).toMatchObject({ autoUpdate: { enabled: false } });
    expect(fs.readFileSync(app.config.autoUpdateSwitchFile, 'utf8')).toBe('off\n');
    await admin.json('PUT', '/api/settings/auto-update', { enabled: true });
    expect(fs.readFileSync(app.config.autoUpdateSwitchFile, 'utf8')).toBe('on\n');
    fs.rmSync(app.config.autoUpdateSwitchFile);
    syncAutoUpdateSwitch(app.ctx);
    expect(fs.readFileSync(app.config.autoUpdateSwitchFile, 'utf8')).toBe('on\n');
    expect((await admin.json('PUT', '/api/settings/auto-update', { enabled: 'ja' })).status).toBe(
      400,
    );
    // Only for the admin.
    expect(
      (await new Agent(app.adminApi, ADMIN_ORIGIN).json('GET', '/api/server-info')).status,
    ).toBe(401);
  });

  it('a Tor-only instance has no blocklists to check', async () => {
    await app.close();
    app = await testApp({ aiClient: ai, env: { POSTEULEN_TOR_ONLY: '1', POSTEULEN_DOMAIN: '' } });
    fs.writeFileSync(app.config.blocklistFile, 'checked_at=1795700000\ntor_only=1\n');
    expect(serverInfo(app.ctx).blocklists).toEqual({ torOnly: true });
  });
});

// ── Scripts: progress, blocklists, nightly updates (SPEC 13 item 13, 16.1, 16.3) ─────────

const REPO = path.resolve(import.meta.dirname, '../..');
const code = (file: string): string => fs.readFileSync(path.join(REPO, file), 'utf8');

/** Runs a snippet with the functions of a deploy script loaded (nothing as root). */
function shell(file: string, script: string, ...args: string[]) {
  const result = spawnSync(
    'bash',
    ['-c', `source "$1" 2>/dev/null; shift; ${script}`, '_', path.join(REPO, file), ...args],
    { encoding: 'utf8' },
  );
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

describe('progress of installation and update (SPEC 16.1)', () => {
  it('a bar „Schritt x von y“ with an understandable sentence; busy keeps the status', () => {
    const out = shell(
      'deploy/lib.sh',
      `progress_init 4; step 'Erster Schritt'; step 'Zweiter'; busy 'Kurz' true; busy 'Kaputt' bash -c 'exit 3' || echo "status=$?"`,
    );
    expect(out.stdout).toContain('[██████░░░░░░░░░░░░░░░░░░] Schritt 1 von 4: Erster Schritt');
    expect(out.stdout).toContain('[████████████░░░░░░░░░░░░] Schritt 2 von 4: Zweiter');
    // Without a terminal: plain lines, the command runs as usual.
    expect(out.stdout).toContain('==> Kurz …');
    expect(out.stdout).toContain('status=3');
  });

  it('installation and update show their steps; the update carries on the count', () => {
    expect(code('deploy/install.sh').match(/^step /gm)?.length).toBe(10);
    expect(code('deploy/install.sh')).toMatch(/progress_init 10/);
    const update = code('deploy/update.sh');
    expect(update.match(/^step /gm)?.length).toBe(9);
    expect(update).toMatch(/progress_init \$\(\(\$\{PE_PROGRESS_STEP:-0\} \+ 9\)\)/);
    expect(code('deploy/posteulen-update')).toMatch(/export PE_PROGRESS_STEP=\$PE_STEP/);
    // The long parts of the build run with busy.
    const build = code('deploy/lib.sh').slice(code('deploy/lib.sh').indexOf('build_release() {'));
    expect(build).toMatch(/busy 'Lade die Bausteine \(npm ci\)' npm ci/);
    expect(build).toMatch(/npm run build --silent &&/);
  });
});

describe('blocklists of the server (SPEC 13 item 13)', () => {
  it('reverses IPv4 and IPv6 addresses and lists the domain with its parents', () => {
    const out = shell(
      'deploy/server-check.sh',
      'ipv4_reverse 203.0.113.5; echo; ipv6_reverse 2001:db8::1; echo; ipv6_reverse ::1; echo; ipv6_reverse 1::2::3 || echo kaputt; domain_and_parents eulen.example.co.uk',
    );
    expect(out.stdout.split('\n')).toEqual([
      '5.113.0.203',
      `1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2`,
      `1.${'0.'.repeat(30)}0`,
      'kaputt',
      'eulen.example.co.uk',
      'example.co.uk',
      'co.uk',
      '',
    ]);
  });

  it('a DNS answer 127.x is a listing, none is clean, refusals are unknown', () => {
    const out = shell(
      'deploy/server-check.sh',
      `dns_answer() { case $1 in a.*) echo 127.0.0.2 ;; b.*) echo '' ;; c.*) echo 127.255.255.254 ;; d.*) echo 127.0.0.1 ;; *) echo 93.184.216.34 ;; esac; }
       for n in a b c d e; do printf '%s ' "$(dnsbl_state "$n.zen.spamhaus.org")"; done`,
    );
    expect(out.stdout.trim()).toBe('listed clean unknown unknown unknown');
  });

  it('a list that does not answer its test point is unknown for all addresses', () => {
    const out = shell(
      'deploy/server-check.sh',
      `dns_answer() { case $1 in 2.0.0.127.*) echo '' ;; *) echo 127.0.0.2 ;; esac; }
       check_ip_list bl.spamcop.net 1 203.0.113.5 2001:db8::1; printf '%s' "$results"`,
    );
    expect(out.stdout).toBe(
      'result bl.spamcop.net 203.0.113.5 unknown\nresult bl.spamcop.net 2001:db8::1 unknown\n',
    );
    const ok = shell(
      'deploy/server-check.sh',
      `dns_answer() { case $1 in 2.0.0.127.*|5.113.0.203.*) echo 127.0.0.2 ;; *) echo '' ;; esac; }
       check_ip_list bl.spamcop.net 1 203.0.113.5 198.51.100.7 2001:db8::1; printf '%s' "$results"`,
    );
    // IPv4-only lists skip IPv6 addresses.
    expect(ok.stdout).toBe(
      'result bl.spamcop.net 203.0.113.5 listed\nresult bl.spamcop.net 198.51.100.7 clean\n',
    );
  });

  it('downloadable lists: hosts and domain format, too short a list counts as unknown', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'posteulen-blocklist-'));
    const filler = Array.from({ length: 1200 }, (_, i) => `werbung${i}.example`);
    fs.writeFileSync(
      path.join(dir, 'hosts'),
      ['# Kommentar', '0.0.0.0 admin.posteulen.test', ...filler.map((n) => `0.0.0.0 ${n}`)].join(
        '\n',
      ),
    );
    fs.writeFileSync(
      path.join(dir, 'domains'),
      ['! Kopf', '*.tracker.example', ...filler].join('\n'),
    );
    fs.writeFileSync(path.join(dir, 'short'), 'posteulen.test\n');
    try {
      const out = shell(
        'deploy/server-check.sh',
        `TMPDIR="$1"
         check_download_list stevenblack "file://$1/hosts" hosts posteulen.test posteulen.test www.posteulen.test admin.posteulen.test
         check_download_list oisd-big "file://$1/domains" domains posteulen.test posteulen.test admin.posteulen.test
         check_download_list hagezi-pro "file://$1/short" domains posteulen.test posteulen.test
         check_download_list hagezi-pro "file://$1/fehlt" domains posteulen.test posteulen.test
         printf '%s' "$results"; printf '%s\\n' "\${listed[@]}"`,
        dir,
      );
      expect(out.stdout).toBe(
        [
          'result stevenblack admin.posteulen.test listed',
          'result oisd-big posteulen.test clean',
          'result hagezi-pro posteulen.test unknown',
          'result hagezi-pro posteulen.test unknown',
          'stevenblack admin.posteulen.test',
          '',
        ].join('\n'),
      );
      // Nothing of the downloads stays behind.
      expect(fs.readdirSync(dir).sort()).toEqual(['domains', 'hosts', 'short']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a Tor-only instance writes only the note; listings go into the error log', () => {
    const script = code('deploy/server-check.sh');
    const tor = script.indexOf('if tor_only; then');
    expect(tor).toBeGreaterThan(0);
    expect(tor).toBeLessThan(script.indexOf('check_ip_list zen.spamhaus.org'));
    expect(script).toMatch(/printf 'checked_at=%s\\ntor_only=1\\n'/);
    expect(script).toMatch(/ops_report Blocklisten warning/);
  });
});

describe('nightly automatic updates (SPEC 16.3)', () => {
  it('only after the nightly backup – a backup by hand starts no update', () => {
    const nightly = code('deploy/systemd/posteulen-nightly.service');
    expect(nightly).toMatch(/^OnSuccess=posteulen-autoupdate\.service$/m);
    expect(nightly).toMatch(/^OnFailure=posteulen-autoupdate\.service$/m);
    expect(nightly).toMatch(/backup\.sh --reason taeglich/);
    expect(code('deploy/systemd/posteulen-backup.timer')).toMatch(
      /^Unit=posteulen-nightly\.service$/m,
    );
    expect(code('deploy/systemd/posteulen-backup.service')).not.toMatch(/OnSuccess|OnFailure/);
    // Without the script (rollback to an older version) nothing runs.
    for (const unit of [
      'posteulen-autoupdate.service',
      'posteulen-check.service',
      'posteulen-blocklists.service',
    ])
      expect(code(`deploy/systemd/${unit}`)).toMatch(
        /^ConditionPathExists=\/opt\/posteulen\/current\/deploy\//m,
      );
    const configure = code('deploy/configure.sh');
    for (const unit of [
      'posteulen-nightly.service',
      'posteulen-autoupdate.service',
      'posteulen-check.timer',
      'posteulen-blocklists.timer',
    ])
      expect(configure).toContain(unit);
    expect(configure).toMatch(
      /enable --now --quiet posteulen-check\.timer posteulen-blocklists\.timer/,
    );
  });

  it('Debian first (keeping changed config files), then PostEulen, a restart only when Debian asks', () => {
    const script = code('deploy/auto-update.sh');
    const off = script.indexOf('$PE_AUTO_UPDATE_SWITCH');
    const backup = script.indexOf('posteulen-nightly.service');
    const apt = script.indexOf('full-upgrade >"$log"');
    const update = script.indexOf('/usr/local/sbin/posteulen-update --yes');
    const reboot = script.indexOf('systemctl reboot');
    for (const at of [off, backup, apt, update, reboot]) expect(at).toBeGreaterThan(0);
    expect(off).toBeLessThan(backup);
    expect(backup).toBeLessThan(apt);
    expect(apt).toBeLessThan(update);
    expect(update).toBeLessThan(reboot);
    expect(script).toMatch(/--force-confold/);
    expect(script).toMatch(/DEBIAN_FRONTEND=noninteractive/);
    expect(script.slice(script.indexOf('# ── 3.'))).toMatch(
      /if \[\[ -f \/run\/reboot-required \]\]; then/,
    );
    // Every failure has a readable entry in the error log.
    expect(script.match(/ops_report "\$COMPONENT" error/g)?.length).toBe(4);
  });
});
