import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLIGHT, MAP, TIME } from '../src/constants.ts';
import {
  owlSpeedKmh,
  positionAt,
  replan,
  segmentsUntil,
  simulate,
  stateAt,
  type FlightEnvironment,
  type FlightProfile,
  type Segment,
} from '../src/game/flight.ts';
import { distanceKm, interpolate } from '../src/game/geo.ts';
import { isDay } from '../src/game/sun.ts';
import { isLand } from '../src/map/landmask.ts';

const T0 = Date.parse('2026-03-01T00:00:00Z');
const night: FlightEnvironment = { isLand: () => true, isDay: () => false };
const day: FlightEnvironment = { isLand: () => true, isDay: () => true };
const owl: FlightProfile = { speedKmh: 25, maxEnergy: 100, mode: 'adult', recoveryPerHour: 10 };

// Points on the equator: 1° of longitude = 111.19 km.
const KM_PER_DEG = distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
const east = (km: number) => ({ lat: 0, lon: km / KM_PER_DEG });
const home = { lat: 0, lon: 0 };

/** Positions are stored rounded to 1e-4° (≈ 11 m), so re-planned times may differ by seconds. */
function expectTime(actual: number | undefined, expected: number): void {
  expect(Math.abs((actual ?? 0) - expected)).toBeLessThan(5000);
}

function sleeps(segments: Segment[]): Segment[] {
  return segments.filter((segment) => segment.kind === 'sleep');
}

