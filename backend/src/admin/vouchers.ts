/**
 * v0.7: vouchers for gold or an owl (SPEC 13, 8.10). The admin creates them; each can be
 * redeemed once within 90 days in the settings. Codes are stored only as HMAC (like invitation
 * codes) with the last four characters for the list; who redeemed one is not stored.
 */
import crypto from 'node:crypto';
import { TIME, VOUCHER } from '@posteulen/shared/constants.ts';
import { startEnergy } from '@posteulen/shared/game/energy.ts';
import { randomSex, speciesById } from '@posteulen/shared/game/owls.ts';
import { SPECIES } from '@posteulen/shared/species.ts';
import type { Context } from '../context.ts';
import { HttpError } from '../http/errors.ts';
import { hmac, randomId, utcDay } from '../security/ids.ts';
import { credit } from '../gold/ledger.ts';

/** Easy to type: no 0/O, 1/I/L (as invitation codes). 12 characters ≈ 59 bits. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function voucherHmac(ctx: Context, code: string): Buffer {
  return hmac(ctx.keys.voucher, code.toUpperCase().replace(/[\s-]/g, ''));
}

export type VoucherContent = { kind: 'gold'; gold: number } | { kind: 'owl'; species: string };

export function createVoucher(
  ctx: Context,
  content: VoucherContent,
  now: number,
): { id: string; code: string; expiresAt: number } {
  let raw = '';
  while (raw.length < 12) raw += ALPHABET[crypto.randomInt(ALPHABET.length)];
  const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  const id = randomId();
  const expiresAt = now + VOUCHER.VALID_DAYS * TIME.DAY;
  ctx.db.run(
    `INSERT INTO vouchers (id, hmac, hint, kind, gold, species, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    voucherHmac(ctx, code),
    raw.slice(8, 12),
    content.kind,
    content.kind === 'gold' ? content.gold : null,
    content.kind === 'owl' ? content.species : null,
    now,
    expiresAt,
  );
  return { id, code, expiresAt };
}

/** Open and redeemed vouchers that have not expired yet (expired ones are removed). */
export function listVouchers(ctx: Context, now: number) {
  ctx.db.run('DELETE FROM vouchers WHERE expires_at <= ?', now);
  return ctx.db
    .all<{
      id: string;
      hint: string;
      kind: 'gold' | 'owl';
      gold: number | null;
      species: string | null;
      created_at: number;
      expires_at: number;
      redeemed: number;
    }>('SELECT * FROM vouchers ORDER BY created_at DESC')
    .map((row) => ({
      id: row.id,
      hint: row.hint,
      kind: row.kind,
      gold: row.gold,
      species: row.species,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      redeemed: row.redeemed === 1,
    }));
}

/**
 * Redeems a code for a user (inside the caller's transaction): gold is credited at once, an owl
 * moves in at once (unnamed, like a bought one; it may exceed the owl limit like a gift).
 */
export function redeemVoucher(
  ctx: Context,
  userId: string,
  code: string,
  now: number,
): { kind: 'gold'; amount: number } | { kind: 'owl'; species: string } {
  const row = ctx.db.get<{
    id: string;
    kind: 'gold' | 'owl';
    gold: number | null;
    species: string | null;
  }>(
    'SELECT id, kind, gold, species FROM vouchers WHERE hmac = ? AND expires_at > ? AND redeemed = 0',
    voucherHmac(ctx, code),
    now,
  );
  if (!row) throw new HttpError(400, 'voucher_invalid');
  const used = ctx.db.run('UPDATE vouchers SET redeemed = 1 WHERE id = ? AND redeemed = 0', row.id);
  if (used.changes !== 1) throw new HttpError(400, 'voucher_invalid');
  if (row.kind === 'gold') {
    const amount = row.gold ?? 0;
    credit(ctx.db, userId, 'voucher', amount, now);
    return { kind: 'gold', amount };
  }
  const pool = SPECIES.filter((species) => !species.mythical);
  const species =
    row.species === 'random' || row.species === null
      ? (pool[Math.min(pool.length - 1, Math.floor(ctx.random() * pool.length))] ?? pool[0])
      : speciesById(row.species);
  if (!species) throw new HttpError(400, 'voucher_invalid');
  ctx.db.run(
    `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at)
     VALUES (?, ?, 'own', ?, ?, NULL, ?, ?, ?, ?)`,
    randomId(),
    userId,
    species.id,
    randomSex(ctx.random()),
    startEnergy(species, ctx.random()),
    now,
    utcDay(now),
    now,
  );
  return { kind: 'owl', species: species.id };
}
