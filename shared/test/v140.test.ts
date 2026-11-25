/**
 * Version 1.4.0 (pure rules): holiday mode (SPEC 9.12), bored owls (9.2.9), the most own owls
 * (9.2.3), lending once per quarter (9.7) and the start energy of loan owls (9.6).
 */
import { describe, expect, it } from 'vitest';
import { BOREDOM, FLIGHT, MENAGERIE, TIME, VACATION } from '../src/constants.ts';
import { distanceKm } from '../src/game/geo.ts';
import { escapes, idleAfter, idleCounts, isBored } from '../src/game/boredom.ts';
import { loanStartEnergy } from '../src/game/energy.ts';
import {
  canBuyMore,
  canLendToPostOffice,
  maxOwnOwls,
  nextQuarterStart,
  quarterOf,
  speciesById,
} from '../src/game/owls.ts';
import {
  endTripEarly,
  inactivityReference,
  ISLAND,
  islandArrival,
  planTrip,
  START_SLACK_MS,
  tripAfterMove,
  tripPosition,
  vacationProblem,
  vacationSpeedKmh,
  vacationsUsed,
  vacationYear,
  type VacationRecord,
} from '../src/game/vacation.ts';
import { SPECIES } from '../src/species.ts';

const NOW = Date.UTC(2026, 10, 25, 12);
const BERLIN = { lat: 52.52, lon: 13.4 };
const SYDNEY = { lat: -33.87, lon: 151.21 };
const HOUR = TIME.HOUR;
const DAY = TIME.DAY;

describe('holiday rules (SPEC 8.10)', () => {
  const plan = (startsAt: number, endsAt: number, existing: VacationRecord[] = []) =>
    vacationProblem({ startsAt, endsAt, now: NOW, existing });

  it('accepts up to six weeks, at least a day, at most 92 days ahead', () => {
    expect(plan(NOW, NOW + 42 * DAY)).toBeNull();
    expect(plan(NOW, NOW + 42 * DAY + 1)).toBe('vacation_too_long');
    expect(plan(NOW, NOW + 23 * HOUR)).toBe('vacation_too_short');
    expect(plan(NOW - START_SLACK_MS, NOW + DAY)).toBeNull();
    expect(plan(NOW - START_SLACK_MS - 1, NOW + DAY)).toBe('vacation_start_past');
    expect(plan(NOW + VACATION.PLAN_AHEAD_DAYS * DAY, NOW + 93 * DAY)).toBeNull();
    expect(plan(NOW + VACATION.PLAN_AHEAD_DAYS * DAY + 1, NOW + 94 * DAY)).toBe(
      'vacation_start_too_late',
    );
  });

  it('one at a time, three per calendar year of the start, cancelled ones do not count', () => {
    const done = (startsAt: number): VacationRecord => ({
      startsAt,
      endsAt: startsAt + DAY,
      state: 'done',
    });
    expect(
      plan(NOW, NOW + DAY, [{ startsAt: NOW + DAY, endsAt: NOW + 2 * DAY, state: 'planned' }]),
    ).toBe('vacation_exists');
    expect(plan(NOW, NOW + DAY, [{ startsAt: NOW, endsAt: NOW + DAY, state: 'active' }])).toBe(
      'vacation_exists',
    );
    const three = [
      done(Date.UTC(2026, 0, 5)),
      done(Date.UTC(2026, 3, 5)),
      done(Date.UTC(2026, 6, 5)),
    ];
    expect(plan(NOW, NOW + DAY, three)).toBe('vacation_year_full');
    expect(vacationsUsed(2026, three)).toBe(3);
    const cancelled = [...three.slice(0, 2), { ...three[2]!, state: 'cancelled' as const }];
    expect(plan(NOW, NOW + DAY, cancelled)).toBeNull();
    expect(plan(Date.UTC(2027, 0, 1), Date.UTC(2027, 0, 3), three)).toBeNull();
    expect(vacationYear(Date.UTC(2027, 0, 1))).toBe(2027);
  });

  it('does not count the holiday as days away', () => {
    // Last active on 1 November, holiday 10 to 30 November: inactivity counts from 21 November.
    expect(
      inactivityReference('2026-11-01', Date.UTC(2026, 10, 10, 8), Date.UTC(2026, 10, 30, 9)),
    ).toBe('2026-11-21');
    // Active during the holiday: from its end.
    expect(inactivityReference('2026-11-20', Date.UTC(2026, 10, 10), Date.UTC(2026, 10, 30))).toBe(
      '2026-11-30',
    );
    // Never earlier than the last active day.
    expect(inactivityReference('2026-12-05', Date.UTC(2026, 10, 10), Date.UTC(2026, 10, 30))).toBe(
      '2026-12-05',
    );
  });
});

