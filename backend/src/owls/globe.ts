/**
 * The 🌍 badge (SPEC 9.2.1): an own owl that has flown more than the Earth's circumference
 * (40 030 km) wears 🌍 after its name wherever the name appears – announced once with a festive
 * system message. Names are stored without the badge (renaming, releasing); it is added when a
 * name is shown or written into a new message.
 */
import { GLOBE } from '@posteulen/shared/constants.ts';
import { isGlobetrotter, owlDisplayName } from '@posteulen/shared/game/gifts.ts';
import type { Context } from '../context.ts';
import { addSystemMessage } from '../messages/system.ts';

type After = (work: () => void) => void;

/** The name with the badge, if the owl has earned it. */
export function owlLabel(owl: {
  readonly name: string | null;
  readonly km_flown?: number;
}): string {
  return owlDisplayName(owl.name ?? '', isGlobetrotter(owl.km_flown ?? 0));
}

/** The kilometres of an owl by ID (0 if it is gone, e.g. a vanished loan owl). */
export function kmOf(ctx: Context, owlId: string | null): number {
  if (!owlId) return 0;
  return (
    ctx.db.get<{ km_flown: number }>('SELECT km_flown FROM owls WHERE id = ?', owlId)?.km_flown ?? 0
  );
}

/** The name of the owl of a flight as shown now (with 🌍 if it has earned it). */
export function flightOwlLabel(
  ctx: Context,
  flight: { readonly owl_id: string | null; readonly owl_name: string },
): string {
  return owlDisplayName(flight.owl_name, isGlobetrotter(kmOf(ctx, flight.owl_id)));
}

/** Announces the badge once, as soon as the owl has flown more than 40 030 km. */
export function announceGlobe(ctx: Context, owlId: string, now: number, after?: After): void {
  const owl = ctx.db.get<{ owner_id: string; name: string | null; km_flown: number; kind: string }>(
    'SELECT owner_id, name, km_flown, kind FROM owls WHERE id = ? AND globe_announced = 0',
    owlId,
  );
  if (!owl || owl.kind !== 'own' || !isGlobetrotter(owl.km_flown)) return;
  ctx.db.run('UPDATE owls SET globe_announced = 1 WHERE id = ?', owlId);
  addSystemMessage(
    ctx,
    owl.owner_id,
    'owl_globe',
    { owl: owl.name ?? '', km: Math.round(owl.km_flown) },
    now,
    after,
  );
  after?.(() => ctx.hub.notify(owl.owner_id, 'owls'));
}

/** At the start: owls that earned the badge before (or while the server was down). */
export function announceAllGlobetrotters(ctx: Context, now: number): number {
  const owls = ctx.db.all<{ id: string }>(
    "SELECT id FROM owls WHERE kind = 'own' AND globe_announced = 0 AND km_flown > ?",
    GLOBE.KM,
  );
  ctx.db.transaction(() => {
    for (const owl of owls) announceGlobe(ctx, owl.id, now);
  });
  return owls.length;
}
