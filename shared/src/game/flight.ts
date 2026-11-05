/**
 * Owl flight (SPEC 9.4, 9.9): step-wise simulation of the whole route at departure, a compact
 * segment list for storage, interpolation of the position at any time, and re-planning from
 * the current state (move of home, SPEC 9.4.6; turning back, SPEC 9.5). Pure functions: the
 * environment (land mask, day/night) and all times are passed in.
 */
import { FLIGHT, TIME } from '../constants.ts';
import { distanceKm, interpolate, roundPoint, type Point } from './geo.ts';

export interface FlightProfile {
  readonly speedKmh: number;
  readonly maxEnergy: number;
  /** adult: energy and sleep rules (9.4); chick: 1 h flight / 1 h rest (9.9). */
  readonly mode: 'adult' | 'chick';
  /** Bot owl of the Erklärbär: never tired (Anhang A). */
  readonly unlimitedEnergy?: boolean;
  /**
   * Only for automated local tests: all durations are divided by this factor (the owl flies
   * faster and sleeps shorter), the energy rules stay the same. Never set on servers.
   */
  readonly timeScale?: number;
}

export interface FlightEnvironment {
  isLand(lat: number, lon: number): boolean;
  isDay(at: number, lat: number, lon: number): boolean;
}

export interface FlightState {
  readonly at: number;
  readonly position: Point;
  readonly energy: number;
  /** A sleep pause (adult) or rest (chick) that is still running at `at`. */
  readonly pausedUntil?: number;
  /** Chick: flight time already flown in the current one-hour block. */
  readonly chickFlownMs?: number;
}

export type Segment =
  | {
      readonly kind: 'fly';
      readonly t0: number;
      readonly t1: number;
      readonly from: Point;
      readonly to: Point;
      readonly e0: number;
      readonly e1: number;
    }
  | {
      readonly kind: 'sleep';
      readonly t0: number;
      readonly t1: number;
      readonly at: Point;
      readonly e0: number;
      readonly e1: number;
    }
  | {
      readonly kind: 'stop';
      readonly t0: number;
      readonly t1: number;
      readonly at: Point;
      /** Index of the stop in the caller's route. */
      readonly index: number;
      readonly e0: number;
      readonly e1: number;
    };

export interface PlannedStop {
  readonly index: number;
  readonly point: Point;
}

export interface Arrival {
  readonly index: number;
  readonly at: number;
  readonly energy: number;
}

export interface Simulation {
  readonly segments: Segment[];
  readonly arrivals: Arrival[];
  readonly end: { readonly at: number; readonly energy: number; readonly position: Point };
}

/** Closer than 1 m counts as arrived (avoids a sleep pause metres before the goal). */
const EPS_KM = 1e-3;
const EPS_ENERGY = 1e-9;

/** Speed of an owl in km/h: 25 km/h × speed factor of the species (9.4.1). */
export function owlSpeedKmh(speedFactor: number): number {
  return FLIGHT.BASE_SPEED_KMH * speedFactor;
}

/** Smallest x in (0, length] with `test(x)`, given `test(length)` (about 1 m precision). */
function bisect(length: number, test: (x: number) => boolean): number {
  let lo = 0;
  let hi = length;
  while (hi - lo > 1e-3) {
    const mid = (lo + hi) / 2;
    if (test(mid)) hi = mid;
    else lo = mid;
  }
  return Math.max(hi, 1e-6);
}

