/**
 * v1.3.1: pairs of owls (SPEC 9.9). Keeps the times an own owl is at home but not ready (sick,
 * brooding) and works out the chance of eggs after a return home from the pair rules.
 */
import { OWL, TIME } from '@posteulen/shared/constants.ts';
import { isMythical } from '@posteulen/shared/game/owls.ts';
import {
  eggProbability,
  metOnVisit,
  pairedAtHome,
  type ReadyTimes,
} from '@posteulen/shared/game/pairs.ts';
import type { Context } from '../context.ts';
import type { OwlRow } from './model.ts';

type PairOwl = Pick<
  OwlRow,
  'id' | 'owner_id' | 'kind' | 'species' | 'sex' | 'is_chick' | 'owned_since' | 'adult_at'
> & { readonly created_at: number };

/** The owl is at home but not ready from now on (sick, brooding). */
export function markUnready(ctx: Context, owlId: string, at: number): void {
  ctx.db.run('INSERT OR IGNORE INTO owl_unready (owl_id, since_at) VALUES (?, ?)', owlId, at);
}

/** The owl is ready again (healthy, the chicks have hatched). */
export function markReady(ctx: Context, owlId: string, at: number): void {
  ctx.db.run(
    'UPDATE owl_unready SET until_at = ? WHERE owl_id = ? AND until_at IS NULL',
    at,
    owlId,
  );
}

/** When the owl was ready at home with its current holder (absences, sickness, brooding). */
function readyTimesOf(ctx: Context, owl: PairOwl): ReadyTimes {
  const rows = ctx.db.all<{ since_at: number; until_at: number | null }>(
    `SELECT since_at, until_at FROM owl_away WHERE owl_id = ?1
     UNION ALL SELECT since_at, until_at FROM owl_unready WHERE owl_id = ?1`,
    owl.id,
  );
  return {
    from: Math.max(owl.created_at, Date.parse(`${owl.owned_since}T00:00:00Z`), owl.adult_at ?? 0),
    notReady: rows.map((row) => ({ since: row.since_at, until: row.until_at })),
  };
}

/** Adult own males of this species of a player (partners for the pair rules). */
function malesOf(ctx: Context, userId: string, species: string): PairOwl[] {
  return ctx.db.all<PairOwl>(
    `SELECT id, owner_id, kind, species, sex, is_chick, owned_since, adult_at, created_at FROM owls
      WHERE owner_id = ? AND kind = 'own' AND is_chick = 0 AND sex = 'm' AND species = ?`,
    userId,
    species,
  );
}

/** A female that can lay eggs: own, adult, not the phoenix. */
function canBreed(owl: Pick<OwlRow, 'kind' | 'is_chick' | 'sex' | 'species'>): boolean {
  return owl.kind === 'own' && owl.is_chick === 0 && owl.sex === 'f' && !isMythical(owl.species);
}

/**
 * The chance of eggs for this female returning home at `at`: twice as high with a partner at
 * home or one met on a visit (`mate_met`), three times with both. Forgets the visit.
 */
export function eggChanceOf(ctx: Context, owl: OwlRow, at: number): number {
  const female = owl as OwlRow & PairOwl;
  const ready = readyTimesOf(ctx, female);
  const atHome = malesOf(ctx, owl.owner_id, owl.species).some((male) =>
    pairedAtHome(ready, readyTimesOf(ctx, male), at),
  );
  const visit = owl.mate_met === 1;
  if (visit) ctx.db.run('UPDATE owls SET mate_met = 0 WHERE id = ?', owl.id);
  return eggProbability(atHome, visit);
}

/**
 * The rest of a female at a recipient ends (`restStart` to `restEnd`): if a male of her species
 * was ready at home there for at least 2 hours of it, she remembers it until she is home.
 */
export function noteVisit(
  ctx: Context,
  owlId: string | null,
  hostId: string,
  restStart: number,
  restEnd: number,
): void {
  if (!owlId || restEnd - restStart < OWL.VISIT_MIN_HOURS * TIME.HOUR) return;
  const owl = ctx.db.get<Pick<OwlRow, 'kind' | 'is_chick' | 'sex' | 'species' | 'owner_id'>>(
    'SELECT kind, is_chick, sex, species, owner_id FROM owls WHERE id = ?',
    owlId,
  );
  if (!owl || !canBreed(owl) || owl.owner_id === hostId) return;
  const met = malesOf(ctx, hostId, owl.species).some((male) =>
    metOnVisit(readyTimesOf(ctx, male), restStart, restEnd),
  );
  if (met) ctx.db.run('UPDATE owls SET mate_met = 1 WHERE id = ?', owlId);
}

/** Times of sickness and brooding are kept as long as the absences (cleanup 04:00). */
export function pruneUnready(ctx: Context, cutoff: number): void {
  ctx.db.run('DELETE FROM owl_unready WHERE until_at IS NOT NULL AND until_at < ?', cutoff);
}
