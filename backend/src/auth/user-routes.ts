/**
 * Registration, login, logout, re-authentication and password change (SPEC 5.2–5.6, 5.10).
 * The server never sees the password or any unencrypted private key.
 */
import * as opaque from '@serenity-kit/opaque';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ACCOUNT, GOLD, TIME } from '@posteulen/shared/constants.ts';
import { fromBase64Url, toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { isLand, roundHome } from '@posteulen/shared/map/landmask.ts';
import { checkUserName, normalizeName } from '@posteulen/shared/names.ts';
import {
  LoginFinish,
  LoginStart,
  PasswordFinish,
  PasswordStart,
  ReauthStart,
  RegisterFinish,
  RegisterStart,
  type LoginStartResponse,
} from '@posteulen/shared/schemas/auth.ts';
import type { Context } from '../context.ts';
import { HttpError, parse } from '../http/errors.ts';
import { hmac, randomId, utcDay } from '../security/ids.ts';
import { addSystemMessage } from '../messages/system.ts';
import { cancelDeletion } from '../accounts/lifecycle.ts';
import { createBots } from '../bots/service.ts';
import { ipKey } from '../security/ip.ts';
import { getRegistrationMode, inviteHmac, findValidInvite } from '../admin/settings.ts';
import {
  clearSessionCookie,
  cookieSpec,
  createUserSession,
  requireUser,
  resolveSession,
  setSessionCookie,
  userOf,
} from './sessions.ts';

const ATTEMPT_TTL = TIME.MINUTE;

function limit(
  ctx: Context,
  limiter: 'general' | 'expensive' | 'registration',
  request: FastifyRequest,
): string {
  const ip = ipKey(request.ip);
  const wait = ctx.limits[limiter].hit(ip, ctx.now());
  if (wait > 0)
    throw new HttpError(429, 'rate_limited', { retryAfterSeconds: Math.ceil(wait / 1000) });
  return ip;
}

/** Deterministic credential ID for unknown names, in the format of real user IDs (SPEC 5.3). */
export function fakeCredentialId(ctx: Context, nameKey: string): string {
  return hmac(ctx.keys.fakeCredential, nameKey).subarray(0, 16).toString('base64url');
}

export function nameLocked(ctx: Context, nameKey: string, now: number): boolean {
  const row = ctx.db.get(
    'SELECT 1 FROM name_locks WHERE hmac = ? AND expires_on >= ?',
    hmac(ctx.keys.nameLock, nameKey),
    utcDay(now),
  );
  return row !== undefined;
}

interface Throttle {
  readonly status: 'wait' | 'captcha_required';
  readonly retryAfterSeconds?: number;
}

/** Same rules for every name, known or not (SPEC 5.10). */
async function loginThrottle(
  ctx: Context,
  keys: { name: string; ip: string; admin?: boolean },
  altcha: Parameters<Context['altcha']['verify']>[0] | undefined,
): Promise<Throttle | null> {
  const now = ctx.now();
  const nameGuard = keys.admin ? ctx.guards.admin : ctx.guards.names;
  const wait = Math.max(nameGuard.waitMs(keys.name, now), ctx.guards.ips.waitMs(keys.ip, now));
  if (wait > 0) return { status: 'wait', retryAfterSeconds: Math.ceil(wait / 1000) };
  const needsCaptcha =
    nameGuard.captchaRequired(keys.name, now) || ctx.guards.ips.captchaRequired(keys.ip, now);
  if (needsCaptcha && !(altcha && (await ctx.altcha.verify(altcha, now)))) {
    return { status: 'captcha_required' };
  }
  return null;
}

export { loginThrottle };

export function registerUserRoutes(app: FastifyInstance, ctx: Context): void {
  const spec = cookieSpec(ctx.config.userOrigin, 'pe_session');
  const authenticated = requireUser(ctx, spec);

  app.get('/api/registration', async (request) => {
    limit(ctx, 'general', request);
    return { mode: getRegistrationMode(ctx.db) };
  });

  app.get('/api/altcha/challenge', async (request) => {
    limit(ctx, 'expensive', request);
    return ctx.altcha.create(ctx.now());
  });

  // ── Registrierung (SPEC 5.2) ──
  app.post('/api/register/start', async (request) => {
    limit(ctx, 'registration', request);
    const body = parse(RegisterStart, request.body);
    const now = ctx.now();
    const mode = getRegistrationMode(ctx.db);
    if (mode === 'closed') throw new HttpError(403, 'registration_closed');
    let invite: Buffer | null = null;
    if (mode === 'invite') {
      if (!body.inviteCode) throw new HttpError(403, 'invite_invalid');
      invite = inviteHmac(ctx, body.inviteCode);
      if (!findValidInvite(ctx, invite, now)) throw new HttpError(403, 'invite_invalid');
    }
    if (!(await ctx.altcha.verify(body.altcha, now))) throw new HttpError(400, 'captcha_invalid');
    const name = checkUserName(body.name);
    if (typeof name === 'string') throw new HttpError(400, `name_${name}`);
    const taken =
      ctx.db.get('SELECT 1 FROM users WHERE name_key = ?', name.key) !== undefined ||
      nameLocked(ctx, name.key, now) ||
      ctx.reservations.values(now).some((r) => r.key === name.key);
    if (taken) throw new HttpError(409, 'name_unavailable');

    const userId = randomId();
    const reservationId = randomId();
    ctx.reservations.set(
      reservationId,
      { userId, display: name.display, key: name.key, inviteHmac: invite },
      ACCOUNT.REGISTRATION_RESERVATION_MINUTES * TIME.MINUTE,
      now,
    );
    const { registrationResponse } = opaque.server.createRegistrationResponse({
      serverSetup: ctx.secrets.opaqueServerSetup,
      userIdentifier: userId,
      registrationRequest: body.registrationRequest,
    });
    return { reservationId, userId, registrationResponse };
  });

  app.post('/api/register/finish', async (request, reply) => {
    limit(ctx, 'expensive', request);
    const body = parse(RegisterFinish, request.body);
    const now = ctx.now();
    const reservation = ctx.reservations.get(body.reservationId, now);
    if (!reservation) throw new HttpError(410, 'reservation_expired');
    const { latE2, lonE2 } = roundHome(body.home.lat, body.home.lon);
    if (!isLand(ctx.landMask, latE2 / 100, lonE2 / 100)) throw new HttpError(400, 'home_invalid');

    const today = utcDay(now);
    const token = ctx.db.transaction(() => {
      if (ctx.db.get('SELECT 1 FROM users WHERE name_key = ?', reservation.key)) {
        throw new HttpError(409, 'name_unavailable');
      }
      if (reservation.inviteHmac) {
        const used = ctx.db.run(
          'DELETE FROM invite_codes WHERE hmac = ? AND expires_at > ?',
          reservation.inviteHmac,
          now,
        );
        if (used.changes !== 1) throw new HttpError(403, 'invite_invalid');
      } else if (getRegistrationMode(ctx.db) !== 'open') {
        throw new HttpError(403, 'registration_closed');
      }
      ctx.db.run(
        `INSERT INTO users (id, name_display, name_key, created_on, opaque_record, ed25519_pub, x25519_pub,
                            key_format, wrapped_master_key, private_keys, home_lat, home_lon,
                            home_changed_on, gold, last_active_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        reservation.userId,
        reservation.display,
        reservation.key,
        today,
        body.registrationRecord,
        fromBase64Url(body.ed25519Public),
        fromBase64Url(body.x25519Public),
        body.keyPackage.format,
        fromBase64Url(body.keyPackage.wrappedMasterKey),
        fromBase64Url(body.keyPackage.privateKeys),
        latE2,
        lonE2,
        today,
        GOLD.START,
        today,
      );
      ctx.db.run(
        "UPDATE stats_counters SET value = value + 1 WHERE key = 'accounts_created_total'",
      );
      // Three own bots, the Erklärbär's first letter already in the box (SPEC 10, D-50).
      createBots(ctx, reservation.userId, now);
      // Automatic login: the session is created in the same transaction (SPEC 5.2 step 6).
      return createUserSession(ctx.db, reservation.userId, now);
    });
    ctx.reservations.delete(body.reservationId);
    setSessionCookie(reply, spec, token);
    return { userId: reservation.userId, profile: profileOf(ctx, reservation.userId) };
  });

  // ── Anmeldung (SPEC 5.3) ──
  app.post('/api/login/start', async (request): Promise<LoginStartResponse> => {
    const ip = limit(ctx, 'expensive', request);
    const body = parse(LoginStart, request.body);
    const nameKey = normalizeName(body.name);
    const throttle = await loginThrottle(ctx, { name: nameKey, ip }, body.altcha);
    if (throttle) return throttle as LoginStartResponse;
    const now = ctx.now();
    const user = ctx.db.get<{ id: string; opaque_record: string }>(
      "SELECT id, opaque_record FROM users WHERE name_key = ? AND state != 'deleting'",
      nameKey,
    );
    const { serverLoginState, loginResponse } = opaque.server.startLogin({
      serverSetup: ctx.secrets.opaqueServerSetup,
      userIdentifier: user?.id ?? fakeCredentialId(ctx, nameKey),
      registrationRecord: user?.opaque_record ?? null,
      startLoginRequest: body.startLoginRequest,
    });
    // Counted as a failure until the login is completed (D-19).
    ctx.guards.names.fail(nameKey, now);
    ctx.guards.ips.fail(ip, now);
    const attemptId = randomId();
    ctx.attempts.set(
      attemptId,
      { kind: 'user', userId: user?.id ?? null, nameKey, ipKey: ip, serverLoginState },
      ATTEMPT_TTL,
      now,
    );
    return { status: 'ok', attemptId, loginResponse };
  });

  app.post('/api/login/finish', async (request, reply) => {
    limit(ctx, 'expensive', request);
    const body = parse(LoginFinish, request.body);
    const now = ctx.now();
    const attempt = ctx.attempts.take(body.attemptId, now);
    if (!attempt || attempt.kind !== 'user') throw new HttpError(401, 'login_failed');
    try {
      opaque.server.finishLogin({
        serverLoginState: attempt.serverLoginState,
        finishLoginRequest: body.finishLoginRequest,
      });
    } catch {
      throw new HttpError(401, 'login_failed');
    }
    if (attempt.userId === null) throw new HttpError(401, 'login_failed');
    const userId = attempt.userId;
    ctx.guards.names.reset(attempt.nameKey);
    const result = ctx.db.transaction(() => {
      const user = ctx.db.get<{ state: string }>('SELECT state FROM users WHERE id = ?', userId);
      if (!user || user.state === 'deleting') throw new HttpError(401, 'login_failed');
      // Only one session: a login ends all others, including their push subscription (SPEC 5.3).
      ctx.db.run('DELETE FROM sessions WHERE user_id = ?', userId);
      ctx.db.run('DELETE FROM push_subscriptions WHERE user_id = ?', userId);
      const deletionCancelled = user.state === 'deletion_pending';
      if (deletionCancelled) {
        ctx.db.run(
          "UPDATE users SET state = 'active', deletion_requested_at = NULL WHERE id = ?",
          userId,
        );
        cancelDeletion(ctx, userId, now, (work) => work());
      }
      ctx.db.run(
        'UPDATE users SET last_active_date = ?, inactivity_warned_on = NULL WHERE id = ?',
        utcDay(now),
        userId,
      );
      return { token: createUserSession(ctx.db, userId, now), deletionCancelled };
    });
    ctx.hub.close(userId);
    setSessionCookie(reply, spec, result.token);
    return {
      userId,
      deletionCancelled: result.deletionCancelled,
      ...keyMaterial(ctx, userId),
      profile: profileOf(ctx, userId),
    };
  });

  app.post('/api/logout', { preHandler: authenticated }, async (request, reply) => {
    const user = userOf(request);
    // Logout ends the session and the push subscription of this device (SPEC 11.3).
    ctx.db.run('DELETE FROM sessions WHERE token_hash = ?', user.tokenHash);
    ctx.db.run('DELETE FROM push_subscriptions WHERE user_id = ?', user.id);
    ctx.hub.close(user.id);
    clearSessionCookie(reply, spec);
    return { ok: true };
  });

  // App start: never answers 401, so a missing session is not an error (SPEC 5.5).
  app.get('/api/session', async (request) => {
    limit(ctx, 'general', request);
    const session = resolveSession(ctx, spec, request);
    if ('reason' in session) {
      return { state: session.reason === 'session_expired' ? 'expired' : 'none' };
    }
    return { state: 'active', profile: profileOf(ctx, session.id) };
  });

  app.get('/api/sync', { preHandler: authenticated }, async (request) => {
    return { profile: profileOf(ctx, userOf(request).id) };
  });

  // ── Erneute Anmeldung vor kritischen Aktionen (SPEC 5.6) ──
  app.post(
    '/api/reauth/start',
    { preHandler: authenticated },
    async (request): Promise<LoginStartResponse> => {
      const ip = limit(ctx, 'expensive', request);
      const body = parse(ReauthStart, request.body);
      const userId = userOf(request).id;
      const user = ctx.db.get<{ name_key: string; opaque_record: string }>(
        'SELECT name_key, opaque_record FROM users WHERE id = ?',
        userId,
      );
      if (!user) throw new HttpError(401, 'unauthorized', { reason: 'no_session' });
      const throttle = await loginThrottle(ctx, { name: user.name_key, ip }, body.altcha);
      if (throttle) return throttle as LoginStartResponse;
      const now = ctx.now();
      const { serverLoginState, loginResponse } = opaque.server.startLogin({
        serverSetup: ctx.secrets.opaqueServerSetup,
        userIdentifier: userId,
        registrationRecord: user.opaque_record,
        startLoginRequest: body.startLoginRequest,
      });
      ctx.guards.names.fail(user.name_key, now);
      ctx.guards.ips.fail(ip, now);
      const attemptId = randomId();
      ctx.attempts.set(
        attemptId,
        {
          kind: 'reauth',
          userId,
          nameKey: user.name_key,
          ipKey: ip,
          serverLoginState,
          purpose: body.purpose,
        },
        ATTEMPT_TTL,
        now,
      );
      return { status: 'ok', attemptId, loginResponse };
    },
  );

  app.post('/api/reauth/finish', { preHandler: authenticated }, async (request) => {
    limit(ctx, 'expensive', request);
    const body = parse(LoginFinish, request.body);
    const now = ctx.now();
    const attempt = ctx.attempts.take(body.attemptId, now);
    if (!attempt || attempt.kind !== 'reauth' || attempt.userId !== userOf(request).id) {
      throw new HttpError(401, 'login_failed');
    }
    try {
      opaque.server.finishLogin({
        serverLoginState: attempt.serverLoginState,
        finishLoginRequest: body.finishLoginRequest,
      });
    } catch {
      throw new HttpError(401, 'login_failed');
    }
    ctx.guards.names.reset(attempt.nameKey);
    const token = randomId();
    ctx.reauthTokens.set(
      token,
      { subject: attempt.userId, purpose: attempt.purpose ?? '' },
      ACCOUNT.REAUTH_TOKEN_MINUTES * TIME.MINUTE,
      now,
    );
    return { token, ...keyMaterial(ctx, attempt.userId) };
  });

  // ── Passwortwechsel (SPEC 5.6) ──
  app.post('/api/password/start', { preHandler: authenticated }, async (request) => {
    limit(ctx, 'expensive', request);
    const body = parse(PasswordStart, request.body);
    const userId = userOf(request).id;
    const token = ctx.reauthTokens.get(body.token, ctx.now());
    if (!token || token.subject !== userId || token.purpose !== 'password') {
      throw new HttpError(403, 'reauth_required');
    }
    const { registrationResponse } = opaque.server.createRegistrationResponse({
      serverSetup: ctx.secrets.opaqueServerSetup,
      userIdentifier: userId,
      registrationRequest: body.registrationRequest,
    });
    return { registrationResponse };
  });

  app.post('/api/password/finish', { preHandler: authenticated }, async (request, reply) => {
    limit(ctx, 'expensive', request);
    const body = parse(PasswordFinish, request.body);
    const userId = userOf(request).id;
    const now = ctx.now();
    const token = ctx.reauthTokens.take(body.token, now);
    if (!token || token.subject !== userId || token.purpose !== 'password') {
      throw new HttpError(403, 'reauth_required');
    }
    // Record and key package are replaced together, or not at all (SPEC 5.6 step 3).
    const session = ctx.db.transaction(() => {
      const updated = ctx.db.run(
        `UPDATE users SET opaque_record = ?, key_format = ?, wrapped_master_key = ?, private_keys = ?
          WHERE id = ? AND private_keys = ?`,
        body.registrationRecord,
        body.keyPackage.format,
        fromBase64Url(body.keyPackage.wrappedMasterKey),
        fromBase64Url(body.keyPackage.privateKeys),
        userId,
        fromBase64Url(body.keyPackage.privateKeys),
      );
      // The private keys must stay unchanged (SPEC 5.6 step 5).
      if (updated.changes !== 1) throw new HttpError(400, 'bad_request');
      ctx.db.run('DELETE FROM sessions WHERE user_id = ?', userId);
      addSystemMessage(ctx, userId, 'password_changed', {}, now);
      return createUserSession(ctx.db, userId, now);
    });
    setSessionCookie(reply, spec, session);
    return { ok: true };
  });
}

function keyMaterial(ctx: Context, userId: string) {
  const row = ctx.db.get<{
    ed25519_pub: Uint8Array;
    x25519_pub: Uint8Array;
    key_format: number;
    wrapped_master_key: Uint8Array;
    private_keys: Uint8Array;
  }>(
    'SELECT ed25519_pub, x25519_pub, key_format, wrapped_master_key, private_keys FROM users WHERE id = ?',
    userId,
  );
  if (!row) throw new HttpError(401, 'login_failed');
  return {
    ed25519Public: toBase64Url(row.ed25519_pub),
    x25519Public: toBase64Url(row.x25519_pub),
    keyPackage: {
      format: row.key_format,
      wrappedMasterKey: toBase64Url(row.wrapped_master_key),
      privateKeys: toBase64Url(row.private_keys),
    },
  };
}

export function profileOf(ctx: Context, userId: string) {
  const row = ctx.db.get<{
    name_display: string;
    gold: number;
    home_lat: number;
    home_lon: number;
    created_on: string;
    home_changed_on: string;
    name_changed_year: number | null;
  }>(
    'SELECT name_display, gold, home_lat, home_lon, created_on, home_changed_on, name_changed_year FROM users WHERE id = ?',
    userId,
  );
  if (!row) throw new HttpError(401, 'unauthorized', { reason: 'no_session' });
  return {
    id: userId,
    name: row.name_display,
    gold: row.gold,
    home: { lat: row.home_lat / 100, lon: row.home_lon / 100 },
    createdOn: row.created_on,
    // Name: once per calendar year (7.4); home: every 21 days (7.3).
    nameChangedYear: row.name_changed_year,
    homeChangeFrom: utcDay(
      Date.parse(`${row.home_changed_on}T00:00:00Z`) + ACCOUNT.HOME_CHANGE_MIN_DAYS * TIME.DAY,
    ),
  };
}