describe('holiday trips (SPEC 9.12)', () => {
  const waldkauz = vacationSpeedKmh(speciesById('waldkauz')!.speedFactor, false);

  it('flies at the speed of the species, chicks at chick speed', () => {
    expect(waldkauz).toBe(FLIGHT.BASE_SPEED_KMH);
    expect(vacationSpeedKmh(2, true)).toBe(FLIGHT.CHICK_SPEED_KMH);
  });

  it('reaches the island and is home exactly at the end', () => {
    const end = NOW + 14 * DAY;
    const trip = planTrip({ at: BERLIN, now: NOW, endsAt: end, home: BERLIN, speedKmh: waldkauz });
    const hours = distanceKm(BERLIN, ISLAND) / waldkauz;
    expect(trip.homeAt).toBe(end);
    expect(trip.backFrom).toEqual(ISLAND);
    expect(Math.abs(trip.backAt - (end - hours * HOUR))).toBeLessThan(1000);
    const arrival = islandArrival(trip)!;
    expect(Math.abs(arrival - (NOW + hours * HOUR))).toBeLessThan(1000);
    expect(tripPosition(trip, NOW - 1).phase).toBe('out');
    expect(tripPosition(trip, NOW + HOUR).phase).toBe('out');
    const there = tripPosition(trip, arrival + HOUR);
    expect(there.phase).toBe('island');
    expect(distanceKm(there.point, ISLAND)).toBeLessThan(0.01);
    expect(tripPosition(trip, trip.backAt + HOUR).phase).toBe('back');
    const home = tripPosition(trip, end);
    expect(home.phase).toBe('home');
    expect(home.point).toEqual(BERLIN);
  });

  it('turns round on the way if the island is too far, and is still home on time', () => {
    const end = NOW + 10 * DAY;
    const trip = planTrip({ at: SYDNEY, now: NOW, endsAt: end, home: SYDNEY, speedKmh: waldkauz });
    expect(islandArrival(trip)).toBeNull();
    expect(trip.homeAt).toBe(end);
    // Out and back the same way: it turns at half time.
    expect(Math.abs(trip.backAt - (NOW + 5 * DAY))).toBeLessThan(2 * TIME.MINUTE);
    const turn = tripPosition(trip, trip.backAt);
    expect(turn.phase).toBe('back');
    expect(distanceKm(turn.point, SYDNEY)).toBeGreaterThan(0);
    expect(tripPosition(trip, trip.backAt - HOUR).phase).toBe('out');
  });

  it('turns round at once when even that is too late', () => {
    const away = { lat: 50, lon: 30 };
    const trip = planTrip({ at: away, now: NOW, endsAt: NOW + HOUR, home: BERLIN, speedKmh: 25 });
    expect(trip.backAt).toBe(NOW);
    expect(trip.backFrom).toEqual(away);
    expect(trip.homeAt).toBeGreaterThan(NOW + HOUR);
    // Already at the island: straight home.
    const fromIsland = planTrip({
      at: ISLAND,
      now: NOW,
      endsAt: NOW + 30 * DAY,
      home: BERLIN,
      speedKmh: 25,
    });
    expect(fromIsland.backFrom).toEqual(ISLAND);
    expect(fromIsland.homeAt).toBe(NOW + 30 * DAY);
  });

  it('ended early: home at once from where it is; already on the way back: unchanged', () => {
    const end = NOW + 14 * DAY;
    const trip = planTrip({ at: BERLIN, now: NOW, endsAt: end, home: BERLIN, speedKmh: waldkauz });
    const early = endTripEarly(trip, NOW + 10 * HOUR);
    expect(early.backAt).toBe(NOW + 10 * HOUR);
    const travelled = distanceKm(BERLIN, early.backFrom);
    expect(Math.abs(travelled - 10 * waldkauz)).toBeLessThan(0.5);
    expect(Math.abs(early.homeAt - (NOW + 20 * HOUR))).toBeLessThan(2000);
    expect(endTripEarly(trip, trip.backAt + HOUR)).toBe(trip);
    // A trip back of no length ends at once.
    expect(tripPosition({ ...early, homeAt: early.backAt }, early.backAt).phase).toBe('home');
  });

  it('follows a move: back to the new home, still on time while there is time', () => {
    const end = NOW + 14 * DAY;
    const trip = planTrip({ at: BERLIN, now: NOW, endsAt: end, home: BERLIN, speedKmh: waldkauz });
    const paris = { lat: 48.86, lon: 2.35 };
    const moved = tripAfterMove(trip, NOW + 2 * DAY + 12 * HOUR, paris, end);
    expect(moved.home).toEqual(paris);
    expect(moved.homeAt).toBe(end);
    const late = tripAfterMove(trip, trip.backAt + HOUR, paris, end);
    expect(late.backAt).toBe(trip.backAt + HOUR);
    expect(late.home).toEqual(paris);
  });
});

