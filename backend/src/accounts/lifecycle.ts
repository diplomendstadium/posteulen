/**
 * Account lifecycle (SPEC 7.4–7.7, 9.10): name and home changes, deletion by the user with a
 * 24-hour grace period, final deletion, inactivity warnings and automatic deletion, and the
 * daily clean-up.
 */
import { pruneMedia } from '../central/media.ts';
import { pruneOldEvents } from '../central/retention.ts';
import { cleanUpOffers } from '../owls/lifecycle.ts';
import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';
import { pruneCareHistory } from '../owls/care.ts';
import { isRetentionDay, purgeOldLetters } from '../letters/retention.ts';
import { pruneFeedback } from '../admin/feedback.ts';
import type { Context } from '../context.ts';
import { hmac, utcDay } from '../security/ids.ts';
import { addSystemMessage } from '../messages/system.ts';
import { pair } from '../contacts/model.ts';
import {
  finishFlight,
  replanFlight,
  routeOf,
  turnBack,
  type FlightRow,
} from '../flights/service.ts';
import { getInactivityDays } from '../admin/settings.ts';
import { pruneErrorLog } from '../ops/error-log.ts';

type After = (work: () => void) => void;

export function contactIdsOf(ctx: Context, userId: string): string[] {
  return ctx.db
    .all<{ other: string }>(
      `SELECT CASE WHEN user_lo = ? THEN user_hi ELSE user_lo END AS other
         FROM contacts WHERE user_lo = ? OR user_hi = ?`,
      userId,
      userId,
      userId,
    )
    .map((row) => row.other);
}

/** Locks a name key for 90 days (7.6); only an HMAC is stored. */
export function lockName(ctx: Context, nameKey: string, now: number): void {
  ctx.db.run(
    `INSERT INTO name_locks (hmac, expires_on) VALUES (?, ?)
     ON CONFLICT (hmac) DO UPDATE SET expires_on = excluded.expires_on`,
    hmac(ctx.keys.nameLock, nameKey),
    utcDay(now + ACCOUNT.NAME_LOCK_DAYS * TIME.DAY),
  );
}

/** Starts the 24-hour grace period (7.5); logging in again within it cancels the deletion. */
export function requestDeletion(ctx: Context, userId: string, now: number): void {
  ctx.db.run(
    "UPDATE users SET state = 'deletion_pending', deletion_requested_at = ? WHERE id = ? AND state = 'active'",
    now,
    userId,
  );
  ctx.db.run('DELETE FROM sessions WHERE user_id = ?', userId);
  ctx.db.run('DELETE FROM push_subscriptions WHERE user_id = ?', userId);
  ctx.queue.cancel('account_delete', userId);
  ctx.queue.schedule('account_delete', userId, now + ACCOUNT.SELF_DELETE_GRACE_HOURS * TIME.HOUR);
}

/** Login within the grace period (7.5): back to normal, with a system message. */
export function cancelDeletion(ctx: Context, userId: string, now: number, after: After): void {
  ctx.queue.cancel('account_delete', userId);
  addSystemMessage(ctx, userId, 'deletion_cancelled', {}, now, after);
}

/**
 * Begin of the final deletion (7.7): no login any more, gone from all address books,
 * owls on the way to the account turn back, its own owls only deliver what they carry.
 */
