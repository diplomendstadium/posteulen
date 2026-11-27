/**
 * v1.4.3: the second factor (SPEC 5.11) for players, the admin panel and the bots control centre.
 * Who switches it on gets a TOTP secret (QR code and Base32 text, e.g. for KeePassXC) and, after
 * the first matching code, ten single-use backup codes, shown only once. From then on every
 * login and every re-authentication needs a code of the app or one backup code. A backup code
 * also allows switching the second factor off. Without both, a player stays locked out of the
 * account for good (nobody can reset it); the admin panel and the control centre can be reset by
 * root with `posteulen-cli admin-reset` / `bots-reset`.
 *
 * The secret lies encrypted (XChaCha20-Poly1305, key derived from the secrets file, bound to the
 * subject), the backup codes only as HMAC – a copy of the database alone reveals neither.
 */
import crypto from 'node:crypto';
import { SERVER_CONTEXTS } from '@posteulen/shared/crypto/contexts.ts';
import { TWO_FACTOR, TIME } from '@posteulen/shared/constants.ts';
import { sodium } from '@posteulen/shared/crypto/sodium.ts';
import type { Context } from '../context.ts';
import type { Database } from '../db/database.ts';
import { HttpError } from '../http/errors.ts';
import { deriveServerKey } from '../secrets.ts';
import { base32Encode, matchTotp, otpauthUri } from './totp.ts';

/** Subjects: `user:<id>` for a player, `admin` and `bots` for the two panels. */
export type Subject = `user:${string}` | 'admin' | 'bots';

export const userSubject = (userId: string): Subject => `user:${userId}`;

/** Characters of the backup codes: no 0/O, 1/I/L – easy to copy by hand. */
const BACKUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

interface Row {
  readonly secret: Uint8Array;
  readonly last_step: number;
  readonly backup: string;
}

function row(db: Database, subject: Subject): Row | undefined {
  return db.get<Row>('SELECT secret, last_step, backup FROM two_factor WHERE subject = ?', subject);
}

export function twoFactorActive(db: Database, subject: Subject): boolean {
  return db.get('SELECT 1 FROM two_factor WHERE subject = ?', subject) !== undefined;
}

/** What the settings show: switched on, and how many backup codes are left. */
export function twoFactorStatus(
  db: Database,
  subject: Subject,
): { active: boolean; backupLeft: number } {
  const found = row(db, subject);
  return {
    active: found !== undefined,
    backupLeft: found ? (JSON.parse(found.backup) as string[]).length : 0,
  };
}

const aad = (subject: Subject): Uint8Array => new TextEncoder().encode(`PostEulen/2fa/${subject}`);

async function seal(ctx: Context, subject: Subject, secret: Uint8Array): Promise<Uint8Array> {
  const s = await sodium();
  const key = await deriveServerKey(ctx.secrets, SERVER_CONTEXTS.TWO_FACTOR);
  const nonce = s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const sealed = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    secret,
    aad(subject),
    null,
    nonce,
    key,
  );
  const blob = new Uint8Array(nonce.length + sealed.length);
  blob.set(nonce);
  blob.set(sealed, nonce.length);
  return blob;
}

async function unseal(
  ctx: Context,
  subject: Subject,
  blob: Uint8Array,
): Promise<Uint8Array | null> {
  const s = await sodium();
  const key = await deriveServerKey(ctx.secrets, SERVER_CONTEXTS.TWO_FACTOR);
  const size = s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  try {
    return s.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      blob.subarray(size),
      aad(subject),
      blob.subarray(0, size),
      key,
    );
  } catch {
    return null;
  }
}

/** Backup codes are compared without spaces, dashes and case. */
export function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '');
}

async function backupHash(ctx: Context, code: string): Promise<string> {
  const key = await deriveServerKey(ctx.secrets, SERVER_CONTEXTS.TWO_FACTOR_BACKUP);
  return crypto.createHmac('sha256', key).update(normalizeBackupCode(code)).digest('hex');
}

