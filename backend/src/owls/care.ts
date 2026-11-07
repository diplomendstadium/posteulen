/**
 * Care history of an owl for the care bonus (SPEC 9.3, v0.2): days on which it was cared for
 * (v0.5: two different interactions), and the times it was away from home (flight, vet, menagerie). Kept only as long as the
 * bonus looks back. A separate module, because flights and owls both need it.
 */
import { MOTIVATION, OWL, TIME } from '@posteulen/shared/constants.ts';
import { hasCareBonus } from '@posteulen/shared/game/energy.ts';
import {
  interactionsOn,
  isCareDay,
  motivationAfter,
  type Interaction,
} from '@posteulen/shared/game/motivation.ts';
import type { Context } from '../context.ts';
import { utcDay } from '../security/ids.ts';
import type { OwlRow } from './model.ts';

/** A day on which the owl was cared for (care bonus, 9.3). */
export function markCareDay(ctx: Context, owlId: string, day: string): void {
  ctx.db.run('INSERT OR IGNORE INTO owl_care_days (owl_id, day) VALUES (?, ?)', owlId, day);
}

const COLUMN: Readonly<Record<Interaction, 'watered_on' | 'petted_on' | 'fed_on' | 'snacked_on'>> =
  {
    water: 'watered_on',
    pet: 'petted_on',
    feed: 'fed_on',
    snack: 'snacked_on',
  };

/**
 * One of the four interactions (v0.5, inside the caller's transaction): remembers the day,
 * raises the motivation by 0.1 the first time this kind happens today, and marks the day as
 * cared for once two different kinds happened today (9.3).
 */
export function interact(
  ctx: Context,
  owl: OwlRow,
  kind: Interaction,
  today: string,
  energy?: { readonly value: number; readonly at: number },
): void {
  const last = {
    water: owl.watered_on,
    pet: owl.petted_on,
    feed: owl.fed_on,
    snack: owl.snacked_on,
  };
  const already = last[kind] === today;
  const motivation = motivationAfter(owl.motivation, already);
  ctx.db.run(
    `UPDATE owls SET ${COLUMN[kind]} = ?, motivation = ? WHERE id = ?`,
    today,
    motivation,
    owl.id,
  );
  if (energy) {
    ctx.db.run(
      'UPDATE owls SET energy = ?, energy_at = ? WHERE id = ?',
      energy.value,
      energy.at,
      owl.id,
    );
  }
  if (isCareDay(interactionsOn({ ...last, [kind]: today }, today).length)) {
    markCareDay(ctx, owl.id, today);
  }
}

/** Every night at 00:00 UTC every owl of the players loses 0.1 motivation (v0.5). */
export function motivationNight(ctx: Context): void {
  ctx.db.run(
    "UPDATE owls SET motivation = MAX(?, motivation - ?) WHERE kind != 'bot'",
    MOTIVATION.MIN,
    MOTIVATION.STEP,
  );
}

/** The owl leaves home (flight, vet, menagerie); counted against its days at home (9.3). */
export function leftHome(ctx: Context, owlId: string, at: number): void {
  ctx.db.run('INSERT OR IGNORE INTO owl_away (owl_id, since_at) VALUES (?, ?)', owlId, at);
}

/** The owl is at home again. */
export function backHome(ctx: Context, owlId: string, at: number): void {
  ctx.db.run('UPDATE owl_away SET until_at = ? WHERE owl_id = ? AND until_at IS NULL', at, owlId);
}

/** Care bonus for the sickness roll on `day` (9.3). */
export function careBonusOf(ctx: Context, owl: OwlRow, day: string, now: number): boolean {
  const careDays = ctx.db
    .all<{ day: string }>('SELECT day FROM owl_care_days WHERE owl_id = ?', owl.id)
    .map((row) => row.day);
  const away = ctx.db
    .all<{ since_at: number; until_at: number | null }>(
      'SELECT since_at, until_at FROM owl_away WHERE owl_id = ?',
      owl.id,
    )
    .map((row) => ({ since: row.since_at, until: row.until_at }));
  return hasCareBonus({ day, ownedSince: owl.owned_since, careDays: new Set(careDays), away, now });
}

/** Care days and absences older than the look-back of the care bonus (cleanup 04:00). */
export function pruneCareHistory(ctx: Context, now: number): void {
  const cutoff = now - (OWL.CARE_BONUS_LOOKBACK_DAYS + 1) * TIME.DAY;
  ctx.db.run('DELETE FROM owl_care_days WHERE day < ?', utcDay(cutoff));
  ctx.db.run('DELETE FROM owl_away WHERE until_at IS NOT NULL AND until_at < ?', cutoff);
}
