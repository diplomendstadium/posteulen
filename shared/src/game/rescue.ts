/**
 * The owl rescue centre (SPEC 8.13, 9.8): pure rules with injectable chance.
 */
import { RESCUE } from '../constants.ts';
import { SPECIES, type Species } from '../species.ts';

/** The five interactions in the rescue centre. */
export type RescueAction = 'medicine' | 'feed' | 'snack' | 'pet' | 'water';
/** v1.3.1: the free ones first – water, stroking, medicine – then biscuit and snack. */
export const RESCUE_ACTIONS: readonly RescueAction[] = [
  'water',
  'pet',
  'medicine',
  'feed',
  'snack',
];

/** Interactions a sick own owl needs to get well: 6–25 (v1.3.1), equally likely. */
export function ownCareNeeded(random: number): number {
  const span = RESCUE.OWN_MAX_CARE - RESCUE.OWN_MIN_CARE + 1;
  return RESCUE.OWN_MIN_CARE + Math.min(span - 1, Math.floor(random * span));
}

/**
 * Interactions a wild sick owl needs: price × 4 × a factor of 0.7–1.3 (v1.3.1; rounded, at
 * least 1). Rolled once when it comes in – wild owls from before keep their number.
 */
export function wildCareNeeded(price: number, random: number): number {
  const factor =
    RESCUE.WILD_RANDOM_MIN + (RESCUE.WILD_RANDOM_MAX - RESCUE.WILD_RANDOM_MIN) * random;
  return Math.max(1, Math.round(price * RESCUE.WILD_PRICE_FACTOR * factor));
}

/** The species that can come in as wild sick owls (never the phoenix or the Great Horned Owl). */
export function wildSpecies(): readonly Species[] {
  return SPECIES.filter(
    (species) => !(RESCUE.WILD_EXCLUDED as readonly string[]).includes(species.id),
  );
}

/** A random wild species. */
export function pickWildSpecies(random: number): Species {
  const pool = wildSpecies();
  const picked = pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
  if (!picked) throw new Error('no wild species');
  return picked;
}

/** Progress in whole per cent (0–100); 100 only once all interactions are done. */
export function rescueProgress(done: number, needed: number): number {
  if (needed <= 0 || done >= needed) return 100;
  return Math.min(99, Math.floor((done * 100) / needed));
}

/**
 * Whether an interaction may be done now: each once a day, only petting as often as one likes
 * (it still counts once a day). `lastOn` is the UTC day it was last done.
 */
export function rescueActionAllowed(
  action: RescueAction,
  lastOn: string | null,
  today: string,
): boolean {
  return action === 'pet' || lastOn !== today;
}

/** Whether the interaction counts towards getting well: each kind once a day. */
export function rescueActionCounts(lastOn: string | null, today: string): boolean {
  return lastOn !== today;
}

/** A healed wild owl stays with the player (true) or flies off into freedom. */
export function wildOwlStays(random: number): boolean {
  return random < RESCUE.STAY_CHANCE;
}
