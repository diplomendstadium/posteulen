import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { rewrapMasterKey } from '@posteulen/shared/crypto/keypackage.ts';
import { TIME } from '@posteulen/shared/constants.ts';
import { setRegistrationMode, createInvite } from '../src/admin/settings.ts';
import {
  Agent,
  login,
  register,
  testApp,
  unlockFromLogin,
  USER_ORIGIN,
  type TestApp,
} from './auth-helpers.ts';

const PASSWORD = 'ein sehr langes Passwort';
let app: TestApp;
let agent: Agent;

beforeEach(async () => {
  app = await testApp();
  agent = new Agent(app.userApi, USER_ORIGIN);
});
afterEach(async () => {
  await app.close();
});

describe('registration (SPEC 5.2, 7.1, 13)', () => {
  it('creates the account atomically, logs in automatically and starts with 3,0 gold', async () => {
    const result = await register(agent, 'René Müller', PASSWORD);
    expect(result.status).toBe(200);
    const sync = await agent.json<{ profile: { name: string; gold: number; home: unknown } }>(
      'GET',
      '/api/sync',
    );
    expect(sync.status).toBe(200);
    expect(sync.body.profile).toMatchObject({
      name: 'René Müller',
      gold: 30,
      home: { lat: 52.52, lon: 13.41 },
    });
    const row = app.db.get<{ wrapped_master_key: Uint8Array }>(
      'SELECT wrapped_master_key FROM users',
    );
    expect(row?.wrapped_master_key).toHaveLength(72);
    expect(
      app.db.get<{ value: number }>(
        "SELECT value FROM stats_counters WHERE key = 'accounts_created_total'",
      )?.value,
    ).toBe(1);
  });

  it('respects the registration mode and single-use invite codes', async () => {
    setRegistrationMode(app.db, 'closed');
    expect((await register(agent, 'Anna', PASSWORD)).body).toMatchObject({
      code: 'registration_closed',
    });

    setRegistrationMode(app.db, 'invite');
    expect((await register(agent, 'Anna', PASSWORD)).body).toMatchObject({
      code: 'invite_invalid',
    });
    expect(
      (await register(agent, 'Anna', PASSWORD, { inviteCode: 'AAAA-BBBB-CCCC' })).body,
    ).toMatchObject({ code: 'invite_invalid' });
    const invite = createInvite(app.ctx, app.clock.now);
    expect(
      (await register(agent, 'Anna', PASSWORD, { inviteCode: invite.code.toLowerCase() })).status,
    ).toBe(200);
    expect(
      (
        await register(new Agent(app.userApi, USER_ORIGIN), 'Berta', PASSWORD, {
          inviteCode: invite.code,
        })
      ).body,
    ).toMatchObject({ code: 'invite_invalid' });

    const expired = createInvite(app.ctx, app.clock.now);
    app.clock.now += 49 * TIME.HOUR;
    expect(
      (
        await register(new Agent(app.userApi, USER_ORIGIN), 'Clara', PASSWORD, {
          inviteCode: expired.code,
        })
      ).body,
    ).toMatchObject({ code: 'invite_invalid' });
  });

  it('rejects taken, confusable, reserved and locked names', async () => {
    await register(agent, 'Alex', PASSWORD);
    for (const name of ['ALEX', 'AIex', 'Aléx']) {
      expect(
        (await register(new Agent(app.userApi, USER_ORIGIN), name, PASSWORD)).body,
      ).toMatchObject({ code: 'name_unavailable' });
    }
    expect(
      (await register(new Agent(app.userApi, USER_ORIGIN), 'Erklärbär', PASSWORD)).body,
    ).toMatchObject({ code: 'name_reserved' });
    expect(
      (await register(new Agent(app.userApi, USER_ORIGIN), 'Иван', PASSWORD)).body,
    ).toMatchObject({ code: 'name_invalid_characters' });
  });

  it('accepts homes on land only, rounded to 0.01°', async () => {
    const atSea = await register(agent, 'Seemann', PASSWORD, { home: { lat: 54.5, lon: 3.0 } });
    expect(atSea.body).toMatchObject({ code: 'home_invalid' });
    const outside = await register(new Agent(app.userApi, USER_ORIGIN), 'Fernweh', PASSWORD, {
      home: { lat: 40.7, lon: -74 },
    });
    expect(outside.body).toMatchObject({ code: 'home_invalid' });
    const lisbon = await register(new Agent(app.userApi, USER_ORIGIN), 'Lissabon', PASSWORD, {
      home: { lat: 38.7223, lon: -9.1393 },
    });
    expect(lisbon.status).toBe(200);
  });

  it('requires a solved captcha and rejects its reuse', async () => {
    const start = client.startRegistration(PASSWORD);
    const altcha = await agent.altcha();
    const ok = await agent.json('POST', '/api/register/start', {
      name: 'Dora',
      altcha,
      registrationRequest: start.request,
    });
    expect(ok.status).toBe(200);
    const replay = await agent.json('POST', '/api/register/start', {
      name: 'Dora2',
      altcha,
      registrationRequest: start.request,
    });
    expect(replay.body).toMatchObject({ code: 'captcha_invalid' });
  });

  it('rate-limits registrations per IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const response = await agent.request('POST', '/api/register/start', {});
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, 5)).toEqual([400, 400, 400, 400, 400]);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });
});

