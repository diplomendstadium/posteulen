/**
 * v1.3.1: pairs of owls (SPEC 9.9). A female own owl lays eggs more often after a return home
 * if a male own owl of her species was ready at home together with her, or if she rested at a
 * recipient while a male of her species was ready at home there. Pure functions over the times
 * an owl was not ready at home (away, sick, brooding).
 */
import { OWL, TIME } from '../constants.ts';
import type { AwayPeriod } from './energy.ts';

/** When an owl was ready at home: from `from` on, except during `notReady`. */
export interface ReadyTimes {
  /** Start of ownership by the current holder (and, for a former chick, when it grew up). */
  readonly from: number;
  /** Times away from home, sick or brooding (`until` null: still). */
  readonly notReady: readonly AwayPeriod[];
}

/** Milliseconds of [start, end) in which both owls were ready at home. */
export function readyTogether(
  a: ReadyTimes,
  b: ReadyTimes,
  start: number,
  end: number,
  now: number,
): number {
  const from = Math.max(start, a.from, b.from);
  if (end <= from) return 0;
  const blocked = merge(
    [...a.notReady, ...b.notReady].map((period) => ({
      since: Math.max(from, period.since),
      until: Math.min(end, period.until ?? now),
    })),
  );
  let free = end - from;
  for (const period of blocked) free -= period.until - period.since;
  return Math.max(0, free);
}

/** Sorted, merged, non-empty intervals. */
function merge(periods: readonly { since: number; until: number }[]) {
  const sorted = periods
    .filter((period) => period.until > period.since)
    .sort((x, y) => x.since - y.since);
  const merged: { since: number; until: number }[] = [];
  for (const period of sorted) {
    const last = merged.at(-1);
    if (last && period.since <= last.until) last.until = Math.max(last.until, period.until);
    else merged.push({ ...period });
  }
  return merged;
}

/**
 * Rule at home: on at least 2 of the last 7 UTC days (the day of `at` and the six before) the
 * two owls were ready at home together for more than 6 hours.
 */
export function pairedAtHome(female: ReadyTimes, male: ReadyTimes, at: number): boolean {
  const today = Math.floor(at / TIME.DAY) * TIME.DAY;
  let days = 0;
  for (let back = 0; back < OWL.PAIR_WINDOW_DAYS; back++) {
    const start = today - back * TIME.DAY;
    const end = Math.min(start + TIME.DAY, at);
    if (readyTogether(female, male, start, end, at) > OWL.PAIR_MIN_HOURS * TIME.HOUR) days++;
    if (days >= OWL.PAIR_MIN_DAYS) return true;
  }
  return false;
}

/**
 * Rule on a visit: while the female rested at a recipient (`restStart` to `restEnd`), a male of
 * her species was ready at home there for at least 2 hours of it.
 */
export function metOnVisit(male: ReadyTimes, restStart: number, restEnd: number): boolean {
  const visitor: ReadyTimes = { from: restStart, notReady: [] };
  return (
    readyTogether(visitor, male, restStart, restEnd, restEnd) >= OWL.VISIT_MIN_HOURS * TIME.HOUR
  );
}

/**
 * The chance of eggs after a return home: 1/100, twice as high with one of the two rules,
 * three times as high with both (not four times).
 */
export function eggProbability(pairedHome: boolean, metVisit: boolean): number {
  return OWL.EGG_PROBABILITY * (1 + (pairedHome ? 1 : 0) + (metVisit ? 1 : 0));
}
