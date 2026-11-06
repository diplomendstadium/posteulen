/**
 * Care history of an owl for the care bonus (SPEC 9.3, v0.2): days on which it was petted or
 * fed, and the times it was away from home (flight, vet, menagerie). Kept only as long as the
 * bonus looks back. A separate module, because flights and owls both need it.
 */
import { OWL, TIME } from '@posteulen/shared/constants.ts';
import { hasCareBonus } from '@posteulen/shared/game/energy.ts';
import type { Context } from '../context.ts';
import { utcDay } from '../security/ids.ts';
import type { OwlRow } from './model.ts';

/** A day on which the owl was petted or fed (care bonus, 9.3). */
export function markCareDay(ctx: Context, owlId: string, day: string): void {
  ctx.db.run('INSERT OR IGNORE INTO owl_care_days (owl_id, day) VALUES (?, ?)', owlId, day);
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