function roundEnergy(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Simulates the flight from `start` through all `stops` in order. Step width at most 2 km
 * and 5 minutes; day/night is evaluated in the middle of each step; when the energy runs out
 * inside a step, the step is shortened to exactly that point (9.4.3).
 */
export function simulate(
  profile: FlightProfile,
  start: FlightState,
  stops: readonly PlannedStop[],
  env: FlightEnvironment,
): Simulation {
  const segments: Segment[] = [];
  const arrivals: Arrival[] = [];
  const scale = profile.timeScale ?? 1;
  const speed = profile.speedKmh * scale;
  const kmPerMs = speed / TIME.HOUR;
  const SLEEP_MS = (FLIGHT.SLEEP_HOURS * TIME.HOUR) / scale;
  const CHICK_FLY_MS = (FLIGHT.CHICK_FLY_HOURS * TIME.HOUR) / scale;
  const CHICK_REST_MS = (FLIGHT.CHICK_REST_HOURS * TIME.HOUR) / scale;
  const adult = profile.mode === 'adult';
  const unlimited = profile.unlimitedEnergy === true;
  const maxStep = Math.min(FLIGHT.MAX_STEP_KM, (profile.speedKmh * FLIGHT.MAX_STEP_MINUTES) / 60);

  let t = start.at;
  let position = start.position;
  let energy = Math.max(0, Math.min(start.energy, profile.maxEnergy));
  let chickFlown = start.chickFlownMs ?? 0;

  const pause = (until: number, at: Point, after: number): void => {
    segments.push({
      kind: 'sleep',
      t0: Math.round(t),
      t1: Math.round(until),
      at: roundPoint(at),
      e0: roundEnergy(energy),
      e1: roundEnergy(after),
    });
    t = until;
    energy = after;
    chickFlown = 0;
  };

  if (start.pausedUntil !== undefined && start.pausedUntil > t) {
    pause(start.pausedUntil, position, adult ? profile.maxEnergy : energy);
  }

  for (const stop of stops) {
    const from = position;
    const to = stop.point;
    const total = distanceKm(from, to);
    const pointAt = (km: number): Point => (total < EPS_KM ? to : interpolate(from, to, km / total));
    let km = 0;
    let open: { t0: number; km0: number; e0: number; phase: string } | undefined;

    const close = (): void => {
      if (!open) return;
      if (t > open.t0) {
        segments.push({
          kind: 'fly',
          t0: Math.round(open.t0),
          t1: Math.round(t),
          from: roundPoint(pointAt(open.km0)),
          to: roundPoint(pointAt(km)),
          e0: roundEnergy(open.e0),
          e1: roundEnergy(energy),
        });
      }
      open = undefined;
    };

    while (km < total - EPS_KM) {
      const here = pointAt(km);
      let glide = false;
      if (adult && !unlimited && energy <= EPS_ENERGY) {
        energy = 0;
        if (env.isLand(here.lat, here.lon)) {
          close();
          pause(t + SLEEP_MS, here, profile.maxEnergy);
          continue;
        }
        // Over water the owl flies on without using energy until it is over land (9.4.2).
        glide = true;
      }
      if (!adult && chickFlown >= CHICK_FLY_MS - 1e-6) {
        if (env.isLand(here.lat, here.lon)) {
          close();
          pause(t + CHICK_REST_MS, here, energy);
          continue;
        }
        glide = true;
      }

      let step = Math.min(maxStep, total - km);
      if (open) step = Math.min(step, Math.max(EPS_KM, open.km0 + FLIGHT.WAYPOINT_SPACING_KM - km));
      if (!adult && !glide) step = Math.min(step, (CHICK_FLY_MS - chickFlown) * kmPerMs);
      let rate = 0;
      let phase = glide ? 'glide' : 'fly';
      if (glide) {
        // Shorten the step to the first point over land (coast line within the step).
        const end = pointAt(km + step);
        if (env.isLand(end.lat, end.lon)) {
          step = bisect(step, (x) => {
            const p = pointAt(km + x);
            return env.isLand(p.lat, p.lon);
          });
        }
      } else if (adult && !unlimited) {
        const dayAt = (x: number): boolean => {
          const p = pointAt(km + x);
          return env.isDay(t + x / kmPerMs, p.lat, p.lon);
        };
        const day = dayAt(0);
        // Day/night change within the step: end the step exactly there.
        if (dayAt(step) !== day) step = bisect(step, (x) => dayAt(x) !== day);
        rate = day ? FLIGHT.ENERGY_PER_KM_DAY : FLIGHT.ENERGY_PER_KM_NIGHT;
        phase = day ? 'day' : 'night';
        if (energy < rate * step) step = energy / rate;
      }
      if (open && (open.phase !== phase || km - open.km0 >= FLIGHT.WAYPOINT_SPACING_KM - EPS_KM)) {
        close();
      }
      open ??= { t0: t, km0: km, e0: energy, phase };
      km += step;
      t += step / kmPerMs;
      energy = Math.max(0, energy - rate * step);
      if (!adult) chickFlown += step / kmPerMs;
    }
    km = total;
    close();
    position = to;
    arrivals.push({ index: stop.index, at: Math.round(t), energy: roundEnergy(energy) });
    segments.push({
      kind: 'stop',
      t0: Math.round(t),
      t1: Math.round(t),
      at: roundPoint(to),
      index: stop.index,
      e0: roundEnergy(energy),
      e1: roundEnergy(energy),
    });
  }
  return {
    segments,
    arrivals,
    end: { at: Math.round(t), energy: roundEnergy(energy), position },
  };
}

function findSegment(segments: readonly Segment[], at: number): number {
  // Last segment that starts at or before `at`.
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const segment = segments[mid];
    if (segment && segment.t0 <= at) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export interface PositionInfo {
  readonly position: Point;
  readonly energy: number;
  readonly phase: 'before' | 'fly' | 'sleep' | 'stop' | 'done';
}

/** Position and energy at time `at`, interpolated along the great circle (9.4.3). */
export function positionAt(segments: readonly Segment[], at: number): PositionInfo | undefined {
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (!first || !last) return undefined;
  if (at < first.t0) {
    const point = first.kind === 'fly' ? first.from : first.at;
    return { position: point, energy: first.e0, phase: 'before' };
  }
  if (at >= last.t1) {
    const point = last.kind === 'fly' ? last.to : last.at;
    return { position: point, energy: last.e1, phase: 'done' };
  }
  const index = findSegment(segments, at);
  const segment = segments[index];
  if (!segment) return undefined;
  if (at > segment.t1) {
    // Between a stop and the next segment (same instant in practice).
    const point = segment.kind === 'fly' ? segment.to : segment.at;
    return { position: point, energy: segment.e1, phase: 'stop' };
  }
  if (segment.kind === 'fly') {
    const fraction = segment.t1 > segment.t0 ? (at - segment.t0) / (segment.t1 - segment.t0) : 1;
    return {
      position: interpolate(segment.from, segment.to, fraction),
      energy: segment.e0 + (segment.e1 - segment.e0) * fraction,
      phase: 'fly',
    };
  }
  if (segment.kind === 'sleep') return { position: segment.at, energy: segment.e0, phase: 'sleep' };
  return { position: segment.at, energy: segment.e0, phase: 'stop' };
}

/** The complete state at `at` – the starting point for a re-plan (9.4.6, 9.5). */
export function stateAt(segments: readonly Segment[], at: number): FlightState | undefined {
  const info = positionAt(segments, at);
  if (!info) return undefined;
  const index = findSegment(segments, at);
  const segment = segments[index];
  let pausedUntil: number | undefined;
  if (segment && segment.kind === 'sleep' && at < segment.t1) pausedUntil = segment.t1;
  // Chick: sum of flight time since the last rest (9.9).
  let chickFlownMs = 0;
  for (let i = index; i >= 0; i--) {
    const s = segments[i];
    if (!s || s.kind === 'sleep') break;
    if (s.kind === 'fly') chickFlownMs += Math.min(at, s.t1) - s.t0;
  }
  return {
    at,
    position: info.position,
    energy: info.energy,
    ...(pausedUntil !== undefined ? { pausedUntil } : {}),
    chickFlownMs: Math.max(0, chickFlownMs),
  };
}

/** The segments up to `at`; a running segment is cut at `at` (history for the map). */
export function segmentsUntil(segments: readonly Segment[], at: number): Segment[] {
  const kept: Segment[] = [];
  for (const segment of segments) {
    if (segment.t1 <= at) {
      kept.push(segment);
      continue;
    }
    if (segment.t0 >= at) break;
    const info = positionAt([segment], at);
    if (!info) break;
    if (segment.kind === 'fly') {
      kept.push({
        ...segment,
        t1: Math.round(at),
        to: roundPoint(info.position),
        e1: roundEnergy(info.energy),
      });
    }
    // A running sleep pause is continued by the re-plan (pausedUntil).
    break;
  }
  return kept;
}

/**
 * Re-plans the rest of a flight from its state at `at` (move of home 9.4.6, turning back
 * 9.5): the past stays, the future is simulated anew with the given stops.
 */
export function replan(
  profile: FlightProfile,
  segments: readonly Segment[],
  at: number,
  stops: readonly PlannedStop[],
  env: FlightEnvironment,
): Simulation {
  const state = stateAt(segments, at);
  if (!state) throw new Error('flight has no plan');
  const past = segmentsUntil(segments, at);
  const next = simulate(profile, state, stops, env);
  return { ...next, segments: [...past, ...next.segments] };
}
