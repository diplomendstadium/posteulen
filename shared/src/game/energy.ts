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

export interface AwayPeriod {
  readonly since: number;
  /** null while the owl is away. */
  readonly until: number | null;
}

/** Milliseconds of `day` (UTC) that the owl spent at home, given its absences. */
export function homeTimeOn(day: string, away: readonly AwayPeriod[], now: number): number {
  const start = Date.parse(`${day}T00:00:00Z`);
  const end = Math.min(start + TIME.DAY, now);
  let home = Math.max(0, end - start);
  for (const period of away) {
    const from = Math.max(start, period.since);
    const to = Math.min(end, period.until ?? now);
    if (to > from) home -= to - from;
  }
  return Math.max(0, home);
}

/**
 * Care bonus for the sickness roll on `day` (9.3): of the last 14 days before it on which the
 * owl was at home for at least one hour, it was petted or fed on at least 10. Days on the road
 * do not count. Only days since the start of ownership are considered, at most 60 days back.
 */
export function hasCareBonus(input: {
  readonly day: string;
  readonly ownedSince: string;
  readonly careDays: ReadonlySet<string>;
  readonly away: readonly AwayPeriod[];
  readonly now: number;
}): boolean {
  const first = Date.parse(`${input.day}T00:00:00Z`);
  let homeDays = 0;
  let careDays = 0;
  for (let back = 1; back <= OWL.CARE_BONUS_LOOKBACK_DAYS; back++) {
    const day = new Date(first - back * TIME.DAY).toISOString().slice(0, 10);
    if (day < input.ownedSince) break;
    if (homeTimeOn(day, input.away, input.now) < OWL.CARE_BONUS_MIN_HOME_HOURS * TIME.HOUR)
      continue;
    homeDays++;
    if (input.careDays.has(day)) careDays++;
    if (homeDays === OWL.CARE_BONUS_WINDOW_DAYS) break;
  }
  return careDays >= OWL.CARE_BONUS_MIN_DAYS;
}
