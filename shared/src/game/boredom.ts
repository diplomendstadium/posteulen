/**
 * Bored owls (SPEC 9.2.9): own adult owls count the time since they last came home from a flight
 * to people. The server adds it up once a day – only while the owl is at home or on a flight (not
 * in the rescue centre, brooding, lent to the post office or on holiday, and not while its player
 * is on holiday). After 21 days the owl is bored; after 7 more it flies off into freedom, unless
 * it is the last adult owl of its player. Owls of a player who has never had a contact with
 * another person never get bored: the time only counts from the first such contact on.
 */
import { BOREDOM, TIME } from '../constants.ts';
import type { OwlState } from './owls.ts';

/**
 * States in which the time counts (the owl could be sent to someone) – and only once its player
 * has had a contact with another person (`knowsPeople`).
 */
export function idleCounts(state: OwlState, onVacation: boolean, knowsPeople = true): boolean {
  return knowsPeople && !onVacation && (state === 'home' || state === 'flying');
}

/** The idle time after a daily count: + the time since the last count, if it counts. */
export function idleAfter(input: {
  readonly idleMs: number;
  readonly idleAt: number | null;
  readonly now: number;
  readonly counts: boolean;
}): number {
  if (!input.counts || input.idleAt === null) return input.idleMs;
  return input.idleMs + Math.max(0, input.now - input.idleAt);
}

export function isBored(idleMs: number): boolean {
  return idleMs >= BOREDOM.BORED_AFTER_DAYS * TIME.DAY;
}

/** Bored for 7 more days: it flies off – at home, and only if it is not the last adult owl. */
export function escapes(input: {
  readonly idleMs: number;
  readonly state: OwlState;
  readonly otherAdults: number;
}): boolean {
  return (
    input.state === 'home' &&
    input.otherAdults > 0 &&
    input.idleMs >= (BOREDOM.BORED_AFTER_DAYS + BOREDOM.ESCAPE_AFTER_DAYS) * TIME.DAY
  );
}
