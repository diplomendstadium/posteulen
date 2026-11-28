/**
 * v1.5.0: the chick to give away, as clear as possible (SPEC 8.5, 9.9). While a clutch of the
 * player is open, the profile carries it: a banner at the top of every page of the app and, once
 * a day (UTC day), a big notice with a picture of the chick, the time left and a button to the
 * gift. The notice counts as seen for the day once the app reports it.
 */
import { OWL, TIME } from '@posteulen/shared/constants.ts';
import { maxOwnOwls } from '@posteulen/shared/game/owls.ts';
import type { Context } from '../context.ts';
import { utcDay } from '../security/ids.ts';
import { activeContacts } from './lifecycle.ts';
import { owlsCounted } from './limit.ts';

export interface ClutchNotice {
  readonly id: string;
  readonly species: string;
  /** Beyond the most own owls all chicks must be given away (9.9). */
  readonly giftAll: boolean;
  /** When the lot decides. */
  readonly deadline: number;
  /** Chicks of the clutch still at home. */
  readonly chicks: number;
  /** The chick look of the first of them – the picture of the notice (9.2.6). */
  readonly look: 0 | 1 | 2;
  /** The big notice was not shown yet today. */
  readonly due: boolean;
  /** At least one active human contact still has room for a chick (otherwise all may stay). */
  readonly recipients: boolean;
}

export function clutchNotice(ctx: Context, userId: string, now: number): ClutchNotice | null {
  const clutch = ctx.db.get<{
    id: string;
    species: string;
    hatched_at: number;
    gift_all: number;
    notice_on: string | null;
  }>(
    `SELECT id, species, hatched_at, gift_all, notice_on FROM clutches
      WHERE owner_id = ? AND gift_state = 'open' ORDER BY hatched_at, id LIMIT 1`,
    userId,
  );
  if (!clutch) return null;
  const chicks = ctx.db.all<{ chick_look: number }>(
    `SELECT chick_look FROM owls WHERE clutch_id = ? AND owner_id = ? AND is_chick = 1
        AND state = 'home' ORDER BY id`,
    clutch.id,
    userId,
  );
  const first = chicks[0];
  if (!first) return null;
  const look = first.chick_look === 1 || first.chick_look === 2 ? first.chick_look : 0;
  return {
    id: clutch.id,
    species: clutch.species,
    giftAll: clutch.gift_all === 1,
    deadline: clutch.hatched_at + OWL.CHICK_GIFT_DEADLINE_HOURS * TIME.HOUR,
    chicks: chicks.length,
    look,
    due: clutch.notice_on !== utcDay(now),
    recipients: activeContacts(ctx, userId, now).some((id) => owlsCounted(ctx, id) < maxOwnOwls()),
  };
}

/** The big notice was shown today (the banner stays). */
export function clutchNoticeSeen(
  ctx: Context,
  userId: string,
  clutchId: string,
  now: number,
): void {
  ctx.db.run(
    "UPDATE clutches SET notice_on = ? WHERE id = ? AND owner_id = ? AND gift_state = 'open'",
    utcDay(now),
    clutchId,
    userId,
  );
}