describe('flight simulation (SPEC 9.4, 17.2)', () => {
  it('uses 1 energy per km at night and 1.5 per km by day; speed 25 km/h × factor', () => {
    expect(owlSpeedKmh(1.2)).toBe(30);
    const atNight = simulate(
      owl,
      { at: T0, position: home, energy: 100 },
      [{ index: 0, point: east(50) }],
      night,
    );
    expect(atNight.arrivals[0]?.energy).toBeCloseTo(50, 1);
    expect(atNight.arrivals[0]?.at).toBe(T0 + 2 * TIME.HOUR);
    const byDay = simulate(
      owl,
      { at: T0, position: home, energy: 100 },
      [{ index: 0, point: east(50) }],
      day,
    );
    expect(byDay.arrivals[0]?.energy).toBeCloseTo(25, 1);
    expect(byDay.arrivals[0]?.at).toBe(T0 + 2 * TIME.HOUR);
  });

  it('switches the rate within the flight when day turns into night', () => {
    // Day for the first hour (25 km), night afterwards (25 km): 37.5 + 25.
    const env: FlightEnvironment = { isLand: () => true, isDay: (at) => at < T0 + TIME.HOUR };
    const result = simulate(
      owl,
      { at: T0, position: home, energy: 100 },
      [{ index: 0, point: east(50) }],
      env,
    );
    expect(result.arrivals[0]?.energy).toBeCloseTo(100 - 37.5 - 25, 0);
    const flights = result.segments.filter((segment) => segment.kind === 'fly');
    expect(flights.length).toBeGreaterThanOrEqual(2);
  });

  it('sleeps only as long as it needs for the next stop (v0.5)', () => {
    const result = simulate(
      owl,
      { at: T0, position: home, energy: 100 },
      [{ index: 0, point: east(150) }],
      night,
    );
    const pauses = sleeps(result.segments);
    expect(pauses).toHaveLength(1);
    const pause = pauses[0];
    // 50 km left at night need 50 energy: 5 hours at 10 per hour (5 minutes precise).
    const slept = (pause?.t1 ?? 0) - (pause?.t0 ?? 0);
    expect(slept).toBeGreaterThanOrEqual(5 * TIME.HOUR - 1000);
    expect(slept).toBeLessThanOrEqual(5 * TIME.HOUR + 5 * TIME.MINUTE);
    expect(pause?.e1).toBeGreaterThanOrEqual(49.9);
    expect(pause?.e1).toBeLessThan(51);
    expect(result.arrivals[0]?.energy).toBeLessThan(1);
    if (pause?.kind === 'sleep') expect(pause.at.lon * KM_PER_DEG).toBeCloseTo(100, 0);
    // The energy rises evenly while it sleeps.
    const middle = positionAt(result.segments, (pause?.t0 ?? 0) + 2.5 * TIME.HOUR);
    expect(middle?.phase).toBe('sleep');
    expect(middle?.energy).toBeCloseTo(25, 0);
  });

  it('sleeps until full when even full energy is not enough, then only as needed (v0.5)', () => {
    const result = simulate(
      owl,
      { at: T0, position: home, energy: 100 },
      [{ index: 0, point: east(350) }],
      night,
    );
    const pauses = sleeps(result.segments);
    expect(pauses).toHaveLength(3);
    expect((pauses[0]?.t1 ?? 0) - (pauses[0]?.t0 ?? 0)).toBe(10 * TIME.HOUR);
    expect(pauses[0]?.e1).toBe(100);
    expect((pauses[1]?.t1 ?? 0) - (pauses[1]?.t0 ?? 0)).toBe(10 * TIME.HOUR);
    const last = (pauses[2]?.t1 ?? 0) - (pauses[2]?.t0 ?? 0);
    expect(last).toBeGreaterThanOrEqual(5 * TIME.HOUR - 1000);
    expect(last).toBeLessThanOrEqual(5 * TIME.HOUR + 5 * TIME.MINUTE);
  });

  it('recovers with the profile rate; plans before v0.5 are full after 10 hours', () => {
    const fast = simulate(
      { ...owl, recoveryPerHour: 20 },
      { at: T0, position: home, energy: 0 },
      [{ index: 0, point: east(100) }],
      night,
    );
    expect((sleeps(fast.segments)[0]?.t1 ?? 0) - T0).toBe(5 * TIME.HOUR);
    const legacy = simulate(
      { speedKmh: 25, maxEnergy: 100, mode: 'adult' },
      { at: T0, position: home, energy: 0 },
      [{ index: 0, point: east(100) }],
      night,
    );
    expect((sleeps(legacy.segments)[0]?.t1 ?? 0) - T0).toBe(10 * TIME.HOUR);
  });

  it('flies on over water without using energy and sleeps on the next land (9.4.2)', () => {
    // Water from 80 km to 130 km.
    const env: FlightEnvironment = {
      isLand: (_lat, lon) => lon * KM_PER_DEG < 80 || lon * KM_PER_DEG > 130,
      isDay: () => false,
    };
    const result = simulate(
      owl,
      { at: T0, position: home, energy: 100 },
      [{ index: 0, point: east(200) }],
      env,
    );
    const pause = sleeps(result.segments)[0];
    expect(pause).toBeDefined();
    if (pause?.kind === 'sleep') {
      expect(pause.at.lon * KM_PER_DEG).toBeGreaterThan(129.9);
      expect(pause.at.lon * KM_PER_DEG).toBeLessThan(133);
    }
    // 200 km in 8 h; after the coast at 130 km it sleeps just enough for the last 70 km (v0.5).
    if (pause) expect(pause.t1 - pause.t0).toBeGreaterThan(6.9 * TIME.HOUR);
    if (pause) expect(pause.t1 - pause.t0).toBeLessThan(7.2 * TIME.HOUR);
    expect(result.arrivals[0]?.at).toBeGreaterThan(T0 + 14.9 * TIME.HOUR);
    expect(result.arrivals[0]?.energy).toBeLessThan(1);
  });

  it('starts with the sleep pause when sent with 0 energy', () => {
    const result = simulate(
      owl,
      { at: T0, position: home, energy: 0 },
      [{ index: 0, point: east(25) }],
      night,
    );
    expect(result.segments[0]?.kind).toBe('sleep');
    expect(result.segments[0]?.t0).toBe(T0);
    // 25 km need 25 energy: 2.5 h of sleep (5 minutes precise), then 1 h of flight.
    expect(result.arrivals[0]?.at).toBeGreaterThanOrEqual(T0 + 3.5 * TIME.HOUR - 1000);
    expect(result.arrivals[0]?.at).toBeLessThanOrEqual(T0 + 3.5 * TIME.HOUR + 5 * TIME.MINUTE);
    expect(result.arrivals[0]?.energy).toBeLessThan(1);
  });

  it('visits several recipients in order and flies home with the remaining energy', () => {
    const stops = [
      { index: 0, point: east(20) },
      { index: 1, point: east(40) },
      { index: 2, point: home },
    ];
    const result = simulate(owl, { at: T0, position: home, energy: 100 }, stops, night);
    expect(result.arrivals.map((arrival) => arrival.index)).toEqual([0, 1, 2]);
    const times = result.arrivals.map((arrival) => (arrival.at - T0) / TIME.HOUR);
    expect(times[0]).toBeCloseTo(0.8, 3);
    expect(times[1]).toBeCloseTo(1.6, 3);
    expect(times[2]).toBeCloseTo(3.2, 3);
    expect(result.arrivals[2]?.energy).toBeCloseTo(20, 1);
    expect(result.segments.filter((segment) => segment.kind === 'stop')).toHaveLength(3);
  });

  it('a loan owl has no return flight: the plan ends at the recipient', () => {
    const result = simulate(
      owl,
      { at: T0, position: home, energy: 100 },
      [{ index: 0, point: east(30) }],
      night,
    );
    expect(result.end.position).toEqual(east(30));
    expect(result.segments.at(-1)?.kind).toBe('stop');
  });

  it('stores waypoints about every 25 km, not every step', () => {
    const result = simulate(
      { ...owl, maxEnergy: 1000 },
      { at: T0, position: home, energy: 1000 },
      [{ index: 0, point: east(500) }],
      night,
    );
    const flights = result.segments.filter((segment) => segment.kind === 'fly');
    expect(flights.length).toBe(20);
    for (const segment of flights) {
      if (segment.kind === 'fly') expect(distanceKm(segment.from, segment.to)).toBeLessThan(26);
    }
  });

  it('a bot owl with unlimited energy never sleeps', () => {
    const result = simulate(
      { speedKmh: 200, maxEnergy: 0, mode: 'adult', unlimitedEnergy: true },
      { at: T0, position: home, energy: 0 },
      [{ index: 0, point: east(1000) }],
      night,
    );
    expect(sleeps(result.segments)).toHaveLength(0);
    expect(result.arrivals[0]?.at).toBe(T0 + 5 * TIME.HOUR);
  });

  it('a time scale for local tests shortens flight and sleep alike', () => {
    const result = simulate(
      { ...owl, timeScale: 3600 },
      { at: T0, position: home, energy: 100 },
      [{ index: 0, point: east(150) }],
      night,
    );
    // 6 h of flight and 5 h of sleep become 11 seconds.
    expect(result.arrivals[0]?.at).toBeGreaterThanOrEqual(T0 + 11_000 - 10);
    expect(result.arrivals[0]?.at).toBeLessThanOrEqual(T0 + 11_100);
    expect(result.arrivals[0]?.energy).toBeLessThan(1);
  });

  it('two recipients at the same place are reached at the same time', () => {
    const result = simulate(
      owl,
      { at: T0, position: home, energy: 100 },
      [
        { index: 0, point: east(10) },
        { index: 1, point: east(10) },
      ],
      night,
    );
    expect(result.arrivals[0]?.at).toBe(result.arrivals[1]?.at);
  });
});

