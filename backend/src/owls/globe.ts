/**
 * Badges after the names of own owls (SPEC 9.2.1): 🌍 for more than the Earth's circumference
 * (40,030 km), 🌙 from the distance Earth–Moon (384,400 km), 👑 from 1,000,000 km – the highest
 * wherever the name appears, each announced once with a festive system message. Names are
 * stored without the badge (renaming, releasing); it is added when a name is shown or written
 * into a new message.
 */
import { BADGES } from '@posteulen/shared/constants.ts';
import {
  BADGE_ORDER,
  hasBadge,
  owlBadge,
  owlDisplayName,
  type OwlBadge,
} from '@posteulen/shared/game/badges.ts';
import type { Context } from '../context.ts';
import { addSystemMessage, type SystemMessageType } from '../messages/system.ts';

type After = (work: () => void) => void;

/** The name with the badge, if the owl has earned one. */
export function owlLabel(owl: {
  readonly name: string | null;
  readonly km_flown?: number;
}): string {
  return owlDisplayName(owl.name ?? '', owlBadge(owl.km_flown ?? 0));
}

/** The kilometres of an owl by ID (0 if it is gone, e.g. a vanished loan owl). */
export function kmOf(ctx: Context, owlId: string | null): number {
  if (!owlId) return 0;
  return (
    ctx.db.get<{ km_flown: number }>('SELECT km_flown FROM owls WHERE id = ?', owlId)?.km_flown ?? 0
  );
}

/** The name of the owl of a flight as shown now (with its badge if it has earned one). */
export function flightOwlLabel(
  ctx: Context,
  flight: { readonly owl_id: string | null; readonly owl_name: string },
): string {
  return owlDisplayName(flight.owl_name, owlBadge(kmOf(ctx, flight.owl_id)));
}

/** Column that remembers the announcement, and the type of the system message. */
const ANNOUNCED: Readonly<Record<OwlBadge, { column: string; message: SystemMessageType }>> = {
  globe: { column: 'globe_announced', message: 'owl_globe' },
  moon: { column: 'moon_announced', message: 'owl_moon' },
  crown: { column: 'crown_announced', message: 'owl_crown' },
};

interface BadgeRow {
  readonly owner_id: string;
  readonly name: string | null;
  readonly km_flown: number;
  readonly kind: string;
  readonly globe_announced: number;
  readonly moon_announced: number;
  readonly crown_announced: number;
}

/**
 * Announces the highest badge the owl has newly reached – once each. If it passed several at
 * once (only possible for counts from before), only the highest is celebrated; the lower ones
 * are marked as announced.
 */
export function announceBadges(ctx: Context, owlId: string, now: number, after?: After): void {
  const owl = ctx.db.get<BadgeRow>(
    `SELECT owner_id, name, km_flown, kind, globe_announced, moon_announced, crown_announced
       FROM owls WHERE id = ?`,
    owlId,
  );
  if (!owl || owl.kind !== 'own') return;
  const reached = BADGE_ORDER.filter((badge) => hasBadge(owl.km_flown, badge));
  const fresh = reached.filter((badge) => owl[`${badge}_announced`] === 0);
  const highest = reached.at(-1);
  if (fresh.length === 0 || highest === undefined) return;
  for (const badge of fresh) {
    ctx.db.run(`UPDATE owls SET ${ANNOUNCED[badge].column} = 1 WHERE id = ?`, owlId);
  }
  // Only a badge that was not announced yet is celebrated (the highest of the new ones).
  const celebrated = fresh.at(-1) ?? highest;
  addSystemMessage(
    ctx,
    owl.owner_id,
    ANNOUNCED[celebrated].message,
    { owl: owl.name ?? '', km: Math.round(owl.km_flown) },
    now,
    after,
  );
  after?.(() => ctx.hub.notify(owl.owner_id, 'owls'));
}

/** At the start: owls that earned a badge before (or while the server was down). */
export function announceAllBadges(ctx: Context, now: number): number {
  const owls = ctx.db.all<{ id: string }>(
    `SELECT id FROM owls WHERE kind = 'own' AND (
        (globe_announced = 0 AND km_flown > ?)
     OR (moon_announced = 0 AND km_flown >= ?)
     OR (crown_announced = 0 AND km_flown >= ?))`,
    BADGES.globe.KM,
    BADGES.moon.KM,
    BADGES.crown.KM,
  );
  ctx.db.transaction(() => {
    for (const owl of owls) announceBadges(ctx, owl.id, now);
  });
  return owls.length;
}
