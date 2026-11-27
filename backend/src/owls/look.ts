/**
 * The second look of owls (SPEC 9.2.6): every new own owl and every owl that changes its owner
 * gets the look that is rarer among the owner's other owls of its species.
 */
import { lookFor } from '@posteulen/shared/game/look.ts';
import { speciesById } from '@posteulen/shared/game/owls.ts';
import type { Context } from '../context.ts';

export function assignLook(ctx: Context, owlId: string): void {
  const owl = ctx.db.get<{ owner_id: string; species: string }>(
    "SELECT owner_id, species FROM owls WHERE id = ? AND kind = 'own'",
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
}

/** Whether an owl shows the second pictures of its species (owl choice when sending). */
export function hasSecondLook(ctx: Context, owlId: string | null): boolean {
  if (owlId === null) return false;
  return (
    ctx.db.get("SELECT 1 FROM owls WHERE id = ? AND kind = 'own' AND look = 1", owlId) !== undefined
  );
}
