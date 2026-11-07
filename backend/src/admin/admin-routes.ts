/** Admin API (SPEC 13). Never offers user lists, letters or changes to accounts. */
import * as opaque from '@serenity-kit/opaque';
import * as v from 'valibot';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';
import {
  AdminLoginStart,
  AdminPasswordFinish,
  AdminPasswordStart,
  AdminReauthStart,
  ErrorLogUpdate,
  LoginFinish,
  RegistrationModeUpdate,
  type LoginStartResponse,
} from '@posteulen/shared/schemas/auth.ts';
import { Id } from '@posteulen/shared/schemas/common.ts';
import type { Context } from '../context.ts';
import { HttpError, parse, emptyBody } from '../http/errors.ts';
import { randomId, randomToken, sha256 } from '../security/ids.ts';
import { ipKey } from '../security/ip.ts';
import { loginThrottle } from '../auth/user-routes.ts';
import { checkRegistrationRecord, opaqueStep } from '../auth/opaque-guard.ts';
import { clearSessionCookie, cookieSpec, setSessionCookie } from '../auth/sessions.ts';
import { createInvite, getRegistrationMode, listInvites, setRegistrationMode } from './settings.ts';
import { registerAdminOperations } from './operations.ts';

const ADMIN_KEY = 'admin';
/** Endpoints allowed while the initial password must still be changed (SPEC 13). */
const ALLOWED_BEFORE_CHANGE = new Set([
  '/api/me',
  '/api/logout',
  '/api/reauth/start',
  '/api/reauth/finish',
  '/api/password/start',
  '/api/password/finish',
]);

declare module 'fastify' {
  interface FastifyRequest {
    adminSession?: { tokenHash: Buffer; mustChangePassword: boolean };
  }
}

