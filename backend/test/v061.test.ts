/** Security review v0.6.1: one test per closed gap (SPEC Anhang O). */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as v from 'valibot';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { createAccountKeys, rewrapMasterKey } from '@posteulen/shared/crypto/keypackage.ts';
import { toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { SECURITY, TIME } from '@posteulen/shared/constants.ts';
import { Base64Url } from '@posteulen/shared/schemas/common.ts';
import { LoginGuard, RateLimiter } from '../src/security/limits.ts';
import { logError } from '../src/ops/error-log.ts';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import { utcDay } from '../src/security/ids.ts';
import {
  ADMIN_ORIGIN,
  Agent,
  BERLIN,
  login,
  person,
  register,
  testApp,
  USER_ORIGIN,
  type TestApp,
} from './auth-helpers.ts';

const PASSWORD = 'ein sehr langes Passwort';

describe('in-memory limits survive flooding (v0.6.1)', () => {
  it('keeps counters that slow someone down when the table is full', () => {
    const guard = new LoginGuard(5, 3, 24 * TIME.HOUR, 100);
    for (let i = 0; i < 6; i++) guard.fail('opfer', 0);
    expect(guard.waitMs('opfer', 0)).toBeGreaterThan(0);
    // An attacker fills the table with fresh keys (e.g. many IPv6 prefixes) ...
    for (let i = 0; i < 1000; i++) guard.fail(`flut-${i}`, 1);
    // ... but the counter of the attacked name is still there.
    expect(guard.captchaRequired('opfer', 2)).toBe(true);
    expect(guard.waitMs('opfer', 2)).toBeGreaterThan(0);
  });

  it('evicts the least recently failed counters only as a last resort', () => {
    const guard = new LoginGuard(5, 3, 24 * TIME.HOUR, 10);
    for (let k = 0; k < 10; k++) for (let i = 0; i < 3; i++) guard.fail(`k${k}`, k);
    guard.fail('neu', 100);
    expect(guard.captchaRequired('k0', 101)).toBe(false);
    expect(guard.captchaRequired('k9', 101)).toBe(true);
  });

  it('takes back exactly the failure a successful attempt counted', () => {
    const guard = new LoginGuard(5, 3);
    guard.fail('ip', 0);
    guard.fail('ip', 0);
    guard.succeed('ip');
    guard.fail('ip', 0);
    guard.succeed('ip');
    expect(guard.captchaRequired('ip', 0)).toBe(false);
    guard.succeed('ip');
    guard.succeed('nie-gesehen');
    for (let i = 0; i < 3; i++) guard.fail('ip', 0);
    expect(guard.captchaRequired('ip', 0)).toBe(true);
  });

  it('never clears a full rate limiter as a whole', () => {
    const limiter = new RateLimiter(1, 60_000, 10);
    limiter.hit('angreifer', 0);
    expect(limiter.hit('angreifer', 0)).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) limiter.hit(`x${i}`, 0);
    expect(limiter.hit('angreifer', 0)).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) limiter.hit(`y${i}`, 0);
    // Only the oldest windows went; the table never got empty.
    expect(limiter.hit('y19', 0)).toBeGreaterThan(0);
  });
});

describe('base64url fields (v0.6.1)', () => {
  it('rejects lengths that can never be decoded', () => {
    const schema = Base64Url(1, 10);
    expect(v.safeParse(schema, 'abcd').success).toBe(true);
    expect(v.safeParse(schema, 'abcdef').success).toBe(true);
    expect(v.safeParse(schema, 'abcde').success).toBe(false);
  });
});