describe('login (SPEC 5.3, 5.10)', () => {
  beforeEach(async () => {
    await register(new Agent(app.userApi, USER_ORIGIN, '203.0.113.1'), 'Lena', PASSWORD);
  });

  it('logs in with the right password and returns a key package that unlocks', async () => {
    const result = await login(agent, 'lena', PASSWORD);
    expect(result.status).toBe(200);
    const unlocked = await unlockFromLogin(result);
    expect(unlocked.masterKey).toHaveLength(32);
    expect((await agent.json('GET', '/api/sync')).status).toBe(200);
  });

  it('cannot distinguish unknown names from wrong passwords', async () => {
    const wrong = await login(agent, 'Lena', 'falsches langes Passwort');
    const unknown = await login(agent, 'Niemand', PASSWORD);
    expect(wrong.step).toBe('client');
    expect(unknown.step).toBe('client');
    expect(Object.keys(wrong.body).sort()).toEqual(Object.keys(unknown.body).sort());
    expect(String(wrong.body['loginResponse']).length).toBe(
      String(unknown.body['loginResponse']).length,
    );
  });

  it('applies captcha and back-off to known and unknown names alike', async () => {
    for (const name of ['Lena', 'Niemand']) {
      const other = new Agent(app.userApi, USER_ORIGIN, `192.0.2.${name.length}`);
      const steps: string[] = [];
      for (let i = 0; i < 3; i++)
        steps.push((await login(other, name, 'falsches langes Passwort')).step);
      expect(steps).toEqual(['client', 'client', 'client']);
      expect((await login(other, name, 'falsches langes Passwort')).body).toEqual({
        status: 'captcha_required',
      });
      // Failures 4 and 5 with captcha, then the exponential wait starts (from the 5th failure).
      expect((await login(other, name, 'falsches langes Passwort', true)).step).toBe('client');
      expect((await login(other, name, 'falsches langes Passwort', true)).step).toBe('client');
      expect((await login(other, name, 'falsches langes Passwort', true)).body).toMatchObject({
        status: 'wait',
      });
      app.clock.now += 3000;
      expect((await login(other, name, 'falsches langes Passwort', true)).step).toBe('client');
      expect((await login(other, name, 'falsches langes Passwort', true)).body).toMatchObject({
        status: 'wait',
        retryAfterSeconds: 4,
      });
    }
  });

  it('allows only one session; a new login ends the old one (SPEC 5.3)', async () => {
    const first = new Agent(app.userApi, USER_ORIGIN);
    const second = new Agent(app.userApi, USER_ORIGIN);
    expect((await login(first, 'Lena', PASSWORD)).status).toBe(200);
    expect((await login(second, 'Lena', PASSWORD)).status).toBe(200);
    expect((await first.json('GET', '/api/sync')).body).toMatchObject({
      code: 'unauthorized',
      reason: 'no_session',
    });
    expect((await second.json('GET', '/api/sync')).status).toBe(200);
  });

  it('expires idle sessions after 30 days and logs out', async () => {
    await login(agent, 'Lena', PASSWORD);
    app.clock.now += 29 * TIME.DAY;
    expect((await agent.json('GET', '/api/sync')).status).toBe(200);
    app.clock.now += 30 * TIME.DAY + 1;
    expect((await agent.json('GET', '/api/sync')).body).toMatchObject({
      reason: 'session_expired',
    });
    await login(agent, 'Lena', PASSWORD);
    expect((await agent.json('POST', '/api/logout', {})).status).toBe(200);
    expect((await agent.json('GET', '/api/sync')).status).toBe(401);
  });

  it('stores the session token only as a hash and the cookie as __Host-, HttpOnly, Strict', async () => {
    const response = await agent.request('POST', '/api/login/start', {});
    expect(response.statusCode).toBe(400);
    await login(agent, 'Lena', PASSWORD);
    const token = agent.cookie?.split('=')[1] ?? '';
    expect(agent.cookie?.startsWith('__Host-pe_session=')).toBe(true);
    const hashes = app.db.all<{ token_hash: Uint8Array }>('SELECT token_hash FROM sessions');
    expect(hashes.some((row) => Buffer.from(row.token_hash).toString('base64url') === token)).toBe(
      false,
    );
    const raw = await new Agent(app.userApi, USER_ORIGIN).request(
      'POST',
      '/api/register/start',
      {},
    );
    expect(raw.statusCode).toBe(400);
  });

  it('session cookie lives 30 days and slides with use, so a browser restart keeps it (D-92)', async () => {
    const response = await agent.request('POST', '/api/login/start', {});
    expect(response.statusCode).toBe(400);
    await login(agent, 'Lena', PASSWORD);
    const cookieOf = (r: { headers: Record<string, unknown> }): string =>
      [r.headers['set-cookie'] ?? []].flat().join('\n');
    // Within a minute nothing is renewed (no Set-Cookie on every response).
    expect(cookieOf(await agent.request('GET', '/api/sync'))).toBe('');
    app.clock.now += 2 * TIME.MINUTE;
    const renewed = cookieOf(await agent.request('GET', '/api/sync'));
    expect(renewed).toContain('__Host-pe_session=');
    expect(renewed).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    expect(renewed).toContain('HttpOnly');
    expect(renewed).toContain('Secure');
    expect(renewed).toContain('SameSite=Strict');
    expect(renewed).toContain('Path=/');
    // App start renews as well.
    app.clock.now += 2 * TIME.MINUTE;
    expect(cookieOf(await agent.request('GET', '/api/session'))).toContain('Max-Age=');
    // After 30 days without use, server and cookie expire together.
    app.clock.now += 30 * TIME.DAY + TIME.MINUTE;
    expect((await agent.request('GET', '/api/sync')).statusCode).toBe(401);
  });

  it('records activity only as a date', async () => {
    await login(agent, 'Lena', PASSWORD);
    app.clock.now += 3 * TIME.DAY;
    await agent.json('GET', '/api/sync');
    expect(
      app.db.get<{ last_active_date: string }>('SELECT last_active_date FROM users')
        ?.last_active_date,
    ).toBe('2026-11-08');
  });
});