/** Error log IDs are positive integers in decimal notation (no `1e2`, no signs). */
const ErrorLogId = v.pipe(v.string(), v.regex(/^[1-9][0-9]{0,14}$/));
export function registerAdminRoutes(app: FastifyInstance, ctx: Context): void {
  const spec = cookieSpec(ctx.config.adminOrigin, 'pe_admin');

  // Strict limit for everything on the admin host (SPEC 13).
  app.addHook('onRequest', async (request) => {
    const wait = ctx.limits.admin.hit(ipKey(request.ip), ctx.now());
    if (wait > 0)
      throw new HttpError(429, 'rate_limited', { retryAfterSeconds: Math.ceil(wait / 1000) });
  });

  const sessionOf = (request: FastifyRequest) => {
    if (!request.adminSession) throw new HttpError(401, 'unauthorized');
    return request.adminSession;
  };

  const authenticated = async (request: FastifyRequest): Promise<void> => {
    const token = request.cookies[spec.name];
    if (!token) throw new HttpError(401, 'unauthorized');
    const now = ctx.now();
    const hash = sha256(token);
    const row = ctx.db.get<{ last_used_at: number }>(
      'SELECT last_used_at FROM admin_sessions WHERE token_hash = ?',
      hash,
    );
    if (!row) throw new HttpError(401, 'unauthorized');
    if (now - row.last_used_at > ACCOUNT.ADMIN_SESSION_IDLE_HOURS * TIME.HOUR) {
      ctx.db.run('DELETE FROM admin_sessions WHERE token_hash = ?', hash);
      throw new HttpError(401, 'unauthorized', { reason: 'session_expired' });
    }
    ctx.db.run('UPDATE admin_sessions SET last_used_at = ? WHERE token_hash = ?', now, hash);
    const admin = ctx.db.get<{ must_change_password: number }>(
      'SELECT must_change_password FROM admin WHERE id = 1',
    );
    const mustChangePassword = admin?.must_change_password === 1;
    if (mustChangePassword && !ALLOWED_BEFORE_CHANGE.has(request.routeOptions.url ?? '')) {
      throw new HttpError(403, 'password_change_required');
    }
    request.adminSession = { tokenHash: hash, mustChangePassword };
  };

  function adminRecord(): { credential_id: string; opaque_record: string } {
    const row = ctx.db.get<{ credential_id: string; opaque_record: string }>(
      'SELECT credential_id, opaque_record FROM admin WHERE id = 1',
    );
    if (!row) throw new HttpError(503, 'admin_not_set_up');
    return row;
  }

  app.get('/api/altcha/challenge', async () => ctx.altcha.create(ctx.now()));

  app.post('/api/login/start', async (request): Promise<LoginStartResponse> => {
    const ip = ipKey(request.ip);
    const body = parse(AdminLoginStart, request.body);
    const throttle = await loginThrottle(ctx, { name: ADMIN_KEY, ip, admin: true }, body.altcha);
    if (throttle) return throttle as LoginStartResponse;
    const now = ctx.now();
    const admin = adminRecord();
    ctx.guards.admin.fail(ADMIN_KEY, now);
    ctx.guards.ips.fail(ip, now);
    const { serverLoginState, loginResponse } = opaqueStep(() =>
      opaque.server.startLogin({
        serverSetup: ctx.secrets.opaqueServerSetup,
        userIdentifier: admin.credential_id,
        registrationRecord: admin.opaque_record,
        startLoginRequest: body.startLoginRequest,
      }),
    );
    const attemptId = randomId();
    ctx.attempts.set(
      attemptId,
      { kind: 'admin', userId: null, nameKey: ADMIN_KEY, ipKey: ip, serverLoginState },
      TIME.MINUTE,
      now,
    );
    return { status: 'ok', attemptId, loginResponse };
  });

  app.post('/api/login/finish', async (request, reply) => {
    const body = parse(LoginFinish, request.body);
    const now = ctx.now();
    const attempt = ctx.attempts.take(body.attemptId, now);
    if (!attempt || attempt.kind !== 'admin') throw new HttpError(401, 'login_failed');
    try {
      opaque.server.finishLogin({
        serverLoginState: attempt.serverLoginState,
        finishLoginRequest: body.finishLoginRequest,
      });
    } catch {
      throw new HttpError(401, 'login_failed');
    }
    ctx.guards.admin.reset(ADMIN_KEY);
    ctx.guards.ips.succeed(attempt.ipKey);
    const token = randomToken();
    ctx.db.transaction(() => {
      ctx.db.run(
        'DELETE FROM admin_sessions WHERE last_used_at < ?',
        now - ACCOUNT.ADMIN_SESSION_IDLE_HOURS * TIME.HOUR,
      );
      ctx.db.run(
        'INSERT INTO admin_sessions (token_hash, created_at, last_used_at) VALUES (?, ?, ?)',
        sha256(token),
        now,
        now,
      );
    });
    setSessionCookie(reply, spec, token);
    const admin = ctx.db.get<{ must_change_password: number }>(
      'SELECT must_change_password FROM admin WHERE id = 1',
    );
    return { mustChangePassword: admin?.must_change_password === 1 };
  });

  app.post('/api/logout', { preHandler: [authenticated, emptyBody] }, async (request, reply) => {
    ctx.db.run('DELETE FROM admin_sessions WHERE token_hash = ?', sessionOf(request).tokenHash);
    clearSessionCookie(reply, spec);
    return { ok: true };
  });

  // Start of the admin app: answers without 401 when nobody is logged in.
  app.get('/api/session', async (request) => {
    const token = request.cookies[spec.name];
    if (!token) return { state: 'none' };
    const row = ctx.db.get<{ last_used_at: number }>(
      'SELECT last_used_at FROM admin_sessions WHERE token_hash = ?',
      sha256(token),
    );
    if (!row || ctx.now() - row.last_used_at > ACCOUNT.ADMIN_SESSION_IDLE_HOURS * TIME.HOUR) {
      return { state: 'none' };
    }
    const admin = ctx.db.get<{ must_change_password: number }>(
      'SELECT must_change_password FROM admin WHERE id = 1',
    );
    return { state: 'active', mustChangePassword: admin?.must_change_password === 1 };
  });

  app.get('/api/me', { preHandler: authenticated }, async (request) => ({
    mustChangePassword: sessionOf(request).mustChangePassword,
  }));

  // ── Passwort ändern (Pflicht beim ersten Login, SPEC 13 item 8) ──
  app.post('/api/reauth/start', { preHandler: authenticated }, async (request) => {
    const body = parse(AdminReauthStart, request.body);
    const now = ctx.now();
    const ip = ipKey(request.ip);
    const wait = ctx.guards.admin.waitMs(ADMIN_KEY, now);
    if (wait > 0) return { status: 'wait', retryAfterSeconds: Math.ceil(wait / 1000) };
    const admin = adminRecord();
    ctx.guards.admin.fail(ADMIN_KEY, now);
    const { serverLoginState, loginResponse } = opaqueStep(() =>
      opaque.server.startLogin({
        serverSetup: ctx.secrets.opaqueServerSetup,
        userIdentifier: admin.credential_id,
        registrationRecord: admin.opaque_record,
        startLoginRequest: body.startLoginRequest,
      }),
    );
    const attemptId = randomId();
    ctx.attempts.set(
      attemptId,
      { kind: 'admin-reauth', userId: null, nameKey: ADMIN_KEY, ipKey: ip, serverLoginState },
      TIME.MINUTE,
      now,
    );
    return { status: 'ok', attemptId, loginResponse };
  });

  app.post('/api/reauth/finish', { preHandler: authenticated }, async (request) => {
    const body = parse(LoginFinish, request.body);
    const now = ctx.now();
    const attempt = ctx.attempts.take(body.attemptId, now);
    if (!attempt || attempt.kind !== 'admin-reauth') throw new HttpError(401, 'login_failed');
    try {
      opaque.server.finishLogin({
        serverLoginState: attempt.serverLoginState,
        finishLoginRequest: body.finishLoginRequest,
      });
    } catch {
      throw new HttpError(401, 'login_failed');
    }
    ctx.guards.admin.reset(ADMIN_KEY);
    const token = randomId();
    ctx.reauthTokens.set(
      token,
      { subject: ADMIN_KEY, purpose: 'admin-password' },
      5 * TIME.MINUTE,
      now,
    );
    return { token };
  });

  app.post('/api/password/start', { preHandler: authenticated }, async (request) => {
    const body = parse(AdminPasswordStart, request.body);
    const token = ctx.reauthTokens.get(body.token, ctx.now());
    if (token?.subject !== ADMIN_KEY) throw new HttpError(403, 'reauth_required');
    const { registrationResponse } = opaqueStep(() =>
      opaque.server.createRegistrationResponse({
        serverSetup: ctx.secrets.opaqueServerSetup,
        userIdentifier: adminRecord().credential_id,
        registrationRequest: body.registrationRequest,
      }),
    );
    return { registrationResponse };
  });

  app.post('/api/password/finish', { preHandler: authenticated }, async (request, reply) => {
    const body = parse(AdminPasswordFinish, request.body);
    const now = ctx.now();
    const token = ctx.reauthTokens.get(body.token, now);
    if (token?.subject !== ADMIN_KEY) throw new HttpError(403, 'reauth_required');
    // v0.6.1: a record the server cannot use would lock the admin out.
    checkRegistrationRecord(
      ctx.secrets.opaqueServerSetup,
      adminRecord().credential_id,
      body.registrationRecord,
    );
    ctx.reauthTokens.delete(body.token);
    const session = randomToken();
    ctx.db.transaction(() => {
      ctx.db.run(
        'UPDATE admin SET opaque_record = ?, must_change_password = 0 WHERE id = 1',
        body.registrationRecord,
      );
      ctx.db.run('DELETE FROM admin_sessions');
      ctx.db.run(
        'INSERT INTO admin_sessions (token_hash, created_at, last_used_at) VALUES (?, ?, ?)',
        sha256(session),
        now,
        now,
      );
    });
    setSessionCookie(reply, spec, session);
    return { ok: true };
  });

  registerAdminOperations(app, ctx, authenticated);

  // ── Registrierung und Einladungscodes (SPEC 13 item 3) ──
  app.get('/api/settings/registration', { preHandler: authenticated }, async () => ({
    mode: getRegistrationMode(ctx.db),
  }));

  app.put('/api/settings/registration', { preHandler: authenticated }, async (request) => {
    const body = parse(RegistrationModeUpdate, request.body);
    setRegistrationMode(ctx.db, body.mode);
    return { mode: body.mode };
  });

  app.get('/api/invites', { preHandler: authenticated }, async () => ({
    invites: listInvites(ctx, ctx.now()),
  }));

  app.post('/api/invites', { preHandler: [authenticated, emptyBody] }, async () =>
    createInvite(ctx, ctx.now()),
  );

  app.delete('/api/invites/:id', { preHandler: [authenticated, emptyBody] }, async (request) => {
    const id = parse(Id, (request.params as { id?: unknown }).id);
    const result = ctx.db.run('DELETE FROM invite_codes WHERE id = ?', id);
    if (result.changes !== 1) throw new HttpError(404, 'not_found');
    return { ok: true };
  });

  // ── Fehlerprotokoll (SPEC 13 item 7) ──
  app.get('/api/errors', { preHandler: authenticated }, async () => ({
    entries: ctx.db
      .all<{
        id: number;
        at: number;
        component: string;
        severity: string;
        what: string;
        cause: string;
        action: string;
        read: number;
        count: number;
        last_at: number | null;
      }>(
        `SELECT id, at, component, severity, what, cause, action, read, count, last_at
           FROM error_log ORDER BY COALESCE(last_at, at) DESC LIMIT 500`,
      )
      // v0.6.1: merged entries carry how often and when last (SPEC 13 item 7).
      .map(({ last_at: lastAt, ...row }) => ({
        ...row,
        read: row.read === 1,
        lastAt: lastAt ?? row.at,
      })),
  }));

  app.patch('/api/errors/:id', { preHandler: authenticated }, async (request) => {
    parse(ErrorLogUpdate, request.body);
    const id = Number(parse(ErrorLogId, (request.params as { id?: unknown }).id));
    if (ctx.db.run('UPDATE error_log SET read = 1 WHERE id = ?', id).changes !== 1)
      throw new HttpError(404, 'not_found');
    return { ok: true };
  });

  app.delete('/api/errors/:id', { preHandler: [authenticated, emptyBody] }, async (request) => {
    const id = Number(parse(ErrorLogId, (request.params as { id?: unknown }).id));
    if (ctx.db.run('DELETE FROM error_log WHERE id = ?', id).changes !== 1)
      throw new HttpError(404, 'not_found');
    return { ok: true };
  });
}
