/**
 * Bored owls (SPEC 9.2.9): once a day the server adds up how long each own adult owl has not come
 * home from a flight to people. After 21 days it is bored (system message, its overview shows the
 * bored picture); if it is not sent off to a person with a letter or gold within 7 more days, it
 * flies off into freedom – for good. The player sees its freedom picture once, at the next
 * opportunity, like a homecoming. The last adult owl of a player never flies off, and the owls of
 * a player who has never had a contact with another person never get bored (`firstHumanContact`).
 */
import { BOREDOM } from '@posteulen/shared/constants.ts';
import { escapes, idleAfter, idleCounts, isBored } from '@posteulen/shared/game/boredom.ts';
import type { OwlState } from '@posteulen/shared/game/owls.ts';
import type { Context } from '../context.ts';
import { randomId } from '../security/ids.ts';
import { addSystemMessage } from '../messages/system.ts';
import { isBotId } from '../bots/registry.ts';
import { owlLabel } from './globe.ts';
import { usersOnVacation } from './vacation.ts';

type After = (work: () => void) => void;

/**
 * The owl came home from people, or sets off to people with a letter or gold: it starts counting
 * again and is no longer bored.
 */
export function resetIdle(ctx: Context, owlId: string, now: number): void {
  ctx.db.run(
    "UPDATE owls SET idle_ms = 0, idle_at = ?, bored_at = NULL WHERE id = ? AND kind = 'own'",
    now,
    owlId,
  );
}

/**
 * The player has a confirmed contact with another person for the first time: from now on the
 * owls count their idle time, starting from nothing (9.2.9).
 */
export function firstHumanContact(ctx: Context, userId: string, now: number): void {
  const first = ctx.db.run(
    'UPDATE users SET human_contact_at = ? WHERE id = ? AND human_contact_at IS NULL',
    now,
    userId,
  );
  if (first.changes === 0) return;
  ctx.db.run(
    "UPDATE owls SET idle_ms = 0, idle_at = ?, bored_at = NULL WHERE owner_id = ? AND kind = 'own'",
    now,
    userId,
  );
}

/** Whether a flight visits at least one person (not a bot) – only those count (9.2.9). */
export function toPeople(ctx: Context, recipients: readonly string[]): boolean {
  return recipients.some((id) => !isBotId(ctx, id));
}

interface IdleOwl {
  readonly id: string;
  readonly owner_id: string;
  readonly state: OwlState;
  readonly name: string | null;
  readonly species: string;
  readonly km_flown: number;
  readonly idle_ms: number;
  readonly idle_at: number | null;
  readonly bored_at: number | null;
  readonly knows_people: number;
}

/** The daily count (BOREDOM.HOUR_UTC). */
export function boredomDay(ctx: Context, now: number, after: After): void {
  const vacation = usersOnVacation(ctx);
  const owls = ctx.db.all<IdleOwl>(
    `SELECT o.id, o.owner_id, o.state, o.name, o.species, o.km_flown, o.idle_ms, o.idle_at, o.bored_at,
            u.human_contact_at IS NOT NULL AS knows_people
       FROM owls o JOIN users u ON u.id = o.owner_id
      WHERE o.kind = 'own' AND o.is_chick = 0 AND o.state != 'gift_flight' AND u.state != 'deleting'
      ORDER BY o.owner_id, o.created_at, o.id`,
  );
  const adults = new Map<string, number>();
  for (const owl of owls) adults.set(owl.owner_id, (adults.get(owl.owner_id) ?? 0) + 1);
  for (const owl of owls) {
    const idle = idleAfter({
      idleMs: owl.idle_ms,
      idleAt: owl.idle_at,
      now,
      counts: idleCounts(owl.state, vacation.has(owl.owner_id), owl.knows_people === 1),
    });
    const others = (adults.get(owl.owner_id) ?? 1) - 1;
    // Only an owl whose boredom was announced on an earlier day flies off.
    if (owl.bored_at !== null && escapes({ idleMs: idle, state: owl.state, otherAdults: others })) {
      flyOff(ctx, owl, now, after);
      adults.set(owl.owner_id, others);
      continue;
    }
    const bored = owl.bored_at === null && isBored(idle);
    ctx.db.run(
      'UPDATE owls SET idle_ms = ?, idle_at = ?, bored_at = COALESCE(bored_at, ?) WHERE id = ?',
      Math.round(idle),
      now,
      bored ? now : null,
      owl.id,
    );
    if (bored) {
      addSystemMessage(
        ctx,
        owl.owner_id,
        'owl_bored',
        { owl: owlLabel(owl), days: BOREDOM.ESCAPE_AFTER_DAYS },
        now,
        after,
      );
      after(() => ctx.hub.notify(owl.owner_id, 'owls'));
    }
  }
}

/** The owl is gone for good; its freedom picture waits for the next opening of the app. */
function flyOff(ctx: Context, owl: IdleOwl, now: number, after: After): void {
  const label = owlLabel(owl);
  ctx.db.run('DELETE FROM owls WHERE id = ?', owl.id);
  ctx.db.run(
    "INSERT INTO homecomings (id, user_id, owl_name, species, letters, created_at, kind) VALUES (?, ?, ?, ?, 0, ?, 'freedom')",
    randomId(),
    owl.owner_id,
    label,
    owl.species,
    now,
  );
  addSystemMessage(ctx, owl.owner_id, 'owl_escaped', { owl: label }, now, after);
  after(() => ctx.hub.notify(owl.owner_id, 'owls', 'homecomings'));
}
