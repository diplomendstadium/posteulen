/**
 * Badges after the names of own owls (SPEC 9.2.1): 🌍 for more than the Earth's circumference
 * (40,030 km), 🌙 from the distance Earth–Moon (384,400 km), 👑 from 1,000,000 km. Only the
 * highest is shown. Names are stored without a badge; it is added wherever a name is shown or
 * written into a new message.
 */
import { BADGES } from '../constants.ts';

export type OwlBadge = keyof typeof BADGES;

/** From the lowest to the highest badge. */
export const BADGE_ORDER: readonly OwlBadge[] = ['globe', 'moon', 'crown'];

/** Whether an owl has reached a badge: more than the circumference, at least the moon/crown. */
export function hasBadge(km: number, badge: OwlBadge): boolean {
  return badge === 'globe' ? km > BADGES.globe.KM : km >= BADGES[badge].KM;
}

/** The highest badge an owl has earned with these kilometres, or null. */
export function owlBadge(km: number): OwlBadge | null {
  for (const badge of [...BADGE_ORDER].reverse()) if (hasBadge(km, badge)) return badge;
  return null;
}

/** The name as shown everywhere: with the symbol of its badge. */
export function owlDisplayName(name: string, badge: OwlBadge | null | undefined): string {
  return badge ? `${name} ${BADGES[badge].SYMBOL}` : name;
}