describe('chick flight (SPEC 9.9)', () => {
  const chick: FlightProfile = { speedKmh: FLIGHT.CHICK_SPEED_KMH, maxEnergy: 100, mode: 'chick' };

  it('alternates 1 hour of flight and 1 hour of rest at 10 km/h', () => {
    const result = simulate(
      chick,
      { at: T0, position: home, energy: 50 },
      [{ index: 0, point: east(35) }],
      night,
    );
    // 10 km per hour: fly 1 h, rest 1 h, ... 3.5 h of flight and 3 rests.
    expect(sleeps(result.segments)).toHaveLength(3);
    expect(result.arrivals[0]?.at).toBe(T0 + 6.5 * TIME.HOUR);
    expect(result.arrivals[0]?.energy).toBe(50);
  });

  it('flies on over water until it is over land and rests there', () => {
    const env: FlightEnvironment = {
      isLand: (_lat, lon) => lon * KM_PER_DEG < 8 || lon * KM_PER_DEG > 14,
      isDay: () => true,
    };
    const result = simulate(
      chick,
      { at: T0, position: home, energy: 0 },
      [{ index: 0, point: east(30) }],
      env,
    );
    const rest = sleeps(result.segments)[0];
    if (rest?.kind !== 'sleep') throw new Error('expected a rest');
    expect(rest.at.lon * KM_PER_DEG).toBeGreaterThan(13.9);
    expect(rest.t0 - T0).toBeGreaterThan(1.39 * TIME.HOUR);
  });
});

