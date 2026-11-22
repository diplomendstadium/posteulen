/**
 * v1.3.1: privileged players and the pouch (SPEC 9.1.6, 9.1.7, 13).
 *
 * Privileged players – set by the admin for good or until a point in time – have endless gold:
 * nothing is taken from their balance, which stays underneath as it was and counts again once
 * the privilege ends. They may give gold and owls without the rule of 9.1.5, need no rest of
 * more than 100 gold after a transfer and may own more than 50 owls.
 *
 * The pouch holds owl biscuits and treats a player got from a bot or a voucher. While there are
 * some left, feeding or giving a snack costs nothing and takes one from the pouch.
 */
import { normalizeName } from '@posteulen/shared/names.ts';
import type { Context } from '../context.ts';
import type { Database } from '../db/database.ts';
import { HttpError } from '../http/errors.ts';
import { addSystemMessage } from '../messages/system.ts';
import { debit } from './ledger.ts';

export interface Privilege {
  /** End of the privilege (ms); null: for good. */
  readonly until: number | null;
}

/** The running privilege of a player, or null. */
export function privilegeOf(db: Database, userId: string, now: number): Privilege | null {
  const row = db.get<{ until_at: number | null }>(
    'SELECT until_at FROM privileged_users WHERE user_id = ? AND (until_at IS NULL OR until_at > ?)',
    userId,
    now,
  );
  return row ? { until: row.until_at } : null;
}

export function isPrivileged(db: Database, userId: string, now: number): boolean {
  return privilegeOf(db, userId, now) !== null;
}

/**
 * Takes gold for something bought – nothing for a privileged player. Returns whether gold was
 * actually taken (a transfer of a privileged player is not refunded later).
 */
export function pay(
  db: Database,
  userId: string,
  type: Parameters<typeof debit>[2],
  amount: number,
  at: number,
  counterpartId: string | null = null,
): boolean {
  if (isPrivileged(db, userId, at)) return false;
  debit(db, userId, type, amount, at, counterpartId);
  return true;
}

export type CareGood = 'feed' | 'snack';

const BAG_COLUMN = { feed: 'bag_biscuits', snack: 'bag_treats' } as const;

/**
 * Pays an owl biscuit or a treat: free for a privileged player, from the pouch while it holds
 * some, otherwise with gold (full cover). Returns where it came from.
 */
export function payCare(
  db: Database,
  userId: string,
  kind: CareGood,
  price: number,
  at: number,
): 'free' | 'bag' | 'gold' {
  if (isPrivileged(db, userId, at)) return 'free';
  const column = BAG_COLUMN[kind];
  const taken = db.run(
    `UPDATE users SET ${column} = ${column} - 1 WHERE id = ? AND ${column} > 0`,
    userId,
  );
  if (taken.changes === 1) return 'bag';
  debit(db, userId, kind, price, at);
  return 'gold';
}

export type BagKind = 'biscuits' | 'treats';

/** Puts owl biscuits or treats into the pouch (voucher, gift of a bot). */
export function addToBag(db: Database, userId: string, kind: BagKind, count: number): void {
  if (!Number.isInteger(count) || count <= 0) throw new Error('invalid bag count');
  const column = kind === 'biscuits' ? 'bag_biscuits' : 'bag_treats';
  db.run(`UPDATE users SET ${column} = ${column} + ? WHERE id = ?`, count, userId);
}

export function bagOf(db: Database, userId: string): { biscuits: number; treats: number } {
  const row = db.get<{ bag_biscuits: number; bag_treats: number }>(
    'SELECT bag_biscuits, bag_treats FROM users WHERE id = ?',
    userId,
  );
  return { biscuits: row?.bag_biscuits ?? 0, treats: row?.bag_treats ?? 0 };
}

// ── Adminpanel (SPEC 13) ─────────────────────────────────────────────────────────────────

export interface PrivilegedEntry {
  readonly name: string;
  readonly since: number;
  readonly until: number | null;
}

/** The running privileges, newest first (ended ones are removed). */
export function listPrivileged(ctx: Context, now: number): PrivilegedEntry[] {
  return ctx.db
    .all<{ name_display: string; since_at: number; until_at: number | null }>(
      `SELECT u.name_display, p.since_at, p.until_at
         FROM privileged_users p JOIN users u ON u.id = p.user_id
        WHERE p.until_at IS NULL OR p.until_at > ?
        ORDER BY p.since_at DESC`,
      now,
    )
    .map((row) => ({ name: row.name_display, since: row.since_at, until: row.until_at }));
}

function userByName(ctx: Context, name: string): { id: string; name: string } {
  const row = ctx.db.get<{ id: string; name_display: string }>(
    "SELECT id, name_display FROM users WHERE name_key = ? AND state != 'deleting'",
    normalizeName(name.trim()),
  );
  if (!row) throw new HttpError(404, 'user_not_found');
  return { id: row.id, name: row.name_display };
}

/**
 * Grants the privilege to the player with this name (for good or until `until`); a running
 * one is replaced. The player gets a system message at once (inside the caller's transaction).
 */
export function grantPrivilege(
  ctx: Context,
  name: string,
  until: number | null,
  now: number,
  after: (work: () => void) => void,
): PrivilegedEntry {
  if (until !== null && until <= now) throw new HttpError(400, 'privilege_until');
  const user = userByName(ctx, name);
  ctx.db.run(
    `INSERT INTO privileged_users (user_id, since_at, until_at) VALUES (?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET since_at = excluded.since_at, until_at = excluded.until_at`,
    user.id,
    now,
    until,
  );
  ctx.queue.cancel('privilege_end', user.id);
  if (until !== null) ctx.queue.schedule('privilege_end', user.id, until);
  addSystemMessage(ctx, user.id, 'privilege_granted', until === null ? {} : { until }, now, after);
  after(() => ctx.hub.notify(user.id, 'profile', 'owls'));
  return { name: user.name, since: now, until };
}

/** Takes the privilege back at once (admin) – the player gets a system message. */
export function revokePrivilege(
  ctx: Context,
  name: string,
  now: number,
  after: (work: () => void) => void,
): void {
  const user = userByName(ctx, name);
  const removed = ctx.db.run('DELETE FROM privileged_users WHERE user_id = ?', user.id);
  if (removed.changes !== 1) throw new HttpError(404, 'privilege_not_found');
  ctx.queue.cancel('privilege_end', user.id);
  addSystemMessage(ctx, user.id, 'privilege_ended', {}, now, after);
  after(() => ctx.hub.notify(user.id, 'profile', 'owls'));
}

/** A privilege with an end runs out: the row goes, the player gets a system message. */
export function registerPrivilegeHandlers(ctx: Context): void {
  ctx.queue.on('privilege_end', (event, tools) => {
    const row = ctx.db.get<{ until_at: number | null }>(
      'SELECT until_at FROM privileged_users WHERE user_id = ?',
      event.ref,
    );
    // Granted again for good or for longer meanwhile: nothing to do.
    if (!row || row.until_at === null || row.until_at > event.logicalAt) return;
    ctx.db.run('DELETE FROM privileged_users WHERE user_id = ?', event.ref);
    addSystemMessage(ctx, event.ref, 'privilege_ended', {}, event.logicalAt, tools.after);
    tools.after(() => ctx.hub.notify(event.ref, 'profile', 'owls'));
  });
}
