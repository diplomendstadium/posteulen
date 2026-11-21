/**
 * Random game events (SPEC 9.6–9.9): sickness, eggs, chicks, the daily menagerie offer and
 * loan owl names. Pure functions: the random numbers (in [0, 1)) or HMAC bytes are passed in.
 */
import { MOTIVATION, OWL } from '../constants.ts';
import { OWL_NAMES_F, OWL_NAMES_M, type OwlSex } from '../names-data.ts';

/** The names for each sex (Anhang D); by default the German lists. */
export type NamesFor = (sex: OwlSex) => readonly string[];
const GERMAN_NAMES: NamesFor = (sex) => (sex === 'f' ? OWL_NAMES_F : OWL_NAMES_M);
import { LOAN_TEAMS, SPECIES, type LoanTeam } from '../species.ts';
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

/** Random name from Anhang D (chicks without a name, wild owls); the list of the owl's sex. */
export function randomOwlName(random: number, names: readonly string[] = OWL_NAMES_F): string {
  return names[Math.min(names.length - 1, Math.floor(random * names.length))] ?? 'Momo';
}

/**
 * v1.1: the team of the daily loan offer (9.6) – one of the four teams, never the team of the
 * day before (`previous`, null if unknown or none); `random` is called once.
 */
export function pickTeam(random: () => number, previous: LoanTeam | null = null): LoanTeam {
  const teams = (Object.keys(LOAN_TEAMS) as LoanTeam[]).filter((team) => team !== previous);
  return teams[Math.min(teams.length - 1, Math.floor(random() * teams.length))] ?? 'A';
}

/** The species of a team, in the order of the team list. */
export function teamSpecies(team: LoanTeam): readonly string[] {
  return LOAN_TEAMS[team];
}

export interface LoanIdentity {
  readonly name: string;
  readonly sex: 'f' | 'm';
  /** Share of the start energy range (60–100 %, 9.3), in [0, 1). */
  readonly energyShare: number;
  /** v0.5: motivation in tenths, 8, 9 or 10. */
  readonly motivation: number;
}

/**
 * Name, sex and start energy of a loan owl for one user, day and species, derived from HMAC
 * bytes (9.6: deterministic, nothing stored). The energy is known in advance, so the letter
 * preview can offer the loan owls of the day with an exact flight plan (8.4 step 4).
 */
export function loanIdentity(hmac: Uint8Array, namesFor: NamesFor = GERMAN_NAMES): LoanIdentity {
  const value = (((hmac[0] ?? 0) << 16) | ((hmac[1] ?? 0) << 8) | (hmac[2] ?? 0)) >>> 0;
  const sex: OwlSex = ((hmac[3] ?? 0) & 1) === 0 ? 'f' : 'm';
  // The name comes from the list of the owl's sex (Anhang D).
  const names = namesFor(sex);
  return {
    name: names[value % names.length] ?? 'Momo',
    sex,
    energyShare: (((hmac[4] ?? 0) << 8) | (hmac[5] ?? 0)) / 65536,
    motivation:
      MOTIVATION.LOAN_MIN + ((hmac[6] ?? 0) % (MOTIVATION.LOAN_MAX - MOTIVATION.LOAN_MIN + 1)),
  };
}

/** v0.7: names rotate in this many groups, one per UTC day (see `loanNamesOn`). */
export const LOAN_NAME_GROUPS = 3;

/**
 * The names a loan owl can get on a day – every third name of a list, by day number.
 * Consecutive days use different groups, so a name never comes back on the two following days
 * (and with it never the same species with the same name). Applied to each list of Anhang D on
 * its own; nothing needs to be stored.
 */
export function loanNamesOn(day: string, names: readonly string[] = OWL_NAMES_F): string[] {
  const dayNumber = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const group = ((dayNumber % LOAN_NAME_GROUPS) + LOAN_NAME_GROUPS) % LOAN_NAME_GROUPS;
  return names.filter((_name, index) => index % LOAN_NAME_GROUPS === group);
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
  namesFor: NamesFor = GERMAN_NAMES,
): LoanIdentity[] {
  const taken = new Set<string>();
  return offer.map((species) => {
    let identity = loanIdentity(derive(species, 0), namesFor);
    for (let attempt = 1; taken.has(identity.name) && attempt < NAME_ATTEMPTS; attempt++) {
      identity = loanIdentity(derive(species, attempt), namesFor);
    }
    // Still a clash: the next free name of the list of its sex (the sex stays).
    const names = namesFor(identity.sex);
    const start = names.indexOf(identity.name);
    for (let step = 1; taken.has(identity.name) && step < names.length; step++) {
      const name = names[(start + step) % names.length];
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
