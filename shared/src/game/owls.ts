/** Owl states and allowed actions (SPEC 9.2.5) – used by server checks and the UI alike. */
import { GOLD, LETTER, OWL } from '../constants.ts';
import { SPECIES, type Cargo, type Species } from '../species.ts';

/**
 * v1.3: `sick` means "in the rescue centre" (SPEC 9.8). The states of the former treatments
 * (nursing at home, owl vet) no longer occur; the update made such owls healthy.
 */
export type OwlState = 'home' | 'flying' | 'gift_flight' | 'sick' | 'brooding' | 'menagerie';

export type OwlKind = 'own' | 'loan' | 'bot';

export interface OwlFacts {
  readonly state: OwlState;
  readonly kind: OwlKind;
  readonly isChick: boolean;
  /** v0.5: species is mythical (the phoenix, see Species.mythical). */
  readonly mythical?: boolean;
}

export function speciesById(id: string): Species | undefined {
  return SPECIES.find((species) => species.id === id);
}

/** v0.5: the phoenix – no loan offer, no eggs, no Menagerie, no bot owl. */
export function isMythical(speciesId: string): boolean {
  return speciesById(speciesId)?.mythical === true;
}

/** Letter, gold, gift and menagerie: only adult owls at home and healthy (or a loan owl). */
export function canTransport(owl: OwlFacts): boolean {
  return owl.state === 'home' && !owl.isChick && owl.kind !== 'bot';
}

/** Own and loan owls fly to up to LETTER.MAX_RECIPIENTS recipients (8.4, 9.6; loan owls since v0.4). */
export function maxRecipients(owl: OwlFacts): number {
  return owl.kind === 'bot' ? 1 : LETTER.MAX_RECIPIENTS;
}

export function canGift(owl: OwlFacts): boolean {
  return canTransport(owl) && owl.kind === 'own';
}

/**
 * Petting and feeding at home (9.2.5): at home, brooding or as a chick. A sick owl is cared for
 * in the rescue centre only (SPEC 8.13).
 */
export function canCare(owl: OwlFacts): boolean {
  return ['home', 'brooding'].includes(owl.state);
}

/** Menagerie: own adult healthy owls at home, not brooding, never a phoenix (9.7, v0.5). */
export function canLendToMenagerie(owl: OwlFacts): boolean {
  return owl.kind === 'own' && !owl.isChick && owl.state === 'home' && owl.mythical !== true;
}

/** The state allows a release (9.2.5); whether the stock does, says `releaseAllowed`. */
export function canRelease(owl: OwlFacts): boolean {
  return owl.kind === 'own' && !owl.isChick && ['home', 'sick'].includes(owl.state);
}

/**
 * v0.8.5: owls may only be released while the player has more than 20 own owls (the count of
 * the buying limit: chicks count, loan owls and owls on a gift flight not; 9.2.8). At 21 one
 * suitable owl can go; then the limit is reached.
 */
export function releaseAllowed(owl: OwlFacts, ownOwlCount: number): boolean {
  return canRelease(owl) && ownOwlCount > OWL.RELEASE_ABOVE_OWN_OWLS;
}

export function canRename(owl: OwlFacts): boolean {
  return owl.kind === 'own';
}

/** Regeneration only at home – also brooding and in the rescue centre (9.3). */
export function regenerates(state: OwlState): boolean {
  return ['home', 'sick', 'brooding'].includes(state);
}

/** Renaming once per calendar year per owl; the first naming does not count (9.2.4). */
export function canRenameInYear(renamedYear: number | null, year: number): boolean {
  return renamedYear === null || renamedYear < year;
}

/** Buying needs fewer than 50 own owls (chicks count, loan owls not, 9.2.3). */
export function canBuyMore(ownOwlCount: number): boolean {
  return ownOwlCount < OWL.MAX_OWN_OWLS;
}

/** Random sex at purchase or hatching; `random` in [0, 1). */
export function randomSex(random: number): 'f' | 'm' {
  return random < 0.5 ? 'f' : 'm';
}

/** v0.10: what a load needs – a parchment, and possibly gold (SPEC 9.2.1). */
export interface Load {
  readonly parchment: 'small' | 'large';
  readonly gold?: boolean;
}

const CARGO_RANK: Readonly<Record<Cargo, number>> = { short: 0, long: 1, gold: 2 };

/** v0.10: the carrying capacity a load needs (gold > long parchment > short parchment). */
export function cargoNeeded(load: Load): Cargo {
  if (load.gold) return 'gold';
  return load.parchment === 'large' ? 'long' : 'short';
}

/** v0.10: the carrying capacity of a species (unknown species: as little as possible). */
export function cargoOf(speciesId: string): Cargo {
  return speciesById(speciesId)?.cargo ?? 'short';
}

/** v0.10: whether an owl of this capacity can carry what is needed. */
export function cargoCovers(cargo: Cargo, needed: Cargo): boolean {
  return CARGO_RANK[cargo] >= CARGO_RANK[needed];
}

/** v0.10: whether an owl of this species can carry the load (owls of players only). */
export function canCarry(speciesId: string, load: Load): boolean {
  return cargoCovers(cargoOf(speciesId), cargoNeeded(load));
}

/** v0.10: price of a loan owl in tenths – 0.2 gold for species that carry gold, else 0.1. */
export function loanPrice(speciesId: string): number {
  return cargoOf(speciesId) === 'gold' ? GOLD.LOAN_PRICE_GOLD : GOLD.LOAN_PRICE;
}

/**
 * v0.10: owl biscuit and favourite snack (SPEC 9.3). Each kind once a day in any case, also with
 * full energy; more often only while the energy is not full right now (each time paid).
 */
export function canFeedAgain(input: {
  readonly fedToday: boolean;
  readonly energy: number;
  readonly maxEnergy: number;
}): boolean {
  return !input.fedToday || input.energy < input.maxEnergy;
}

/** What the owl overview needs to know to sort an owl (SPEC 8.5). */
export interface OverviewOwl {
  readonly name: string | null;
  readonly ready: boolean;
  /** UTC day since when the player has the owl (loan owls: the offer day). */
  readonly ownedSince: string;
  /** When the owl row was created (bought, hatched, borrowed) – tie-break within a day. */
  readonly createdAt: number;
  /** When the owl left the player or became busy (flight, Menagerie, rescue centre, brooding, chick). */
  readonly awaySince: number | null;
}

/**
 * v1.3: the order of the owl overview (SPEC 8.5) – own and loan owls together. On top the owls
 * ready for post, the one the player has had longest first; below all others, the one that has
 * been away or busy longest first (unknown last). Ties by name.
 */
export function overviewOrder<T extends OverviewOwl>(
  owls: readonly T[],
  compareNames: (a: string, b: string) => number,
): { readonly ready: T[]; readonly busy: T[] } {
  const byName = (a: T, b: T): number => compareNames(a.name ?? '', b.name ?? '');
  return {
    ready: owls
      .filter((owl) => owl.ready)
      .sort(
        (a, b) =>
          a.ownedSince.localeCompare(b.ownedSince) || a.createdAt - b.createdAt || byName(a, b),
      ),
    busy: owls
      .filter((owl) => !owl.ready)
      .sort((a, b) => {
        const since = (owl: T): number => owl.awaySince ?? Number.POSITIVE_INFINITY;
        const difference = since(a) - since(b);
        return Number.isNaN(difference) || difference === 0 ? byName(a, b) : difference;
      }),
  };
}
