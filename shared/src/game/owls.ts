/** Owl states and allowed actions (SPEC 9.2.5) – used by server checks and the UI alike. */
import { LETTER, OWL } from '../constants.ts';
import { SPECIES, type Species } from '../species.ts';

export type OwlState =
  'home' | 'flying' | 'gift_flight' | 'sick' | 'self_care' | 'vet' | 'brooding' | 'menagerie';

export type OwlKind = 'own' | 'loan' | 'bot';

export interface OwlFacts {
  readonly state: OwlState;
  readonly kind: OwlKind;
  readonly isChick: boolean;
}

export function speciesById(id: string): Species | undefined {
  return SPECIES.find((species) => species.id === id);
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

/** Petting and feeding (9.2.5): at home, also sick, in own care, brooding or as a chick. */
export function canCare(owl: OwlFacts): boolean {
  return ['home', 'sick', 'self_care', 'brooding'].includes(owl.state);
}

/** Menagerie: own adult healthy owls at home, not brooding (9.7). */
export function canLendToMenagerie(owl: OwlFacts): boolean {
  return owl.kind === 'own' && !owl.isChick && owl.state === 'home';
}

export function canRelease(owl: OwlFacts): boolean {
  return owl.kind === 'own' && !owl.isChick && ['home', 'sick', 'self_care'].includes(owl.state);
}

export function canRename(owl: OwlFacts): boolean {
  return owl.kind === 'own';
}

/** Regeneration only at home – also sick, in own care or brooding (9.3). */
export function regenerates(state: OwlState): boolean {
  return ['home', 'sick', 'self_care', 'brooding'].includes(state);
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