describe('position and re-planning (SPEC 9.4.3, 9.4.6, 9.5)', () => {
  const start = { at: T0, position: home, energy: 100 };

  it('interpolates the position at any time', () => {
    const result = simulate(owl, start, [{ index: 0, point: east(150) }], night);
    const at1h = positionAt(result.segments, T0 + TIME.HOUR);
    expect(at1h?.phase).toBe('fly');
    expect((at1h?.position.lon ?? 0) * KM_PER_DEG).toBeCloseTo(25, 1);
    expect(at1h?.energy).toBeCloseTo(75, 1);
    const asleep = positionAt(result.segments, T0 + 6 * TIME.HOUR);
    expect(asleep?.phase).toBe('sleep');
    expect(positionAt(result.segments, T0 - 1)?.phase).toBe('before');
    const done = positionAt(result.segments, T0 + 100 * TIME.HOUR);
    expect(done?.phase).toBe('done');
    expect((done?.position.lon ?? 0) * KM_PER_DEG).toBeCloseTo(150, 1);
    expect(positionAt([], T0)).toBe(undefined);
  });

  it('re-plans with unchanged stops to the same result', () => {
    const stops = [
      { index: 0, point: east(140) },
      { index: 1, point: home },
    ];
    const original = simulate(owl, start, stops, night);
    for (const hours of [1, 4.5, 8, 20]) {
      const again = replan(
        owl,
        original.segments,
        T0 + hours * TIME.HOUR,
        stops.slice(hours > 16 ? 1 : 0),
        night,
      );
      // A re-plan during a sleep recalculates it (v0.5): equal up to its 5-minute precision.
      expect(
        Math.abs((again.arrivals.at(-1)?.at ?? 0) - (original.arrivals.at(-1)?.at ?? 0)),
      ).toBeLessThan(10 * TIME.MINUTE);
    }
  });

  it('a recipient moves: the rest of the route is re-planned from the current position', () => {
    const original = simulate(
      owl,
      start,
      [
        { index: 0, point: east(50) },
        { index: 1, point: home },
      ],
      night,
    );
    const at = T0 + TIME.HOUR;
    const moved = replan(
      owl,
      original.segments,
      at,
      [
        { index: 0, point: east(75) },
        { index: 1, point: home },
      ],
      night,
    );
    // 25 km flown; 50 km further to the new place.
    expectTime(moved.arrivals[0]?.at, T0 + 3 * TIME.HOUR);
    // Past segments are kept.
    expect(moved.segments[0]?.t0).toBe(T0);
    expect(segmentsUntil(original.segments, at).at(-1)?.t1).toBe(at);
  });

  it('the holder moves during the return flight', () => {
    const original = simulate(
      owl,
      start,
      [
        { index: 0, point: east(20) },
        { index: 1, point: home },
      ],
      night,
    );
    const at = T0 + TIME.HOUR; // 5 km back towards home
    const moved = replan(owl, original.segments, at, [{ index: 1, point: east(-15) }], night);
    // At 15 km on the way back; 30 km to the new home.
    expectTime(moved.arrivals[0]?.at, at + 1.2 * TIME.HOUR);
  });

  it('a move during a sleep: the sleep is recalculated for the new goal (v0.5)', () => {
    const original = simulate(owl, start, [{ index: 0, point: east(150) }], night);
    const at = T0 + 5 * TIME.HOUR; // asleep since 4 h with 10 energy so far
    const state = stateAt(original.segments, at);
    expect(state?.pausedUntil).toBeUndefined();
    expect(state?.energy).toBeCloseTo(10, 1);
    const moved = replan(owl, original.segments, at, [{ index: 0, point: east(125) }], night);
    // 10 km with the energy so far, 1.5 h of sleep for the last 15 km, then 0.6 h of flight.
    const expected = at + (0.4 + 1.5 + 0.6) * TIME.HOUR;
    expect(moved.arrivals[0]?.at).toBeGreaterThanOrEqual(expected - 5000);
    expect(moved.arrivals[0]?.at).toBeLessThanOrEqual(expected + 5 * TIME.MINUTE + 5000);
    expect(moved.arrivals[0]?.energy).toBeLessThan(1);
  });

  it('turning back: the owl flies home from where it is', () => {
    const original = simulate(
      owl,
      start,
      [
        { index: 0, point: east(40) },
        { index: 1, point: home },
      ],
      night,
    );
    const back = replan(owl, original.segments, T0 + TIME.HOUR, [{ index: 1, point: home }], night);
    expect(back.arrivals).toHaveLength(1);
    expectTime(back.arrivals[0]?.at, T0 + 2 * TIME.HOUR);
    expect(back.arrivals[0]?.energy).toBeCloseTo(50, 1);
  });

  it('a chick keeps its flight hour when re-planned', () => {
    const chick: FlightProfile = { speedKmh: 10, maxEnergy: 100, mode: 'chick' };
    const original = simulate(chick, start, [{ index: 0, point: east(30) }], night);
    const state = stateAt(original.segments, T0 + 0.5 * TIME.HOUR);
    expect(state?.chickFlownMs).toBe(0.5 * TIME.HOUR);
    const back = replan(
      chick,
      original.segments,
      T0 + 0.5 * TIME.HOUR,
      [{ index: 1, point: home }],
      night,
    );
    expectTime(back.arrivals[0]?.at, T0 + TIME.HOUR);
  });

  it('rejects re-planning without a plan', () => {
    expect(() => replan(owl, [], T0, [], night)).toThrow();
  });
});

