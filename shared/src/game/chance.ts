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

export interface LoanIdentity {
  readonly name: string;
  readonly sex: 'f' | 'm';
  /** Share of the start energy range (60–100 %, 9.3), in [0, 1). */
  readonly energyShare: number;
}

/**
 * Name, sex and start energy of a loan owl for one user, day and species, derived from HMAC
 * bytes (9.6: deterministic, nothing stored). The energy is known in advance, so the letter
 * preview can offer the loan owls of the day with an exact flight plan (8.4 step 4).
 */
export function loanIdentity(hmac: Uint8Array): LoanIdentity {
  const value = (((hmac[0] ?? 0) << 16) | ((hmac[1] ?? 0) << 8) | (hmac[2] ?? 0)) >>> 0;
  return {
    name: OWL_NAMES[value % OWL_NAMES.length] ?? 'Momo',
    sex: ((hmac[3] ?? 0) & 1) === 0 ? 'f' : 'm',
    energyShare: (((hmac[4] ?? 0) << 8) | (hmac[5] ?? 0)) / 65536,
  };
}

/** Attempts per species before falling back to the next free name of the list. */
const NAME_ATTEMPTS = 16;

/**
 * The identities of the day's offer for one user, with three different names (9.6). The first
 * attempt keeps the derivation of v0.1; on a clash the next attempts derive new bytes.
 */
export function loanIdentities(
  offer: readonly string[],
  derive: (species: string, attempt: number) => Uint8Array,
): LoanIdentity[] {
  const taken = new Set<string>();
  return offer.map((species) => {
    let identity = loanIdentity(derive(species, 0));
    for (let attempt = 1; taken.has(identity.name) && attempt < NAME_ATTEMPTS; attempt++) {
      identity = loanIdentity(derive(species, attempt));
    }
    const start = OWL_NAMES.indexOf(identity.name);
    for (let step = 1; taken.has(identity.name) && step < OWL_NAMES.length; step++) {
      const name = OWL_NAMES[(start + step) % OWL_NAMES.length];
      if (name !== undefined && !taken.has(name)) identity = { ...identity, name };
    }
    taken.add(identity.name);
    return identity;
  });
}

/** Menagerie wage: 10 % of the species price, in tenths (9.7). */
export function menagerieWage(price: number): number {
  return Math.round(price * 10 * 0.1);
}

/** Price of the species in whole gold (for wages). */
export function speciesPrice(id: string): number {
  return SPECIES.find((species) => species.id === id)?.price ?? 0;
}