export function beginFinalDeletion(ctx: Context, userId: string, now: number, after: After): void {
  const user = ctx.db.get<{ state: string; name_display: string; name_key: string }>(
    'SELECT state, name_display, name_key FROM users WHERE id = ?',
    userId,
  );
  if (!user || user.state === 'deleting') return;
  ctx.db.run("UPDATE users SET state = 'deleting' WHERE id = ?", userId);
  ctx.db.run('DELETE FROM sessions WHERE user_id = ?', userId);
  ctx.db.run('DELETE FROM push_subscriptions WHERE user_id = ?', userId);
  ctx.db.run('DELETE FROM contact_requests WHERE from_id = ?', userId);
  lockName(ctx, user.name_key, now);
  for (const other of contactIdsOf(ctx, userId)) {
    const [lo, hi] = pair(userId, other);
    ctx.db.run('DELETE FROM contacts WHERE user_lo = ? AND user_hi = ?', lo, hi);
    addSystemMessage(ctx, other, 'contact_deleted', { name: user.name_display }, now, after);
    after(() => ctx.hub.notify(other, 'contacts', 'chats'));
  }
  // Owls of others on their way to this account turn back (9.5).
  const incoming = ctx.db.all<FlightRow>(
    "SELECT * FROM flights WHERE state = 'active' AND holder_id != ?",
    userId,
  );
  for (const flight of incoming) {
    if (routeOf(flight).some((stop) => stop.userId === userId && stop.status === 'pending')) {
      turnBack(ctx, flight, userId, now, after);
    }
  }
  // Own owls: no return flight any more; they vanish after their last delivery (7.7 item 3).
  const own = ctx.db.all<FlightRow>(
    "SELECT * FROM flights WHERE state = 'active' AND holder_id = ?",
    userId,
  );
  for (const flight of own) {
    const route = routeOf(flight);
    for (const stop of route)
      if (stop.type === 'home' && stop.status === 'pending') stop.status = 'skipped';
    if (route.some((stop) => stop.status === 'pending')) {
      replanFlight(ctx, flight, route, now);
    } else {
      finishFlight(ctx, flight.id);
      if (flight.owl_id)
        ctx.db.run('DELETE FROM owls WHERE id = ? AND owner_id = ?', flight.owl_id, userId);
    }
  }
  purgeIfIdle(ctx, userId);
}

/** Final removal of all data once no delivery of the account is on its way (7.7 item 4). */
export function purgeIfIdle(ctx: Context, userId: string): boolean {
  const user = ctx.db.get<{ state: string }>('SELECT state FROM users WHERE id = ?', userId);
  if (user?.state !== 'deleting') return false;
  const flying = ctx.db.get(
    "SELECT 1 FROM flights WHERE state = 'active' AND holder_id = ?",
    userId,
  );
  if (flying) return false;
  // Own copies of letters go; what others received stays with them (7.7).
  ctx.db.run('UPDATE letters SET sender_has = 0 WHERE sender_id = ?', userId);
  ctx.db.run('UPDATE letters SET recipient_has = 0 WHERE recipient_id = ?', userId);
  ctx.db.run('DELETE FROM letters WHERE sender_has = 0 AND recipient_has = 0');
  ctx.db.run(
    "DELETE FROM scheduled_events WHERE ref = ? AND type IN ('account_delete', 'account_purge')",
    userId,
  );
  // v0.8: flights have no foreign key on the holder any more (bots fly, too).
  ctx.db.run('DELETE FROM flights WHERE holder_id = ? OR bot_peer_id = ?', userId, userId);
  // Everything else hangs on the user row (ON DELETE CASCADE).
  ctx.db.run('DELETE FROM users WHERE id = ?', userId);
  return true;
}

/**
 * Daily at 04:00 UTC (9.10, 4.5): warn 30 days before the automatic deletion, delete accounts
 * whose warning is at least 30 days old, and clean up expired data.
 */