describe('with the real land mask and sun (SPEC 12.3, 17.2)', () => {
  const mask = new Uint8Array(
    fs.readFileSync(path.resolve(import.meta.dirname, '../data/landmask.bin')),
  );
  const env: FlightEnvironment = {
    isLand: (lat, lon) => isLand(mask, lat, lon),
    isDay,
  };

  it('routes leaving the map section count as water', () => {
    const bergen = { lat: 60.39, lon: 5.32 };
    const stockholm = { lat: 60.45, lon: 22.27 }; // Turku
    let maxLat = 0;
    for (let i = 0; i <= 100; i++)
      maxLat = Math.max(maxLat, interpolate(bergen, stockholm, i / 100).lat);
    expect(maxLat).toBeGreaterThan(MAP.NORTH_LAT);
    const top = interpolate(bergen, stockholm, 0.5);
    expect(env.isLand(top.lat, top.lon)).toBe(false);
    // An owl that runs out of energy outside the section glides on and sleeps on land.
    const result = simulate(
      { speedKmh: 25, maxEnergy: 300, mode: 'adult' },
      { at: Date.parse('2026-06-21T00:00:00Z'), position: bergen, energy: 300 },
      [{ index: 0, point: stockholm }],
      env,
    );
    for (const pause of sleeps(result.segments)) {
      if (pause.kind === 'sleep') expect(env.isLand(pause.at.lat, pause.at.lon)).toBe(true);
    }
    expect(result.arrivals[0]?.index).toBe(0);
  });

  it('Berlin → Lisbon and back with a real Waldkauz is plausible', () => {
    const berlin = { lat: 52.52, lon: 13.4 };
    const lisbon = { lat: 38.72, lon: -9.14 };
    const result = simulate(
      { speedKmh: owlSpeedKmh(1.1), maxEnergy: 540, mode: 'adult', recoveryPerHour: 67.5 },
      { at: Date.parse('2026-11-05T12:00:00Z'), position: berlin, energy: 540 },
      [
        { index: 0, point: lisbon },
        { index: 1, point: berlin },
      ],
      env,
    );
    const km = 2 * distanceKm(berlin, lisbon);
    const flightHours = km / owlSpeedKmh(1.1);
    const pauses = sleeps(result.segments).length;
    expect(pauses).toBeGreaterThanOrEqual(Math.floor(km / (540 * 1)) - 1);
    expect(pauses).toBeLessThanOrEqual(Math.ceil(km / (540 / 1.5)));
    const total = ((result.arrivals[1]?.at ?? 0) - Date.parse('2026-11-05T12:00:00Z')) / TIME.HOUR;
    // Full after 8 hours (10 % × 1.25 per hour); the last sleep before each stop is shorter.
    expect(total).toBeGreaterThan(flightHours + (pauses - 2) * 8 - 0.1);
    expect(total).toBeLessThan(flightHours + pauses * 8 + 0.1);
    expect(JSON.stringify(result.segments).length).toBeLessThan(40_000);
  });
});
