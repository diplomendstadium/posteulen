/**
 * Statistics of an account (SPEC 8.10) and the day log behind the rule on giving gold and owls
 * (SPEC 9.1.5). Letters and active days are counted by triggers in the database (migration
 * 0023); interactions and kilometres here. Only counts and days are stored, never with whom.
 */
import { GIFTS, TIME } from '@posteulen/shared/constants.ts';
import { flownKm, type Segment } from '@posteulen/shared/game/flight.ts';
import { giftBlock, giftWindow, type GiftBlock } from '@posteulen/shared/game/gifts.ts';
import type { RescueAction } from '@posteulen/shared/game/rescue.ts';
import type { Context } from '../context.ts';
import { HttpError } from '../http/errors.ts';
import { utcDay } from '../security/ids.ts';

export type InteractionKind = RescueAction;

const COLUMNS: Readonly<Record<InteractionKind, string>> = {
  water: 'water',
  pet: 'pet',
  feed: 'feed',
  snack: 'snack',
  medicine: 'medicine',
};

/** One interaction with an owl (own, loan, visiting, bot or rescue centre owl). */
export function countInteraction(ctx: Context, userId: string, kind: InteractionKind): void {
  const column = COLUMNS[kind];
  ctx.db.run(`UPDATE user_stats SET ${column} = ${column} + 1 WHERE user_id = ?`, userId);
}

interface RouteStop {
  readonly type: string;
  readonly userId?: string;
}

/**
 * A finished flight of an own or loan owl of a player: its kilometres count for the player if
 * it flew between people – every recipient on its route is a person (not a bot).
 */
export function countFlightKm(
  ctx: Context,
  flight: {
    holder_id: string;
    holder_kind?: string;
    owl_kind: string;
    route: string;
    plan: string;
  },
): void {
  if (flight.holder_kind === 'bot' || (flight.owl_kind !== 'own' && flight.owl_kind !== 'loan'))
    return;
  const route = JSON.parse(flight.route) as RouteStop[];
  const recipients = route.filter((stop) => stop.type === 'deliver').map((stop) => stop.userId);
  if (recipients.length === 0) return;
  for (const id of recipients) {
    if (!id || !ctx.db.get('SELECT 1 FROM users WHERE id = ?', id)) return;
  }
  const km = flownKm(JSON.parse(flight.plan) as Segment[]);
  if (!(km > 0)) return;
  ctx.db.run(
    'UPDATE user_stats SET km_human = km_human + ? WHERE user_id = ?',
    km,
    flight.holder_id,
  );
}

/** A gift of gold or an owl was sent today (chicks that must be given away do not count). */
export function recordGift(ctx: Context, userId: string, now: number): void {
  ctx.db.run('UPDATE users SET last_gift_day = ? WHERE id = ?', utcDay(now), userId);
}

/** Why this player may not give gold or an owl now, or null (SPEC 9.1.5). */
export function giftBlockOf(ctx: Context, userId: string, now: number): GiftBlock | null {
  const today = utcDay(now);
  const window = giftWindow(today);
  const user = ctx.db.get<{ last_gift_day: string | null }>(
    'SELECT last_gift_day FROM users WHERE id = ?',
    userId,
  );
  const days = ctx.db
    .all<{ day: string; active: number; sent_human: number; received_human: number }>(
      'SELECT day, active, sent_human, received_human FROM activity_days WHERE user_id = ? AND day >= ?',
      userId,
      window[0] ?? today,
    )
    .map((row) => ({
      day: row.day,
      active: row.active === 1,
      sentHuman: row.sent_human === 1,
      receivedHuman: row.received_human === 1,
    }));
  return giftBlock({ today, lastGiftDay: user?.last_gift_day ?? null, days });
}

/**
 * Checks the rule before a gift of gold or an owl; the player only learns that only active
 * players can give something every two weeks (`gift_not_allowed`, SPEC 9.1.5).
 */
export function requireGiftAllowed(ctx: Context, userId: string, now: number): void {
  if (giftBlockOf(ctx, userId, now) !== null) throw new HttpError(403, 'gift_not_allowed');
}

/** The day log only needs the last two weeks (04:00 clean-up). */
export function pruneActivityDays(ctx: Context, now: number): void {
  ctx.db.run(
    'DELETE FROM activity_days WHERE day < ?',
    utcDay(now - (GIFTS.WINDOW_DAYS + 1) * TIME.DAY),
  );
}

export interface StatsView {
  readonly lettersSent: number;
  readonly lettersReceived: number;
  readonly daysSinceCreated: number;
  readonly activeDays: number;
  /** Active days in per cent of the days since the account was created (whole per cent). */
  readonly activePercent: number;
  readonly km: number;
  readonly interactions: Readonly<Record<InteractionKind, number>>;
  /** First day counted, if counting started after the account was created (else null). */
  readonly countedSince: string | null;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / TIME.DAY);
}