function inactivityAndCleanup(ctx: Context, day: string, at: number, after: After): void {
  const days = getInactivityDays(ctx.db);
  const dayMs = Date.parse(`${day}T00:00:00Z`);
  const warnBefore = utcDay(dayMs - (days - ACCOUNT.AUTO_DELETE_WARNING_DAYS) * TIME.DAY);
  const toWarn = ctx.db.all<{ id: string }>(
    "SELECT id FROM users WHERE state = 'active' AND inactivity_warned_on IS NULL AND last_active_date <= ?",
    warnBefore,
  );
  for (const user of toWarn) {
    ctx.db.run('UPDATE users SET inactivity_warned_on = ? WHERE id = ?', day, user.id);
    addSystemMessage(ctx, user.id, 'deletion_warning', {}, at, after);
    ctx.push.notify(user.id, 'deletion_warning', null, at, after);
  }
  // A shorter period never deletes without a warning at least 30 days old (SPEC 13 item 4).
  const toDelete = ctx.db.all<{ id: string }>(
    `SELECT id FROM users WHERE state = 'active' AND last_active_date <= ?
        AND inactivity_warned_on IS NOT NULL AND inactivity_warned_on <= ?`,
    utcDay(dayMs - days * TIME.DAY),
    utcDay(dayMs - ACCOUNT.AUTO_DELETE_WARNING_DAYS * TIME.DAY),
  );
  for (const user of toDelete) beginFinalDeletion(ctx, user.id, at, after);

  ctx.db.run('DELETE FROM invite_codes WHERE expires_at <= ?', at);
  // v0.6.1: expired sessions go, too – before, they stayed until the next login of the account.
  ctx.db.run(
    'DELETE FROM sessions WHERE last_used_at < ?',
    at - ACCOUNT.USER_SESSION_IDLE_DAYS * TIME.DAY,
  );
  ctx.db.run(
    'DELETE FROM admin_sessions WHERE last_used_at < ?',
    at - ACCOUNT.ADMIN_SESSION_IDLE_MINUTES * TIME.MINUTE,
  );
  ctx.db.run('DELETE FROM name_locks WHERE expires_on < ?', day);
  ctx.db.run('DELETE FROM contact_requests WHERE expires_at <= ?', at);
  pruneErrorLog(ctx.db, at);
  // Unconfirmed notifications are kept for "Neuigkeiten", but not forever.
  ctx.db.run('DELETE FROM notifications WHERE created_at < ?', at - 60 * TIME.DAY);
  pruneCareHistory(ctx, at);
  // v0.8.5: letters and system messages past their period only once a week, on Mondays. A
  // missed run waits for the next Monday (the daily job only runs for the current day).
  if (isRetentionDay(day)) purgeOldLetters(ctx, at, undefined, after);
  // v0.7.1: messages to the admin go after 90 days.
  pruneFeedback(ctx, at);
  // v0.7.2: homecomings nobody looked at (overlay) go after 60 days.
  ctx.db.run('DELETE FROM homecomings WHERE created_at < ?', at - 60 * TIME.DAY);
  // v0.8.2: banners of the admin are gone once they have ended.
  ctx.db.run('DELETE FROM banners WHERE ends_at <= ?', at);
  // v0.8.3: care marks of visiting bot owls only matter for the current day.
  ctx.db.run('DELETE FROM bot_owl_care WHERE day < ?', utcDay(at - TIME.DAY));
  // v0.8.5: events of bots go 36 months after they were sent (SPEC 10.10).
  pruneOldEvents(ctx, at);
  // v0.8: pictures of bots that no event and no letter uses any more (SPEC 10.11).
  pruneMedia(ctx, at);
  // v0.8.5: loan offers per account are only needed for two days (9.6).
  cleanUpOffers(ctx, at);
  ctx.db.run(
    'DELETE FROM bots_admin_sessions WHERE last_used_at < ?',
    at - ACCOUNT.BOTS_SESSION_IDLE_HOURS * TIME.HOUR,
  );
}

export function registerAccountHandlers(ctx: Context): void {
  ctx.queue.on('account_delete', (event, tools) => {
    const user = ctx.db.get<{ state: string }>('SELECT state FROM users WHERE id = ?', event.ref);
    // Cancelled by a login within 24 hours (7.5).
    if (user?.state !== 'deletion_pending') return;
    beginFinalDeletion(ctx, event.ref, event.logicalAt, tools.after);
  });
  ctx.queue.on('account_purge', (event) => void purgeIfIdle(ctx, event.ref));
  ctx.queue.registerDaily({
    name: 'inactivity',
    hourUtc: ACCOUNT.INACTIVITY_HOUR_UTC,
    catchUpEveryDay: false,
    run: (day, logicalAt, tools) => inactivityAndCleanup(ctx, day, logicalAt, tools.after),
  });
}
