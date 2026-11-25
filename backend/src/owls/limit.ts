/**
 * The most own owls a player may have (SPEC 9.2.3): as many as there are species. At the limit
 * nothing new comes in – no purchase, no gift of an owl or chick, no voucher owl, no owl of a bot,
 * and healed wild owls of the rescue centre always fly off into freedom; chicks hatched beyond it
 * must all be given away (9.9). While a player has reached the limit, a system message once a week.
 */
import { OWL_LIMIT, TIME } from '@posteulen/shared/constants.ts';
import { maxOwnOwls } from '@posteulen/shared/game/owls.ts';
import type { Context } from '../context.ts';
import { HttpError } from '../http/errors.ts';
import { addSystemMessage } from '../messages/system.ts';
import { routeOf, type FlightRow } from '../flights/service.ts';
import { ownOwlCount } from './model.ts';

type After = (work: () => void) => void;

/** Owls and chicks on their gift flight to this player (they count for the limit already). */
export function incomingGifts(ctx: Context, userId: string): number {
  return ctx.db
    .all<FlightRow>(
      "SELECT * FROM flights WHERE purpose = 'gift' AND state = 'active' AND holder_kind = 'user'",
    )
    .filter((flight) =>
      routeOf(flight).some(
        (stop) => stop.type === 'deliver' && stop.status === 'pending' && stop.userId === userId,
      ),
    ).length;
}

/** Own owls including chicks and owls on their way to the player as a gift. */
export function owlsCounted(ctx: Context, userId: string): number {
  return ownOwlCount(ctx, userId) + incomingGifts(ctx, userId);
}

/** Whether `extra` more owls fit below the limit. */
export function hasRoom(ctx: Context, userId: string, extra = 1): boolean {
  return owlsCounted(ctx, userId) + extra <= maxOwnOwls();
}

/** A gift of an owl or chick only to someone below the limit (9.2.7, 9.9). */
export function requireRoom(ctx: Context, recipient: string): void {
  if (!hasRoom(ctx, recipient)) throw new HttpError(400, 'recipient_owl_limit');
}

/** Daily: a system message once a week while a player has the most owls (9.2.3). */
export function limitNotices(ctx: Context, now: number, after: After): void {
  const users = ctx.db.all<{ id: string; owl_limit_notice_at: number | null; n: number }>(
    `SELECT u.id, u.owl_limit_notice_at, COUNT(o.id) AS n FROM users u
       LEFT JOIN owls o ON o.owner_id = u.id AND o.kind = 'own' AND o.state != 'gift_flight'
      WHERE u.state = 'active'
      GROUP BY u.id`,
  );
  const max = maxOwnOwls();
  for (const user of users) {
    if (user.n < max) {
      if (user.owl_limit_notice_at !== null)
        ctx.db.run('UPDATE users SET owl_limit_notice_at = NULL WHERE id = ?', user.id);
      continue;
    }
    // A little slack, so that the daily job on the seventh day always sends it.
    if (
      user.owl_limit_notice_at !== null &&
      now - user.owl_limit_notice_at < OWL_LIMIT.NOTICE_EVERY_DAYS * TIME.DAY - TIME.HOUR
    )
      continue;
    ctx.db.run('UPDATE users SET owl_limit_notice_at = ? WHERE id = ?', now, user.id);
    addSystemMessage(ctx, user.id, 'owl_limit', { max }, now, after);
  }
}
