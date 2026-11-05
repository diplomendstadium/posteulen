/**
 * Random game events (SPEC 9.6–9.9): sickness, eggs, chicks, the daily menagerie offer and
 * loan owl names. Pure functions: the random numbers (in [0, 1)) or HMAC bytes are passed in.
 */
import { MENAGERIE, OWL } from '../constants.ts';
import { OWL_NAMES } from '../names-data.ts';
import { SPECIES } from '../species.ts';
import { daysBetween } from './energy.ts';

/** Sickness roll at 03:00 UTC: 1/30, with care bonus × 0.3 (9.8). */
export function sicknessProbability(careBonus: boolean): number {
  return OWL.SICKNESS_PROBABILITY * (careBonus ? OWL.CARE_BONUS_FACTOR : 1);
}

export function rollsSick(random: number, careBonus: boolean): boolean {
  return random < sicknessProbability(careBonus);
}

/**
 * Protection period (9.8): rolled only once at least 28 days have passed since the start of
 * ownership – on the 28th day after it for the first time.
 */
export function pastGracePeriod(ownedSince: string, day: string): boolean {
  return daysBetween(ownedSince, day) >= OWL.SICKNESS_GRACE_DAYS;
}

/** Eggs after every return home of a female own owl: 1/100 (9.9). */
export function laysEggs(random: number): boolean {
  return random < OWL.EGG_PROBABILITY;
}

/** 1–3 chicks, uniformly distributed (9.9). */
export function chickCount(random: number): number {
  const span = OWL.CHICKS_MAX - OWL.CHICKS_MIN + 1;
  return OWL.CHICKS_MIN + Math.min(span - 1, Math.floor(random * span));
}

/** With two or three chicks exactly one must be given away (9.9). */
export function giftRequired(count: number): boolean {
  return count >= OWL.CHICK_GIFT_FROM_COUNT;
}

/** Random name from Anhang D (chicks without a name after 24 hours). */
export function randomOwlName(random: number): string {
  return OWL_NAMES[Math.min(OWL_NAMES.length - 1, Math.floor(random * OWL_NAMES.length))] ?? 'Momo';
}

/** Three different species for the daily offer (9.6); `random` is called once per pick. */
export function pickOffer(random: () => number): string[] {
  const pool = SPECIES.map((species) => species.id);
  const picked: string[] = [];
  while (picked.length < MENAGERIE.OFFER_SPECIES_COUNT && pool.length > 0) {
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    const [id] = pool.splice(index, 1);
    if (id) picked.push(id);
  }
  return picked;
}

/**
 * Name and sex of a loan owl for one user, day and species, derived from HMAC bytes
 * (9.6: deterministic, nothing stored).
 */
export function loanIdentity(hmac: Uint8Array): { name: string; sex: 'f' | 'm' } {
  const value = (((hmac[0] ?? 0) << 16) | ((hmac[1] ?? 0) << 8) | (hmac[2] ?? 0)) >>> 0;
  return {
    name: OWL_NAMES[value % OWL_NAMES.length] ?? 'Momo',
    sex: ((hmac[3] ?? 0) & 1) === 0 ? 'f' : 'm',
  };
}

/** Papeterie wage: 10 % of the species price, in tenths (9.7). */
export function papeterieWage(price: number): number {
  return Math.round(price * 10 * 0.1);
}

/** Price of the species in whole gold (for wages). */
export function speciesPrice(id: string): number {
  return SPECIES.find((species) => species.id === id)?.price ?? 0;
}
