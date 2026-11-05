/**
 * Energy, feeding, petting and the care mask (SPEC 9.3). Energy is stored with decimals
 * together with the time it was last set and computed on reading.
 */
import { OWL, TIME } from '../constants.ts';
import type { Species } from '../species.ts';

export interface StoredEnergy {
  readonly energy: number;
  readonly energyAt: number;
}

/** Regeneration per hour at home: 10 % of the maximum × recovery factor. */
export function regenPerHour(species: Species): number {
  return species.maxEnergy * OWL.REGEN_SHARE_PER_HOUR * species.recoveryFactor;
}

/** Current energy; only owls at home regenerate (also sick or brooding, 9.3). */
export function energyNow(
  stored: StoredEnergy,
  species: Species,
  now: number,
  regenerating: boolean,
): number {
  const base = Math.min(stored.energy, species.maxEnergy);
  if (!regenerating || now <= stored.energyAt) return Math.max(0, base);
  const gained = ((now - stored.energyAt) / TIME.HOUR) * regenPerHour(species);
  return Math.max(0, Math.min(species.maxEnergy, base + gained));
}

/** Energy is always shown rounded to whole points (9.2.1). */
export function displayEnergy(energy: number): number {
  return Math.round(energy);
}

/** Energy after feeding: +10 % of the maximum × recovery factor, capped (9.3). */
export function energyAfterFeeding(current: number, species: Species): number {
  return Math.min(
    species.maxEnergy,
    current + species.maxEnergy * OWL.FEED_SHARE * species.recoveryFactor,
  );
}

/** Random start energy 60–100 % of the maximum (9.2.3); `random` in [0, 1). */
export function startEnergy(species: Species, random: number): number {
  const share =
    OWL.START_ENERGY_MIN_SHARE + (OWL.START_ENERGY_MAX_SHARE - OWL.START_ENERGY_MIN_SHARE) * random;
  return Math.round(species.maxEnergy * share * 100) / 100;
}

function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / TIME.DAY);
}

export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

const MASK_BITS = OWL.CARE_BONUS_WINDOW_DAYS;
const MASK_ALL = (1 << MASK_BITS) - 1;

/**
 * Care mask: bit 0 is `maskDay`, bit n the day n days earlier; 14 bits (9.3). Marking a day
 * shifts the mask forward to `today` first.
 */
export function markCare(
  mask: number,
  maskDay: string | null,
  today: string,
): { mask: number; maskDay: string } {
  const shift = maskDay === null ? MASK_BITS : Math.max(0, daysBetween(maskDay, today));
  const shifted = shift >= MASK_BITS ? 0 : (mask << shift) & MASK_ALL;
  return { mask: shifted | 1, maskDay: today };
}

/** Number of care days in the 14 days before `day` (the day of the sickness roll, 9.3). */
export function careDaysBefore(mask: number, maskDay: string | null, day: string): number {
  if (maskDay === null) return 0;
  let count = 0;
  for (let back = 1; back <= MASK_BITS; back++) {
    // Bit n is the day n days before maskDay.
    const offset = back - daysBetween(maskDay, day);
    if (offset < 0 || offset >= MASK_BITS) continue;
    if (mask & (1 << offset)) count++;
  }
  return count;
}

export function hasCareBonus(mask: number, maskDay: string | null, day: string): boolean {
  return careDaysBefore(mask, maskDay, day) >= OWL.CARE_BONUS_MIN_DAYS;
}