function newBackupCode(): string {
  let code = '';
  for (let i = 0; i < TWO_FACTOR.BACKUP_CODE_CHARS; i++)
    code += BACKUP_ALPHABET[crypto.randomInt(BACKUP_ALPHABET.length)];
  const half = TWO_FACTOR.BACKUP_CODE_CHARS / 2;
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

/** Step 1: a new secret waits for its first code (nothing is stored yet). */
export function startSetup(
  ctx: Context,
  subject: Subject,
  account: string,
  now: number,
): { secret: string; uri: string } {
  if (twoFactorActive(ctx.db, subject)) throw new HttpError(409, 'two_factor_active');
  const secret = new Uint8Array(crypto.randomBytes(TWO_FACTOR.SECRET_BYTES));
  ctx.twoFactorSetups.set(subject, { secret }, TWO_FACTOR.SETUP_MINUTES * TIME.MINUTE, now);
  const text = base32Encode(secret);
  return { secret: text, uri: otpauthUri(text, account, TWO_FACTOR.ISSUER) };
}

/** Step 2: the first matching code switches it on; the backup codes are returned only now. */
export async function finishSetup(
  ctx: Context,
  subject: Subject,
  userId: string | null,
  code: string,
  now: number,
): Promise<string[]> {
  const pending = ctx.twoFactorSetups.get(subject, now);
  if (!pending) throw new HttpError(409, 'two_factor_setup_expired');
  const step = matchTotp(pending.secret, code.trim(), now, 0);
  if (step === null) throw new HttpError(400, 'two_factor_wrong');
  const codes = Array.from({ length: TWO_FACTOR.BACKUP_CODES }, newBackupCode);
  const hashes = await Promise.all(codes.map((item) => backupHash(ctx, item)));
  const sealed = await seal(ctx, subject, pending.secret);
  const stored = ctx.db.run(
    `INSERT INTO two_factor (subject, user_id, secret, since, last_step, backup) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (subject) DO NOTHING`,
    subject,
    userId,
    sealed,
    now,
    step,
    JSON.stringify(hashes),
  );
  ctx.twoFactorSetups.delete(subject);
  // Two setups at the same time: only the first one counts, the other gets no codes.
  if (stored.changes !== 1) throw new HttpError(409, 'two_factor_active');
  return codes;
}

/**
 * Checks a code of the app (each time step only once) or a backup code (removed after use).
 * Returns which kind matched, or null.
 */
export async function checkSecondFactor(
  ctx: Context,
  subject: Subject,
  code: string,
  now: number,
): Promise<'totp' | 'backup' | null> {
  const found = row(ctx.db, subject);
  if (!found) return null;
  const trimmed = code.trim().replace(/\s/g, '');
  if (/^\d+$/.test(trimmed)) {
    const secret = await unseal(ctx, subject, found.secret);
    if (!secret) return null;
    const step = matchTotp(secret, trimmed, now, found.last_step);
    if (step === null) return null;
    const used = ctx.db.run(
      'UPDATE two_factor SET last_step = ? WHERE subject = ? AND last_step < ?',
      step,
      subject,
      step,
    );
    return used.changes === 1 ? 'totp' : null;
  }
  const hash = await backupHash(ctx, trimmed);
  const list = JSON.parse(found.backup) as string[];
  const index = list.findIndex((item) =>
    crypto.timingSafeEqual(Buffer.from(item, 'hex'), Buffer.from(hash, 'hex')),
  );
  if (index < 0) return null;
  const rest = list.filter((_, i) => i !== index);
  const used = ctx.db.run(
    'UPDATE two_factor SET backup = ? WHERE subject = ? AND backup = ?',
    JSON.stringify(rest),
    subject,
    found.backup,
  );
  return used.changes === 1 ? 'backup' : null;
}

export function disableTwoFactor(db: Database, subject: Subject): void {
  db.run('DELETE FROM two_factor WHERE subject = ?', subject);
}
