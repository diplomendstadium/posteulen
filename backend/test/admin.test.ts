import { cookieSpec } from '../src/auth/sessions.ts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { TIME } from '@posteulen/shared/constants.ts';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import { logError } from '../src/ops/error-log.ts';
import { listVouchers } from '../src/admin/vouchers.ts';
import {
  ADMIN_ORIGIN,
  Agent,
  login,
  register,
  testApp,
  USER_ORIGIN,
  type TestApp,
} from './auth-helpers.ts';

let app: TestApp;
let admin: Agent;

beforeEach(async () => {
  app = await testApp();
  admin = new Agent(app.adminApi, ADMIN_ORIGIN);
});
afterEach(async () => {
  await app.close();
});

async function adminLogin(agent: Agent, password: string): Promise<number | 'client'> {
  const start = client.startLogin(password);
  const first = await agent.json<{ attemptId: string; loginResponse: string }>(
    'POST',
    '/api/login/start',
    { startLoginRequest: start.request },
  );
  if (first.status !== 200) return first.status;
  const result = client.finishLogin(password, start.state, first.body.loginResponse);
  if (!result) return 'client';
  return (
    await agent.json('POST', '/api/login/finish', {
      attemptId: first.body.attemptId,
      finishLoginRequest: result.finishRequest,
    })
  ).status;
}

async function changePassword(agent: Agent, current: string, next: string): Promise<number> {
  const start = client.startLogin(current);
  const first = await agent.json<{ attemptId: string; loginResponse: string }>(
    'POST',
    '/api/reauth/start',
    { startLoginRequest: start.request },
  );
  const result = client.finishLogin(current, start.state, first.body.loginResponse);
  if (!result) return 0;
  const token = (
    await agent.json<{ token: string }>('POST', '/api/reauth/finish', {
      attemptId: first.body.attemptId,
      finishLoginRequest: result.finishRequest,
    })
  ).body.token;
  const reg = client.startRegistration(next);
  const response = await agent.json<{ registrationResponse: string }>(
    'POST',
    '/api/password/start',
    { token, registrationRequest: reg.request },
  );
  const finish = client.finishRegistration(next, reg.state, response.body.registrationResponse);
  return (
    await agent.json('POST', '/api/password/finish', { token, registrationRecord: finish.record })
  ).status;
}

