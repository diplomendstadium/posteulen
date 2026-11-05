/** Registration mode and invite codes (SPEC 13 item 3). Codes are stored only as HMAC. */
import crypto from 'node:crypto';
import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';
import type { Context } from '../context.ts';
import type { Database } from '../db/database.ts';
import { hmac, randomId } from '../security/ids.ts';

export type RegistrationMode = 'closed' | 'invite' | 'open';
const MODES: readonly RegistrationMode[] = ['closed', 'invite', 'open'];

export function getRegistrationMode(db: Database): RegistrationMode {
  const row = db.get<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'registration_mode'",
  );
  return MODES.includes(row?.value as RegistrationMode)
    ? (row?.value as RegistrationMode)
    : 'closed';
}

export function setRegistrationMode(db: Database, mode: RegistrationMode): void {
  db.run(
    "INSERT INTO settings (key, value) VALUES ('registration_mode', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    mode,
  );
}

/** Easy to type: no 0/O, 1/I/L (SPEC 13). 12 characters ≈ 59 bits. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function normalizeInviteCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '');
}

export function inviteHmac(ctx: Context, code: string): Buffer {
  return hmac(ctx.keys.invite, normalizeInviteCode(code));
}

export function findValidInvite(ctx: Context, digest: Buffer, now: number): boolean {
  return (
    ctx.db.get('SELECT 1 FROM invite_codes WHERE hmac = ? AND expires_at > ?', digest, now) !==
    undefined
  );
}

export function createInvite(
  ctx: Context,
  now: number,
): { id: string; code: string; expiresAt: number } {
  let raw = '';
  while (raw.length < 12) raw += ALPHABET[crypto.randomInt(ALPHABET.length)];
  const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  const id = randomId();
  const expiresAt = now + ACCOUNT.INVITE_CODE_VALID_HOURS * TIME.HOUR;
  ctx.db.run(
    'INSERT INTO invite_codes (id, hmac, hint, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    id,
    inviteHmac(ctx, code),
    raw.slice(8, 12),
    now,
    expiresAt,
  );
  return { id, code, expiresAt };
}

export function listInvites(ctx: Context, now: number) {
  ctx.db.run('DELETE FROM invite_codes WHERE expires_at <= ?', now);
  return ctx.db
    .all<{ id: string; hint: string; created_at: number; expires_at: number }>(
      'SELECT id, hint, created_at, expires_at FROM invite_codes ORDER BY created_at DESC',
    )
    .map((row) => ({
      id: row.id,
      hint: row.hint,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));
}
