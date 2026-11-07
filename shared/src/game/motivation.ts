/**
 * Motivation of an owl and the four interactions (v0.5, SPEC 9.3a). Motivation is kept in
 * tenths (8–12 = 0.8–1.2). Pure functions; the server stores the values.
 */
import { MOTIVATION, OWL } from '../constants.ts';

export type Interaction = 'water' | 'pet' | 'feed' | 'snack';

export const INTERACTIONS: readonly Interaction[] = ['water', 'pet', 'feed', 'snack'];

export function clampMotivation(tenths: number): number {
  return Math.max(MOTIVATION.MIN, Math.min(MOTIVATION.MAX, Math.round(tenths)));
}

/** Factor for speed, energy and recovery of a trip (e.g. 11 → 1.1). */
export function motivationFactor(tenths: number): number {
  return clampMotivation(tenths) / 10;
}

/** Difference to 1.0 in percent (e.g. 11 → +10, 8 → −20). */
export function motivationPercent(tenths: number): number {
  return (clampMotivation(tenths) - 10) * 10;
}

/** Every night at 00:00 UTC: −0.1, never below 0.8. */
export function nightlyMotivation(tenths: number): number {
  return clampMotivation(tenths - MOTIVATION.STEP);
}

/** Each kind of interaction raises it by 0.1 once per day, never above 1.2. */
export function motivationAfter(tenths: number, alreadyToday: boolean): number {
  return alreadyToday ? clampMotivation(tenths) : clampMotivation(tenths + MOTIVATION.STEP);
}

/** Share of the bar (0 = 0.8, 1 = 1.2). */
export function motivationShare(tenths: number): number {
  return (clampMotivation(tenths) - MOTIVATION.MIN) / (MOTIVATION.MAX - MOTIVATION.MIN);
}

/** The interactions done on `today`, from the day of the last one of each kind. */
export function interactionsOn(
  last: Readonly<Record<Interaction, string | null>>,
  today: string,
): Interaction[] {
  return INTERACTIONS.filter((kind) => last[kind] === today);
}

/** A day counts as cared for (sickness bonus, 9.8) with two different interactions. */
export function isCareDay(interactionsToday: number): boolean {
  return interactionsToday >= OWL.CARE_DAY_INTERACTIONS;
}
