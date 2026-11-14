/**
 * Sessions (SPEC 5.5, 13): 256-bit random token in an HttpOnly, Secure, SameSite=Strict
 * __Host- cookie; only its SHA-256 hash is stored. Sliding expiry: the user cookie lives as long
 * as the server session (30 days without use) and is renewed with it, so "angemeldet bleiben"
 * survives a browser restart (D-92). The admin cookie ends with the browser session.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';
import type { Context } from '../context.ts';
import type { Database } from '../db/database.ts';
import { HttpError } from '../http/errors.ts';
import { randomToken, sha256, utcDay } from '../security/ids.ts';

export interface CookieSpec {
  readonly name: string;
  readonly secure: boolean;
  /** Lifetime in seconds; undefined = cookie of the browser session. */
  readonly maxAgeSeconds?: number;
  /**
   * v0.9: the cookie for requests through the onion service (SPEC 16.5). The onion site runs on
   * plain http (Tor encrypts the transport), so the cookie there is `pe_session` without `Secure`
   * and without the `__Host-` prefix – not every Tor Browser treats http onion sites as secure.
   */
  readonly tor?: CookieSpec;
}

/** The cookie of a request: over Tor the onion variant (v0.9). */
export function specFor(spec: CookieSpec, request: { readonly viaTor?: boolean }): CookieSpec {
  return request.viaTor === true && spec.tor ? spec.tor : spec;
}

/**
 * __Host- cookies require HTTPS. The local preview runs on http://localhost, where the
 * prefix is not allowed in every browser; there the cookie is called pe_* (never on servers).
 */
export function cookieSpec(
  origin: string,
  base: 'pe_session' | 'pe_admin' | 'pe_bots',
): CookieSpec {
  const secure = origin.startsWith('https://');
  const name = secure ? `__Host-${base}` : base;
  return base === 'pe_session'
    ? { name, secure, maxAgeSeconds: (ACCOUNT.USER_SESSION_IDLE_DAYS * TIME.DAY) / 1000 }
    : { name, secure };
}

/** The session cookie of the player app: clearnet and, if set up, the onion site (v0.9). */
export function userCookieSpec(config: {
  readonly userOrigin: string;
  readonly torOrigin: string | undefined;
}): CookieSpec {
  const spec = cookieSpec(config.userOrigin, 'pe_session');
  return config.torOrigin === undefined
    ? spec
    : { ...spec, tor: cookieSpec(config.torOrigin, 'pe_session') };
}

export function setSessionCookie(reply: FastifyReply, base: CookieSpec, token: string): void {
  const spec = specFor(base, reply.request);
  reply.setCookie(spec.name, token, {
    path: '/',
    httpOnly: true,
    secure: spec.secure,
    sameSite: 'strict',
    ...(spec.maxAgeSeconds === undefined ? {} : { maxAge: spec.maxAgeSeconds }),
  });
}

export function clearSessionCookie(reply: FastifyReply, base: CookieSpec): void {
  const spec = specFor(base, reply.request);
  reply.clearCookie(spec.name, {
    path: '/',
    httpOnly: true,
    secure: spec.secure,
    sameSite: 'strict',
  });
}

/** Creates a session; the caller runs this inside its transaction. */
export function createUserSession(db: Database, userId: string, now: number): string {
  const token = randomToken();
  db.run(
    'INSERT INTO sessions (token_hash, user_id, created_at, last_used_at) VALUES (?, ?, ?, ?)',
    sha256(token),
    userId,
    now,
    now,
  );
  return token;
}

export interface SessionUser {
  readonly id: string;
  readonly nameDisplay: string;
  readonly tokenHash: Buffer;
  /** The sliding expiry moved on with this request: the cookie is renewed as well. */
  readonly renewed: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser?: SessionUser;
  }
}

/** The authenticated user of a request that passed requireUser. */
export function userOf(request: FastifyRequest): SessionUser {
  if (!request.sessionUser) throw new HttpError(401, 'unauthorized', { reason: 'no_session' });
  return request.sessionUser;
}

export type SessionResult = SessionUser | { readonly reason: 'no_session' | 'session_expired' };

/** Looks up the session of a request without throwing (SPEC 5.5). */
export function resolveSession(
  ctx: Context,
  spec: CookieSpec,
  request: FastifyRequest,
  options: { background?: boolean } = {},
): SessionResult {
  const token = request.cookies[specFor(spec, request).name];
  if (!token) return { reason: 'no_session' };
  const now = ctx.now();
  const hash = sha256(token);
  const row = ctx.db.get<{
    user_id: string;
    last_used_at: number;
    name_display: string;
    last_active_date: string;
  }>(
    `SELECT s.user_id, s.last_used_at, u.name_display, u.last_active_date
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND u.state != 'deleting'`,
    hash,
  );
  if (!row) return { reason: 'no_session' };
  if (now - row.last_used_at > ACCOUNT.USER_SESSION_IDLE_DAYS * TIME.DAY) {
    ctx.db.run('DELETE FROM sessions WHERE token_hash = ?', hash);
    return { reason: 'session_expired' };
  }
  const renewed = now - row.last_used_at > TIME.MINUTE;
  if (renewed) {
    ctx.db.run('UPDATE sessions SET last_used_at = ? WHERE token_hash = ?', now, hash);
  }
  // Activity only as a date, and only for requests the user triggered (SPEC 9.10).
  const today = utcDay(now);
  if (!options.background && row.last_active_date !== today) {
    // Any activity ends a running inactivity warning (9.10).
    ctx.db.run(
      'UPDATE users SET last_active_date = ?, inactivity_warned_on = NULL WHERE id = ?',
      today,
      row.user_id,
    );
  }
  return { id: row.user_id, nameDisplay: row.name_display, tokenHash: hash, renewed };
}

/** Resolves the session or answers 401 with a reason the client acts on (SPEC 5.5). */
export function requireUser(
  ctx: Context,
  spec: CookieSpec,
  options: { background?: boolean } = {},
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const session = resolveSession(ctx, spec, request, options);
    if ('reason' in session) throw new HttpError(401, 'unauthorized', { reason: session.reason });
    renewCookie(request, reply, spec, session);
    if (ctx.limits.session.hit(session.id, ctx.now()) > 0) throw new HttpError(429, 'rate_limited');
    request.sessionUser = session;
  };
}

/** Moves the cookie's expiry along with the server session (sliding, SPEC 5.5). */
export function renewCookie(
  request: FastifyRequest,
  reply: FastifyReply,
  spec: CookieSpec,
  session: SessionUser,
): void {
  const token = request.cookies[specFor(spec, request).name];
  if (session.renewed && spec.maxAgeSeconds !== undefined && token) {
    setSessionCookie(reply, spec, token);
  }
}
