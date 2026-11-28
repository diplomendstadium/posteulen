/**
 * The second look of owls (SPEC 9.2.6): every new own owl and every owl that changes its owner
 * gets the look that is rarer among the owner's other owls of its species. v1.5.0: a chick also
 * gets its chick look – the rarest of three among the owner's other chicks of its species.
 */
import { chickLookFor, lookFor } from '@posteulen/shared/game/look.ts';
import { speciesById } from '@posteulen/shared/game/owls.ts';
import type { Context } from '../context.ts';

export function assignLook(ctx: Context, owlId: string): void {
  const owl = ctx.db.get<{ owner_id: string; species: string; is_chick: number }>(
    "SELECT owner_id, species, is_chick FROM owls WHERE id = ? AND kind = 'own'",
    owlId,
  );
  if (!owl) return;
  const counts = ctx.db.get<{ standard: number | null; second: number | null }>(
    `SELECT SUM(look = 0) AS standard, SUM(look = 1) AS second FROM owls
      WHERE owner_id = ? AND species = ? AND kind = 'own' AND state != 'gift_flight' AND id != ?`,
    owl.owner_id,
    owl.species,
    owlId,
  );
  const look = lookFor({
    standard: counts?.standard ?? 0,
    second: counts?.second ?? 0,
    mythical: speciesById(owl.species)?.mythical === true,
  });
  ctx.db.run('UPDATE owls SET look = ? WHERE id = ?', look, owlId);
  if (owl.is_chick === 1) assignChickLook(ctx, owlId, owl.owner_id, owl.species);
}

/** v1.5.0: the chick look that is rarest among the owner's other chicks of the species. */
function assignChickLook(ctx: Context, owlId: string, ownerId: string, species: string): void {
  const counts = ctx.db.get<{ a: number | null; b: number | null; c: number | null }>(
    `SELECT SUM(chick_look = 0) AS a, SUM(chick_look = 1) AS b, SUM(chick_look = 2) AS c FROM owls
      WHERE owner_id = ? AND species = ? AND kind = 'own' AND is_chick = 1
        AND state != 'gift_flight' AND id != ?`,
    ownerId,
    species,
    owlId,
  );
  const look = chickLookFor([counts?.a ?? 0, counts?.b ?? 0, counts?.c ?? 0]);
  ctx.db.run('UPDATE owls SET chick_look = ? WHERE id = ?', look, owlId);
}

/** Whether an owl shows the second pictures of its species (owl choice when sending). */
export function hasSecondLook(ctx: Context, owlId: string | null): boolean {
  if (owlId === null) return false;
  return (
    ctx.db.get("SELECT 1 FROM owls WHERE id = ? AND kind = 'own' AND look = 1", owlId) !== undefined
  );
}

/** v1.5.0: the chick look of an own chick (0 if it is none). */
export function chickLookOf(ctx: Context, owlId: string | null): 0 | 1 | 2 {
  if (owlId === null) return 0;
  const row = ctx.db.get<{ chick_look: number }>(
    "SELECT chick_look FROM owls WHERE id = ? AND kind = 'own' AND is_chick = 1",
    owlId,
  );
  const look = row?.chick_look ?? 0;
  return look === 1 || look === 2 ? look : 0;
}
