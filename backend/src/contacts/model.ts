/** Contact relations and checks shared by contacts and letters (SPEC 8.8, 9.10). */
import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';
import type { Context } from '../context.ts';
import type { Database } from '../db/database.ts';
import { utcDay } from '../security/ids.ts';
import { addSystemMessage } from '../messages/system.ts';

export function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export interface ContactRow {
  readonly user_lo: string;
  readonly user_hi: string;
  readonly since: number;
  readonly warn_lo: number;
  readonly warn_hi: number;
}

export function findContact(db: Database, a: string, b: string): ContactRow | undefined {
  const [lo, hi] = pair(a, b);
  return db.get<ContactRow>('SELECT * FROM contacts WHERE user_lo = ? AND user_hi = ?', lo, hi);
}

export function hasKeyWarning(row: ContactRow): boolean {
  return row.warn_lo === 1 || row.warn_hi === 1;
}

/** Inactive = last activity more than 21 days ago (SPEC 9.10). */
export function isActiveDate(lastActiveDate: string, now: number): boolean {
  return lastActiveDate >= utcDay(now - ACCOUNT.INACTIVE_AFTER_DAYS * TIME.DAY);
}

export function displayName(db: Database, userId: string): string | null {
  return (
    db.get<{ name_display: string }>('SELECT name_display FROM users WHERE id = ?', userId)
      ?.name_display ?? null
  );
}

/**
 * Checks a human recipient for letters (SPEC 8.4): confirmed contact, active, not being
 * deleted, intact key binding.
 */
export function recipientProblem(
  ctx: Context,
  senderId: string,
  recipientId: string,
  now: number,
): string | null {
  if (senderId === recipientId) return 'recipient_invalid';
  const contact = findContact(ctx.db, senderId, recipientId);
  if (!contact) return 'recipient_invalid';
  if (hasKeyWarning(contact)) return 'key_warning';
  const user = ctx.db.get<{ state: string; last_active_date: string }>(
    'SELECT state, last_active_date FROM users WHERE id = ?',
    recipientId,
  );
  if (!user || user.state === 'deleting') return 'recipient_invalid';
  if (!isActiveDate(user.last_active_date, now)) return 'recipient_inactive';
  return null;
}

/**
 * Ends a contact (SPEC 8.8): both must couple again; letters on the way between them turn
 * back (SPEC 9.5 – with the stage-2 placeholder owl they are simply not delivered).
 */
export function removeContact(
  ctx: Context,
  actorId: string,
  otherId: string,
  now: number,
  after: (work: () => void) => void,
): void {
  const [lo, hi] = pair(actorId, otherId);
  ctx.db.run('DELETE FROM contacts WHERE user_lo = ? AND user_hi = ?', lo, hi);
  const actorName = displayName(ctx.db, actorId) ?? '';
  const otherName = displayName(ctx.db, otherId) ?? '';
  const flying = ctx.db.all<{ id: string; sender_id: string; recipient_id: string }>(
    `SELECT id, sender_id, recipient_id FROM letters
      WHERE status = 'in_flight' AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))`,
    actorId,
    otherId,
    otherId,
    actorId,
  );
  for (const letter of flying) {
    ctx.db.run("UPDATE letters SET status = 'returned', recipient_has = 0 WHERE id = ?", letter.id);
    ctx.queue.cancel('deliver', letter.id);
    addSystemMessage(
      ctx,
      letter.sender_id,
      'letter_returned',
      { name: letter.sender_id === actorId ? otherName : actorName },
      now,
      after,
    );
  }
  ctx.db.run('DELETE FROM letters WHERE sender_has = 0 AND recipient_has = 0');
  addSystemMessage(ctx, otherId, 'contact_removed', { name: actorName }, now, after);
  after(() => {
    ctx.hub.notify(actorId, 'contacts', 'chats');
    ctx.hub.notify(otherId, 'contacts', 'chats');
  });
}