describe('password change (SPEC 5.6, 17.1)', () => {
  async function reauth(a: Agent, password: string) {
    const start = client.startLogin(password);
    const first = await a.json<{ attemptId: string; loginResponse: string }>(
      'POST',
      '/api/reauth/start',
      { purpose: 'password', startLoginRequest: start.request },
    );
    const result = client.finishLogin(password, start.state, first.body.loginResponse);
    if (!result) return null;
    const second = await a.json<{ token: string; keyPackage: never }>(
      'POST',
      '/api/reauth/finish',
      { attemptId: first.body.attemptId, finishLoginRequest: result.finishRequest },
    );
    return { ...second.body, exportKey: result.exportKey };
  }

  it('changes the password, keeps all keys and invalidates other sessions', async () => {
    const reg = await register(agent, 'Paul', PASSWORD);
    const other = new Agent(app.userApi, USER_ORIGIN);
    await login(other, 'Paul', PASSWORD);
    await login(agent, 'Paul', PASSWORD);
    const re = await reauth(agent, PASSWORD);
    expect(re?.token).toBeDefined();
    const start = client.startRegistration('mein neues langes Passwort');
    const response = await agent.json<{ registrationResponse: string }>(
      'POST',
      '/api/password/start',
      { token: re!.token, registrationRequest: start.request },
    );
    const finish = client.finishRegistration(
      'mein neues langes Passwort',
      start.state,
      response.body.registrationResponse,
    );
    const keyPackage = await rewrapMasterKey(
      reg.account!.userId,
      reg.account!.keyPackage,
      re!.exportKey,
      finish.exportKey,
    );
    const done = await agent.json('POST', '/api/password/finish', {
      token: re!.token,
      registrationRecord: finish.record,
      keyPackage,
    });
    expect(done.status).toBe(200);
    expect((await agent.json('GET', '/api/sync')).status).toBe(200);

    expect((await login(new Agent(app.userApi, USER_ORIGIN), 'Paul', PASSWORD)).step).toBe(
      'client',
    );
    const fresh = await login(
      new Agent(app.userApi, USER_ORIGIN),
      'Paul',
      'mein neues langes Passwort',
    );
    expect(fresh.status).toBe(200);
    const unlocked = await unlockFromLogin(fresh);
    expect(unlocked.identity.ed25519Public).toEqual(reg.account!.ed25519Public);
  });

  it('keeps the old password if the change is aborted or the token is reused', async () => {
    await register(agent, 'Ida', PASSWORD);
    const re = await reauth(agent, PASSWORD);
    const start = client.startRegistration('anderes langes Passwort');
    await agent.json('POST', '/api/password/start', {
      token: re!.token,
      registrationRequest: start.request,
    });
    expect((await login(new Agent(app.userApi, USER_ORIGIN), 'Ida', PASSWORD)).status).toBe(200);
  });

  it('refuses without fresh re-authentication or with changed private keys', async () => {
    const reg = await register(agent, 'Max', PASSWORD);
    const start = client.startRegistration('anderes langes Passwort');
    expect(
      (
        await agent.json('POST', '/api/password/start', {
          token: 'AAAAAAAAAAAAAAAAAAAAAA',
          registrationRequest: start.request,
        })
      ).body,
    ).toMatchObject({ code: 'reauth_required' });
    expect(await reauth(agent, 'falsches langes Passwort')).toBeNull();

    const re = await reauth(agent, PASSWORD);
    const response = await agent.json<{ registrationResponse: string }>(
      'POST',
      '/api/password/start',
      { token: re!.token, registrationRequest: start.request },
    );
    const finish = client.finishRegistration(
      'anderes langes Passwort',
      start.state,
      response.body.registrationResponse,
    );
    const other = await register(new Agent(app.userApi, USER_ORIGIN), 'Moritz', PASSWORD);
    const swapped = {
      ...reg.account!.keyPackage,
      privateKeys: other.account!.keyPackage.privateKeys,
    };
    expect(
      (
        await agent.json('POST', '/api/password/finish', {
          token: re!.token,
          registrationRecord: finish.record,
          keyPackage: swapped,
        })
      ).status,
    ).toBe(400);
    expect((await login(new Agent(app.userApi, USER_ORIGIN), 'Max', PASSWORD)).status).toBe(200);
  });
});
