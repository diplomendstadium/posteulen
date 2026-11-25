/**
 * Holiday mode (SPEC 8.10, 9.12): rules for planning a holiday and the straight flights of the
 * owls to the owl care station on the island of Inchlonaig in Loch Lomond and back. Pure
 * functions with the clock passed in.
 *
 * The owls fly at the speed of their species (chicks at chick speed) along the great circle,
 * without using energy and without sleeping – so the return can be planned to the minute: all
 * owls are home exactly when the holiday ends. If there is not enough time to reach the island
 * and come back, an owl turns round on the way in time.
 */
import { FLIGHT, TIME, VACATION } from '../constants.ts';
import { distanceKm, interpolate, type Point } from './geo.ts';

export type VacationState = 'planned' | 'active' | 'done' | 'cancelled';

export interface VacationRecord {
  readonly startsAt: number;
  readonly endsAt: number;
  readonly state: VacationState;
}

export type VacationProblem =
  | 'vacation_exists'
  | 'vacation_start_past'
  | 'vacation_start_too_late'
  | 'vacation_too_short'
  | 'vacation_too_long'
  | 'vacation_year_full';

/** Some slack for "start now": the moment the form was sent may lie a little in the past. */
export const START_SLACK_MS = 10 * TIME.MINUTE;

/** The calendar year (UTC) a holiday counts for: the year of its start. */
export function vacationYear(startsAt: number): number {
  return new Date(startsAt).getUTCFullYear();
}

/** Holidays that count in a year: all but those cancelled before they began. */
export function vacationsUsed(year: number, existing: readonly VacationRecord[]): number {
  return existing.filter(
    (vacation) => vacation.state !== 'cancelled' && vacationYear(vacation.startsAt) === year,
  ).length;
}

/** Why this holiday cannot be planned, or null (SPEC 8.10). */
export function vacationProblem(input: {
  readonly startsAt: number;
  readonly endsAt: number;
  readonly now: number;
  readonly existing: readonly VacationRecord[];
}): VacationProblem | null {
  const { startsAt, endsAt, now, existing } = input;
  if (existing.some((vacation) => vacation.state === 'planned' || vacation.state === 'active'))
    return 'vacation_exists';
  if (startsAt < now - START_SLACK_MS) return 'vacation_start_past';
  if (startsAt > now + VACATION.PLAN_AHEAD_DAYS * TIME.DAY) return 'vacation_start_too_late';
  const start = Math.max(startsAt, now);
  if (endsAt - start < VACATION.MIN_HOURS * TIME.HOUR) return 'vacation_too_short';
  if (endsAt - start > VACATION.MAX_DAYS * TIME.DAY) return 'vacation_too_long';
  if (vacationsUsed(vacationYear(start), existing) >= VACATION.PER_YEAR)
    return 'vacation_year_full';
  return null;
}

/**
 * The day from which inactivity counts again after a holiday (SPEC 9.10): the holiday does not
 * count as days away. Last active on day L, holiday from day S to day E: reference L + (E − max(S, L)).
 */
export function inactivityReference(
  lastActiveDay: string,
  startsAt: number,
  endedAt: number,
): string {
  const day = (value: string): number => Math.round(Date.parse(`${value}T00:00:00Z`) / TIME.DAY);
  const last = day(lastActiveDay);
  const start = Math.floor(startsAt / TIME.DAY);
  const end = Math.floor(endedAt / TIME.DAY);
  const reference = last + Math.max(0, end - Math.max(start, last));
  return new Date(reference * TIME.DAY).toISOString().slice(0, 10);
}

/** Speed of an owl on its holiday flights in km/h. */
export function vacationSpeedKmh(speedFactor: number, chick: boolean): number {
  return chick ? FLIGHT.CHICK_SPEED_KMH : FLIGHT.BASE_SPEED_KMH * speedFactor;
}

/**
 * One owl's holiday trip: from `from` (departure `outAt`) straight towards the island, from
 * `backFrom` (the island, or the point where it turned round; departure `backAt`) straight home.
 */
export interface VacationTrip {
  readonly from: Point;
  readonly outAt: number;
  readonly speedKmh: number;
  readonly backFrom: Point;
  readonly backAt: number;
  readonly home: Point;
  readonly homeAt: number;
}

export type TripPhase = 'out' | 'island' | 'back' | 'home';

export const ISLAND: Point = VACATION.ISLAND;

