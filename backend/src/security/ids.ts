import crypto from 'node:crypto';

/** Random external ID, 128 bits, base64url (SPEC 5.2, 6). */
export function randomId(): string {
  return crypto.randomBytes(16).toString('base64url');
}

/** Random secret token, 256 bits (sessions, SPEC 5.5). */
export function randomToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function sha256(value: string): Buffer {
  return crypto.createHash('sha256').update(value).digest();
}

export function hmac(key: Uint8Array, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value).digest();
}

export function isId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value);
}

/** UTC day 'YYYY-MM-DD' (SPEC 0: all days are UTC days). */
export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