describe('bored owls (SPEC 9.2.9)', () => {
  it('count only at home or on a flight, and not on holiday', () => {
    expect(idleCounts('home', false)).toBe(true);
    expect(idleCounts('flying', false)).toBe(true);
    for (const state of ['sick', 'brooding', 'menagerie', 'vacation'] as const)
      expect(idleCounts(state, false)).toBe(false);
    expect(idleCounts('home', true)).toBe(false);
    expect(idleAfter({ idleMs: 5, idleAt: NOW - DAY, now: NOW, counts: true })).toBe(5 + DAY);
    expect(idleAfter({ idleMs: 5, idleAt: NOW - DAY, now: NOW, counts: false })).toBe(5);
    expect(idleAfter({ idleMs: 5, idleAt: null, now: NOW, counts: true })).toBe(5);
    expect(idleAfter({ idleMs: 5, idleAt: NOW + DAY, now: NOW, counts: true })).toBe(5);
  });

  it('are bored after 21 days and fly off after 7 more – at home, never the last', () => {
    const bored = BOREDOM.BORED_AFTER_DAYS * DAY;
    const gone = (BOREDOM.BORED_AFTER_DAYS + BOREDOM.ESCAPE_AFTER_DAYS) * DAY;
    expect(isBored(bored - 1)).toBe(false);
    expect(isBored(bored)).toBe(true);
    expect(escapes({ idleMs: gone - 1, state: 'home', otherAdults: 1 })).toBe(false);
    expect(escapes({ idleMs: gone, state: 'home', otherAdults: 1 })).toBe(true);
    expect(escapes({ idleMs: gone, state: 'flying', otherAdults: 1 })).toBe(false);
    expect(escapes({ idleMs: gone, state: 'home', otherAdults: 0 })).toBe(false);
  });
});

describe('the most own owls, the quarter, loan energy', () => {
  it('as many own owls as species', () => {
    expect(maxOwnOwls()).toBe(SPECIES.length);
    expect(canBuyMore(SPECIES.length - 1)).toBe(true);
    expect(canBuyMore(SPECIES.length)).toBe(false);
  });

  it('lends once per calendar quarter', () => {
    const own = { state: 'home', kind: 'own', isChick: false } as const;
    expect(quarterOf(Date.UTC(2026, 0, 1))).toBe('2026-1');
    expect(quarterOf(Date.UTC(2026, 11, 31, 23))).toBe('2026-4');
    expect(nextQuarterStart(Date.UTC(2026, 10, 25))).toBe(Date.UTC(2027, 0, 1));
    expect(nextQuarterStart(Date.UTC(2026, 1, 3))).toBe(Date.UTC(2026, 3, 1));
    expect(canLendToPostOffice(own, null, NOW)).toBe(true);
    expect(canLendToPostOffice(own, '2026-4', NOW)).toBe(false);
    expect(canLendToPostOffice(own, '2026-3', NOW)).toBe(true);
    expect(canLendToPostOffice({ ...own, mythical: true }, null, NOW)).toBe(false);
  });

  it('loan owls start with 75–100 % of their energy', () => {
    const species = speciesById('waldkauz')!;
    expect(loanStartEnergy(species, 0)).toBe(
      species.maxEnergy * MENAGERIE.LOAN_START_ENERGY_MIN_SHARE,
    );
    expect(loanStartEnergy(species, 0.999999)).toBeLessThanOrEqual(species.maxEnergy);
  });
});