describe('admin (SPEC 13)', () => {
  it('requires the initial password to be changed before anything else', async () => {
    expect(
      (
        await admin.json('POST', '/api/login/start', {
          startLoginRequest: client.startLogin('x'.repeat(20)).request,
        })
      ).status,
    ).toBe(503);
    const initial = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
    expect(initial).toMatch(/^([A-Za-z2-9]{4}-){5}[A-Za-z2-9]{4}$/);
    expect(await adminLogin(admin, 'falsches Passwort!!')).toBe('client');
    expect(await adminLogin(admin, initial)).toBe(200);
    expect((await admin.json('GET', '/api/me')).body).toEqual({ mustChangePassword: true });
    expect((await admin.json('GET', '/api/settings/registration')).body).toMatchObject({
      code: 'password_change_required',
    });

    expect(await changePassword(admin, initial, 'neues sicheres Adminpasswort')).toBe(200);
    expect((await admin.json('GET', '/api/me')).body).toEqual({ mustChangePassword: false });
    expect((await admin.json('GET', '/api/settings/registration')).body).toEqual({ mode: 'open' });
    expect(await adminLogin(new Agent(app.adminApi, ADMIN_ORIGIN), initial)).toBe('client');
    expect(
      await adminLogin(new Agent(app.adminApi, ADMIN_ORIGIN), 'neues sicheres Adminpasswort'),
    ).toBe(200);
  });

  it('resets the password without touching user data and ends admin sessions', async () => {
    await register(new Agent(app.userApi, USER_ORIGIN), 'Gerda', 'ein sehr langes Passwort');
    const first = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
    await adminLogin(admin, first);
    const second = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
    expect((await admin.json('GET', '/api/me')).status).toBe(401);
    expect(await adminLogin(admin, second)).toBe(200);
    expect(
      (await login(new Agent(app.userApi, USER_ORIGIN), 'Gerda', 'ein sehr langes Passwort'))
        .status,
    ).toBe(200);
  });

  describe('after the first login', () => {
    beforeEach(async () => {
      const initial = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
      await adminLogin(admin, initial);
      await changePassword(admin, initial, 'neues sicheres Adminpasswort');
    });

    it('sets the registration mode', async () => {
      expect(
        (await admin.json('PUT', '/api/settings/registration', { mode: 'invite' })).body,
      ).toEqual({ mode: 'invite' });
      expect(
        (await new Agent(app.userApi, USER_ORIGIN).json('GET', '/api/registration')).body,
      ).toEqual({ mode: 'invite' });
      expect((await admin.json('PUT', '/api/settings/registration', { mode: 'alle' })).status).toBe(
        400,
      );
    });

    it('creates, lists and revokes invite codes stored only as HMAC', async () => {
      const created = await admin.json<{ id: string; code: string; expiresAt: number }>(
        'POST',
        '/api/invites',
        {},
      );
      expect(created.body.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(created.body.expiresAt - app.clock.now).toBe(48 * TIME.HOUR);
      const stored = JSON.stringify(app.db.all('SELECT * FROM invite_codes'));
      expect(stored).not.toContain(created.body.code.replace(/-/g, ''));
      const list = await admin.json<{ invites: { id: string; hint: string }[] }>(
        'GET',
        '/api/invites',
      );
      expect(list.body.invites).toEqual([
        expect.objectContaining({ id: created.body.id, hint: created.body.code.slice(-4) }),
      ]);
      expect((await admin.json('DELETE', `/api/invites/${created.body.id}`)).status).toBe(200);
      expect((await admin.json('DELETE', `/api/invites/${created.body.id}`)).status).toBe(404);
      expect((await admin.json('DELETE', '/api/invites/kaputt')).status).toBe(400);
    });

    it('creates vouchers for gold or an owl, stored only as HMAC, 90 days valid (v0.7)', async () => {
      const gold = await admin.json<{ id: string; code: string; expiresAt: number }>(
        'POST',
        '/api/vouchers',
        { kind: 'gold', gold: 55 },
      );
      expect(gold.status).toBe(200);
      expect(gold.body.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(gold.body.expiresAt - app.clock.now).toBe(90 * TIME.DAY);
      const owl = await admin.json<{ id: string }>('POST', '/api/vouchers', {
        kind: 'owl',
        species: 'phoenix',
      });
      expect(owl.status).toBe(200);
      expect(JSON.stringify(app.db.all('SELECT * FROM vouchers'))).not.toContain(
        gold.body.code.replace(/-/g, ''),
      );
      for (const bad of [
        { kind: 'gold', gold: 0 },
        { kind: 'gold', gold: 1001 },
        { kind: 'gold', gold: 1.5 },
        { kind: 'owl', species: 'drache' },
        { kind: 'gold', gold: 10, species: 'waldkauz' },
      ]) {
        expect((await admin.json('POST', '/api/vouchers', bad)).status).toBe(400);
      }
      const list = await admin.json<{ vouchers: { id: string; hint: string; kind: string }[] }>(
        'GET',
        '/api/vouchers',
      );
      expect(list.body.vouchers).toHaveLength(2);
      expect(list.body.vouchers).toContainEqual(
        expect.objectContaining({ id: gold.body.id, hint: gold.body.code.slice(-4), kind: 'gold' }),
      );
      expect((await admin.json('DELETE', `/api/vouchers/${owl.body.id}`)).status).toBe(200);
      expect((await admin.json('DELETE', `/api/vouchers/${owl.body.id}`)).status).toBe(404);
      // Expired vouchers disappear from the list (the admin session would have expired, too).
      expect(listVouchers(app.ctx, app.clock.now + 90 * TIME.DAY + 1)).toEqual([]);
    });

    it('shows, marks and deletes error log entries; keeps 30 days', async () => {
      logError(
        app.db,
        { component: 'Test', severity: 'warning', what: 'a', cause: 'b', action: 'c' },
        app.clock.now - 31 * TIME.DAY,
      );
      logError(
        app.db,
        { component: 'Test', severity: 'error', what: 'x', cause: 'y', action: 'z' },
        app.clock.now,
      );
      const list = await admin.json<{ entries: { id: number; what: string; read: boolean }[] }>(
        'GET',
        '/api/errors',
      );
      expect(list.body.entries.map((e) => e.what)).toEqual(['x']);
      const id = list.body.entries[0]!.id;
      expect((await admin.json('PATCH', `/api/errors/${id}`, { read: true })).status).toBe(200);
      expect(
        (await admin.json<{ entries: { read: boolean }[] }>('GET', '/api/errors')).body.entries[0]!
          .read,
      ).toBe(true);
      expect((await admin.json('DELETE', `/api/errors/${id}`)).status).toBe(200);
      expect((await admin.json('DELETE', `/api/errors/${id}`)).status).toBe(404);
    });

    it('keeps admin and user sessions apart (SPEC 17.3)', async () => {
      const user = new Agent(app.userApi, USER_ORIGIN);
      await register(user, 'Hanna', 'ein sehr langes Passwort');
      const crossToAdmin = new Agent(app.adminApi, ADMIN_ORIGIN);
      crossToAdmin.cookie = user.cookie;
      expect((await crossToAdmin.json('GET', '/api/me')).status).toBe(401);
      const crossToUser = new Agent(app.userApi, USER_ORIGIN);
      crossToUser.cookie = admin.cookie;
      expect((await crossToUser.json('GET', '/api/sync')).status).toBe(401);
      expect(
        (await new Agent(app.adminApi, USER_ORIGIN).json('GET', '/api/me')).body,
      ).toMatchObject({ code: 'forbidden_origin' });
    });

    it('the admin cookie ends with the browser session (no Max-Age, D-92)', () => {
      expect(cookieSpec('https://admin.posteulen.test', 'pe_admin')).toEqual({
        name: '__Host-pe_admin',
        secure: true,
      });
    });

    it('expires the admin session after 10 minutes without activity (v0.7)', async () => {
      app.clock.now += 9 * TIME.MINUTE;
      expect((await admin.json('GET', '/api/me')).status).toBe(200);
      // Every request counts as activity: 9 more minutes are fine again …
      app.clock.now += 9 * TIME.MINUTE;
      expect((await admin.json('GET', '/api/me')).status).toBe(200);
      expect((await admin.json('GET', '/api/session')).body).toMatchObject({ state: 'active' });
      // … but not 10 minutes and one millisecond without any.
      app.clock.now += 10 * TIME.MINUTE + 1;
      expect((await admin.json('GET', '/api/session')).body).toEqual({ state: 'none' });
      expect((await admin.json('GET', '/api/me')).status).toBe(401);
    });
  });
});