function hoursToMs(hours: number): number {
  return Math.round(hours * TIME.HOUR);
}

/** Where the owl is on the way to the island `ms` after leaving `from` (it stops at the island). */
function outboundPoint(trip: { from: Point; speedKmh: number }, ms: number): Point {
  const total = distanceKm(trip.from, ISLAND);
  if (total < 1e-9) return ISLAND;
  return interpolate(trip.from, ISLAND, Math.min(1, (trip.speedKmh * ms) / TIME.HOUR / total));
}

/** Position and phase of a trip at a moment. */
export function tripPosition(trip: VacationTrip, at: number): { point: Point; phase: TripPhase } {
  if (at >= trip.homeAt) return { point: trip.home, phase: 'home' };
  if (at >= trip.backAt) {
    const span = trip.homeAt - trip.backAt;
    const fraction = span <= 0 ? 1 : (at - trip.backAt) / span;
    return { point: interpolate(trip.backFrom, trip.home, fraction), phase: 'back' };
  }
  const elapsed = Math.max(0, at - trip.outAt);
  const reached = trip.speedKmh * (elapsed / TIME.HOUR) >= distanceKm(trip.from, ISLAND) - 1e-6;
  return { point: outboundPoint(trip, elapsed), phase: reached ? 'island' : 'out' };
}

/** When the owl reaches the island, or null if it turns round before. */
export function islandArrival(trip: VacationTrip): number | null {
  const arrival = trip.outAt + hoursToMs(distanceKm(trip.from, ISLAND) / trip.speedKmh);
  return arrival <= trip.backAt ? arrival : null;
}

/**
 * Plans the rest of a trip from a point on the way to the island (or from home): on to the island
 * and back so that the owl is home exactly at `endsAt`; if that is too far, it turns round on the
 * way at the right moment; if even turning round at once is too late, it turns round at once.
 */
export function planTrip(input: {
  readonly at: Point;
  readonly now: number;
  readonly endsAt: number;
  readonly home: Point;
  readonly speedKmh: number;
}): VacationTrip {
  const { at, now, endsAt, home, speedKmh } = input;
  const hours = (km: number): number => km / speedKmh;
  const left = Math.max(0, endsAt - now) / TIME.HOUR;
  const toIsland = distanceKm(at, ISLAND);
  const islandHome = distanceKm(ISLAND, home);
  const base = { from: at, outAt: now, speedKmh, home };
  if (hours(toIsland + islandHome) <= left) {
    return {
      ...base,
      backFrom: ISLAND,
      backAt: endsAt - hoursToMs(hours(islandHome)),
      homeAt: endsAt,
    };
  }
  const direct = distanceKm(at, home);
  if (hours(direct) >= left) {
    return { ...base, backFrom: at, backAt: now, homeAt: now + hoursToMs(hours(direct)) };
  }
  // Turn round after x km towards the island: x / v + distance(turn, home) / v = time left.
  let low = 0;
  let high = toIsland;
  for (let step = 0; step < 60; step++) {
    const middle = (low + high) / 2;
    const turn = interpolate(at, ISLAND, middle / toIsland);
    if (hours(middle + distanceKm(turn, home)) <= left) low = middle;
    else high = middle;
  }
  const turn = toIsland < 1e-9 ? at : interpolate(at, ISLAND, low / toIsland);
  return { ...base, backFrom: turn, backAt: now + hoursToMs(hours(low)), homeAt: endsAt };
}

/** Holiday ended early (SPEC 8.10): every owl not yet on its way back sets off home at once. */
export function endTripEarly(trip: VacationTrip, now: number): VacationTrip {
  if (now >= trip.backAt) return trip;
  const { point } = tripPosition(trip, now);
  return {
    ...trip,
    backFrom: point,
    backAt: now,
    homeAt: now + hoursToMs(distanceKm(point, trip.home) / trip.speedKmh),
  };
}

/** The holder moved during the holiday (9.4.6): the rest of the trip leads to the new home. */
export function tripAfterMove(
  trip: VacationTrip,
  now: number,
  home: Point,
  endsAt: number,
): VacationTrip {
  const { point } = tripPosition(trip, now);
  if (now >= trip.backAt) {
    return {
      ...trip,
      backFrom: point,
      backAt: now,
      home,
      homeAt: now + hoursToMs(distanceKm(point, home) / trip.speedKmh),
    };
  }
  return planTrip({ at: point, now, endsAt, home, speedKmh: trip.speedKmh });
}