describe('server (v0.6.1)', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await testApp();
  });
  afterEach(async () => {
    await app.close();
  });

  const errorCount = (): number =>
    app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM error_log')?.n ?? 0;

  it('accepts one captcha solution only once, also for requests at the same time', async () => {
    const agent = new Agent(app.userApi, USER_ORIGIN);
    const altcha = (await agent.altcha()) as Parameters<typeof app.ctx.altcha.verify>[0];
    const results = await Promise.all(
      Array.from({ length: 8 }, () => app.ctx.altcha.verify(altcha)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await app.ctx.altcha.verify(altcha)).toBe(false);
    // A forged signature is not remembered (cannot crowd out real ones).
    const forged = { ...altcha, challenge: { ...altcha.challenge, signature: 'ab'.repeat(32) } };
    expect(await app.ctx.altcha.verify(forged)).toBe(false);
  });

  it('lets parallel logins with one captcha solution not pass the waiting time', async () => {
    await register(new Agent(app.userApi, USER_ORIGIN), 'Ziel', PASSWORD);
    const attacker = new Agent(app.userApi, USER_ORIGIN);
    // Four failures for the name: captcha from 3, waiting time from 5 (SPEC 5.10).
    for (let i = 0; i < 4; i++) await login(attacker, 'Ziel', 'falsches Passwort!!', i >= 3);
    await client.ready();
    const altchas = await Promise.all(Array.from({ length: 6 }, () => attacker.altcha()));
    const starts = await Promise.all(
      altchas.map((altcha) =>
        attacker.json<{ status: string }>('POST', '/api/login/start', {
          name: 'Ziel',
          startLoginRequest: client.startLogin('falsches Passwort!!').request,
          altcha,
        }),
      ),
    );
    // Before v0.6.1 all six passed; now the waiting time starts after the fifth failure.
    expect(starts.filter((s) => s.body.status === 'ok').length).toBeLessThanOrEqual(2);
    expect(starts.some((s) => s.body.status === 'wait')).toBe(true);
  });

  it('answers malformed OPAQUE messages with 400 and no error log entry', async () => {
    const agent = new Agent(app.userApi, USER_ORIGIN);
    for (const name of ['Niemand', 'Auch Niemand']) {
      const start = await agent.json('POST', '/api/login/start', {
        name,
        startLoginRequest: 'A'.repeat(128),
      });
      expect(start.status).toBe(400);
    }
    const reg = await agent.json('POST', '/api/register/start', {
      name: 'Neuling',
      altcha: await agent.altcha(),
      registrationRequest: 'A'.repeat(43),
    });
    expect(reg.status).toBe(400);
    // Nothing was reserved: the name can be registered right away.
    expect((await register(agent, 'Neuling', PASSWORD)).status).toBe(200);
    expect(errorCount()).toBe(0);
  });

  it('stores only usable registration records and valid public keys', async () => {
    await client.ready();
    let candidate = 0;
    const tryFinish = async (change: (body: Record<string, unknown>) => void) => {
      const agent = new Agent(app.userApi, USER_ORIGIN);
      const start = client.startRegistration(PASSWORD);
      const first = await agent.json<{
        reservationId: string;
        userId: string;
        registrationResponse: string;
      }>('POST', '/api/register/start', {
        name: `Prüfling ${++candidate}`,
        altcha: await agent.altcha(),
        registrationRequest: start.request,
      });
      const finish = client.finishRegistration(
        PASSWORD,
        start.state,
        first.body.registrationResponse,
      );
      const { keyPackage, account } = await createAccountKeys(first.body.userId, finish.exportKey);
      const body: Record<string, unknown> = {
        reservationId: first.body.reservationId,
        registrationRecord: finish.record,
        ed25519Public: toBase64Url(account.identity.ed25519Public),
        x25519Public: toBase64Url(account.identity.x25519Public),
        keyPackage,
        home: BERLIN,
      };
      change(body);
      return (await agent.json('POST', '/api/register/finish', body)).status;
    };
    expect(await tryFinish(() => undefined)).toBe(200);
    expect(await tryFinish((b) => (b['registrationRecord'] = 'A'.repeat(256)))).toBe(400);
    expect(await tryFinish((b) => (b['ed25519Public'] = 'A'.repeat(43)))).toBe(400);
    // X25519 of small order (the point 1).
    expect(await tryFinish((b) => (b['x25519Public'] = `AQ${'A'.repeat(41)}`))).toBe(400);
    expect(errorCount()).toBe(0);
  });

  it('does not count successful logins as failures of the IP address', async () => {
    const shared = '203.0.113.77';
    for (let i = 0; i < 10; i++) {
      const agent = new Agent(app.userApi, USER_ORIGIN, shared);
      await register(new Agent(app.userApi, USER_ORIGIN), `Nachbar ${i}`, PASSWORD);
      expect((await login(agent, `Nachbar ${i}`, PASSWORD)).status).toBe(200);
    }
    // Before v0.6.1 the shared address needed a captcha after the 10th login.
    expect(app.ctx.guards.ips.captchaRequired(shared, app.clock.now)).toBe(false);
  }, 120_000);

  it('closes live connections after a password change', async () => {
    const agent = new Agent(app.userApi, USER_ORIGIN);
    const reg = await register(agent, 'Paul', PASSWORD);
    const userId = reg.account!.userId;
    let ended = 0;
    const stream = { on: () => stream, write: () => true, end: () => void ended++ };
    app.ctx.hub.add(userId, stream as unknown as import('node:http').ServerResponse);
    await client.ready();
    const start = client.startLogin(PASSWORD);
    const first = await agent.json<{ attemptId: string; loginResponse: string }>(
      'POST',
      '/api/reauth/start',
      { purpose: 'password', startLoginRequest: start.request },
    );
    const result = client.finishLogin(PASSWORD, start.state, first.body.loginResponse)!;
    const re = await agent.json<{ token: string }>('POST', '/api/reauth/finish', {
      attemptId: first.body.attemptId,
      finishLoginRequest: result.finishRequest,
    });
    const next = client.startRegistration('mein neues langes Passwort');
    const response = await agent.json<{ registrationResponse: string }>(
      'POST',
      '/api/password/start',
      { token: re.body.token, registrationRequest: next.request },
    );
    const finish = client.finishRegistration(
      'mein neues langes Passwort',
      next.state,
      response.body.registrationResponse,
    );
    const keyPackage = await rewrapMasterKey(
      userId,
      reg.account!.keyPackage,
      result.exportKey,
      finish.exportKey,
    );
    // A broken record is refused, the account stays usable.
    expect(
      (
        await agent.json('POST', '/api/password/finish', {
          token: re.body.token,
          registrationRecord: 'A'.repeat(256),
          keyPackage,
        })
      ).status,
    ).toBe(400);
    expect(ended).toBe(0);
    const done = await agent.json('POST', '/api/password/finish', {
      token: re.body.token,
      registrationRecord: finish.record,
      keyPackage,
    });
    expect(done.status).toBe(200);
    expect(ended).toBe(1);
    expect(app.ctx.hub.connected(userId)).toBe(0);
  });

  it('limits push tests per account', async () => {
    const paul = await person(app, 'Paul');
    const subscription = {
      endpoint: 'https://push.example.org/abc',
      keys: { p256dh: `B${'A'.repeat(86)}`, auth: 'A'.repeat(22) },
    };
    expect((await paul.agent.json('PUT', '/api/push/subscription', subscription)).status).toBe(200);
    const statuses: number[] = [];
    for (let i = 0; i < SECURITY.PUSH_CHANGES_PER_HOUR; i++) {
      statuses.push((await paul.agent.json('POST', '/api/push/test', {})).status);
    }
    expect(statuses.filter((s) => s === 200)).toHaveLength(SECURITY.PUSH_CHANGES_PER_HOUR - 1);
    expect(statuses.at(-1)).toBe(429);
  });

  it('merges identical error log entries within an hour and counts them', async () => {
    const entry = {
      component: 'Push',
      severity: 'warning' as const,
      what: 'Eine Push-Benachrichtigung konnte nicht zugestellt werden.',
      cause: 'Der Push-Dienst antwortete mit Status 500.',
      action: 'Meist vorübergehend.',
    };
    const t0 = app.clock.now;
    logError(app.db, entry, t0);
    app.db.run('UPDATE error_log SET read = 1');
    logError(app.db, entry, t0 + 30 * TIME.MINUTE);
    logError(app.db, entry, t0 + 80 * TIME.MINUTE);
    logError(app.db, { ...entry, cause: 'Status 502.' }, t0 + 81 * TIME.MINUTE);
    expect(app.db.all('SELECT count, at, last_at, read, cause FROM error_log ORDER BY id')).toEqual(
      [
        { count: 3, at: t0, last_at: t0 + 80 * TIME.MINUTE, read: 0, cause: entry.cause },
        {
          count: 1,
          at: t0 + 81 * TIME.MINUTE,
          last_at: t0 + 81 * TIME.MINUTE,
          read: 0,
          cause: 'Status 502.',
        },
      ],
    );
    // After 2 hours without recurrence a new entry starts.
    logError(app.db, entry, t0 + 200 * TIME.MINUTE);
    expect(errorCount()).toBe(3);
    // Kept 30 days after the last occurrence: the first entry began more than 30 days ago,
    // but last occurred within them.
    const later = t0 + 30 * TIME.DAY + 50 * TIME.MINUTE;
    logError(app.db, { ...entry, what: 'anderes' }, later);
    expect(errorCount()).toBe(4);

    // The admin panel gets count and last time.
    const admin = new Agent(app.adminApi, ADMIN_ORIGIN);
    const initial = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
    const start = client.startLogin(initial);
    const first = await admin.json<{ attemptId: string; loginResponse: string }>(
      'POST',
      '/api/login/start',
      { startLoginRequest: start.request },
    );
    const done = client.finishLogin(initial, start.state, first.body.loginResponse)!;
    await admin.json('POST', '/api/login/finish', {
      attemptId: first.body.attemptId,
      finishLoginRequest: done.finishRequest,
    });
    app.db.run('UPDATE admin SET must_change_password = 0');
    const list = await admin.json<{ entries: { count: number; lastAt: number }[] }>(
      'GET',
      '/api/errors',
    );
    expect(list.body.entries.map((e) => e.count)).toEqual([1, 1, 1, 3]);
    expect(list.body.entries[0]!.lastAt).toBe(later);
    expect(list.body.entries[3]!.lastAt).toBe(t0 + 80 * TIME.MINUTE);
  });

  it('removes expired sessions in the daily clean-up', async () => {
    const paul = await person(app, 'Paul');
    const old = app.clock.now - 31 * TIME.DAY;
    app.db.run(
      "INSERT INTO sessions (token_hash, user_id, created_at, last_used_at) VALUES (x'00', ?, ?, ?)",
      paul.id,
      old,
      old,
    );
    app.db.run(
      "INSERT INTO admin_sessions (token_hash, created_at, last_used_at) VALUES (x'01', ?, ?)",
      app.clock.now - 9 * TIME.HOUR,
      app.clock.now - 9 * TIME.HOUR,
    );
    const at = Date.parse(`${utcDay(app.clock.now + TIME.DAY)}T04:00:00Z`);
    app.db.run("DELETE FROM scheduled_events WHERE type = 'daily:inactivity'");
    app.ctx.queue.schedule('daily:inactivity', 'inactivity', at);
    app.clock.now = at;
    app.ctx.queue.runDue();
    expect(app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM sessions')?.n).toBe(1);
    expect(app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM admin_sessions')?.n).toBe(0);
    // Paul's current session still works.
    expect((await paul.agent.json('GET', '/api/sync')).status).toBe(200);
  });
});