export function statsOf(ctx: Context, userId: string, now: number): StatsView {
  const user = ctx.db.get<{ created_on: string }>(
    'SELECT created_on FROM users WHERE id = ?',
    userId,
  );
  const row = ctx.db.get<{
    since: string;
    letters_sent: number;
    letters_received: number;
    active_days: number;
    km_human: number;
    water: number;
    pet: number;
    feed: number;
    snack: number;
    medicine: number;
  }>('SELECT * FROM user_stats WHERE user_id = ?', userId);
  const created = user?.created_on ?? utcDay(now);
  // The day of registration counts as day 1.
  const days = Math.max(1, daysBetween(created, utcDay(now)) + 1);
  const active = Math.min(days, row?.active_days ?? 0);
  return {
    lettersSent: row?.letters_sent ?? 0,
    lettersReceived: row?.letters_received ?? 0,
    daysSinceCreated: days,
    activeDays: active,
    activePercent: Math.round((active * 100) / days),
    km: Math.round(row?.km_human ?? 0),
    interactions: {
      medicine: row?.medicine ?? 0,
      water: row?.water ?? 0,
      pet: row?.pet ?? 0,
      feed: row?.feed ?? 0,
      snack: row?.snack ?? 0,
    },
    countedSince: row && row.since > created ? row.since : null,
  };
}

/**
 * Once after the update to v1.3.0: what the stored data still tells – letters still stored,
 * finished flights between people, active days (days with a letter written, and the last active
 * day), and for the last two weeks the day log and the last gift (SPEC 8.10, 9.1.5). Returns the
 * number of accounts.
 */
export function backfillStats(ctx: Context, now: number): number {
  if (ctx.db.get("SELECT 1 FROM meta WHERE key = 'stats_backfill'")) return 0;
  return ctx.db.transaction(() => {
    const users = ctx.db.all<{ id: string; last_active_date: string }>(
      'SELECT id, last_active_date FROM users',
    );
    const windowStart = giftWindow(utcDay(now))[0] ?? utcDay(now);
    for (const user of users) {
      ctx.db.run(
        'INSERT OR IGNORE INTO user_stats (user_id, since) VALUES (?, ?)',
        user.id,
        utcDay(now),
      );
      const sent =
        ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM letters WHERE sender_id = ?', user.id)
          ?.n ?? 0;
      const received =
        ctx.db.get<{ n: number }>(
          "SELECT COUNT(*) AS n FROM letters WHERE recipient_id = ? AND status = 'delivered'",
          user.id,
        )?.n ?? 0;
      const activeDays = new Set(
        ctx.db
          .all<{ day: string }>(
            "SELECT DISTINCT strftime('%Y-%m-%d', sent_at / 1000, 'unixepoch') AS day FROM letters WHERE sender_id = ?",
            user.id,
          )
          .map((row) => row.day),
      );
      activeDays.add(user.last_active_date);
      ctx.db.run(
        `UPDATE user_stats SET letters_sent = ?, letters_received = ?, active_days = ? WHERE user_id = ?`,
        sent,
        received,
        activeDays.size,
        user.id,
      );
      for (const day of activeDays) {
        if (day < windowStart) continue;
        ctx.db.run(
          `INSERT INTO activity_days (user_id, day, active) VALUES (?, ?, 1)
           ON CONFLICT (user_id, day) DO UPDATE SET active = 1`,
          user.id,
          day,
        );
      }
      const human = `EXISTS (SELECT 1 FROM users u WHERE u.id = l.recipient_id) AND EXISTS (SELECT 1 FROM users v WHERE v.id = l.sender_id) AND l.kind = 'letter'`;
      for (const row of ctx.db.all<{ day: string }>(
        `SELECT DISTINCT strftime('%Y-%m-%d', l.sent_at / 1000, 'unixepoch') AS day FROM letters l
          WHERE l.sender_id = ? AND ${human}`,
        user.id,
      )) {
        if (row.day < windowStart) continue;
        ctx.db.run(
          `INSERT INTO activity_days (user_id, day, sent_human) VALUES (?, ?, 1)
           ON CONFLICT (user_id, day) DO UPDATE SET sent_human = 1`,
          user.id,
          row.day,
        );
      }
      for (const row of ctx.db.all<{ day: string }>(
        `SELECT DISTINCT strftime('%Y-%m-%d', l.arrives_at / 1000, 'unixepoch') AS day FROM letters l
          WHERE l.recipient_id = ? AND l.status = 'delivered' AND ${human}`,
        user.id,
      )) {
        if (row.day < windowStart) continue;
        ctx.db.run(
          `INSERT INTO activity_days (user_id, day, received_human) VALUES (?, ?, 1)
           ON CONFLICT (user_id, day) DO UPDATE SET received_human = 1`,
          user.id,
          row.day,
        );
      }
      const gift = ctx.db.get<{ at: number | null }>(
        `SELECT MAX(started_at) AS at FROM flights
          WHERE holder_id = ? AND holder_kind = 'user' AND (purpose = 'gold' OR (purpose = 'gift' AND owl_id IN (SELECT id FROM owls WHERE is_chick = 0)))`,
        user.id,
      );
      if (gift?.at) {
        ctx.db.run('UPDATE users SET last_gift_day = ? WHERE id = ?', utcDay(gift.at), user.id);
      }
    }
    const flights = ctx.db.all<{
      holder_id: string;
      holder_kind: string;
      owl_kind: string;
      route: string;
      plan: string;
    }>("SELECT holder_id, holder_kind, owl_kind, route, plan FROM flights WHERE state = 'done'");
    for (const flight of flights) countFlightKm(ctx, flight);
    ctx.db.run("INSERT INTO meta (key, value) VALUES ('stats_backfill', '1')");
    return users.length;
  });
}
