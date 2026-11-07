import { describe, expect, it } from 'vitest';
import { GOLD, OWL, TIME } from '../src/constants.ts';
import {
  daysBetween,
  displayEnergy,
  energyAfterFeeding,
  energyNow,
  hasCareBonus,
  homeTimeOn,
  regenPerHour,
  startEnergy,
} from '../src/game/energy.ts';
import { distanceKm, interpolate, roundPoint } from '../src/game/geo.ts';
import {
  canAfford,
  dailyWage,
  formatGold,
  maxTransfer,
  parseGold,
  priceTenths,
  transferProblem,
} from '../src/game/gold.ts';
import {
  canBuyMore,
  canCare,
  canGift,
  canLendToMenagerie,
  canRelease,
  canRename,
  canRenameInYear,
  canTransport,
  maxRecipients,
  randomSex,
  regenerates,
  speciesById,
} from '../src/game/owls.ts';
import { isDay, sunAltitude } from '../src/game/sun.ts';
import { SPECIES, type Species } from '../src/species.ts';

const fast: Species = {
  id: 'test',
  name: 'Test',
  nameEn: 'Test',
  imageName: 'Test',
  price: 10,
  maxEnergy: 100,
  speedFactor: 1,
  recoveryFactor: 2,
};

describe('geometry (SPEC 9.4.1)', () => {
  const berlin = { lat: 52.52, lon: 13.405 };
  const paris = { lat: 48.857, lon: 2.352 };

  it('measures great-circle distances with radius 6 371 km', () => {
    expect(distanceKm(berlin, paris)).toBeCloseTo(877.5, 0);
    expect(distanceKm(berlin, berlin)).toBe(0);
    // A quarter of the meridian: π/2 × 6371.
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 90, lon: 0 })).toBeCloseTo(10007.5, 0);
  });

  it('interpolates along the great circle', () => {
    expect(interpolate(berlin, paris, 0)).toEqual(berlin);
    expect(interpolate(berlin, paris, 1)).toEqual(paris);
    const middle = interpolate(berlin, paris, 0.5);
    expect(distanceKm(berlin, middle)).toBeCloseTo(distanceKm(middle, paris), 6);
    // Great circle north of the rhumb line in the northern hemisphere.
    expect(middle.lat).toBeGreaterThan((berlin.lat + paris.lat) / 2);
    expect(interpolate(berlin, berlin, 0.5)).toEqual(berlin);
    expect(roundPoint({ lat: 1.234567, lon: -2.345678 })).toEqual({ lat: 1.2346, lon: -2.3457 });
  });
});

describe('sun (SPEC 9.4.1)', () => {
  it('twilight down to −6° counts as day', () => {
    const noon = Date.parse('2026-06-21T11:00:00Z');
    const midnight = Date.parse('2026-12-21T23:00:00Z');
    expect(isDay(noon, 52.52, 13.405)).toBe(true);
    expect(isDay(midnight, 52.52, 13.405)).toBe(false);
    // Find civil dusk in Berlin on 2026-03-20 and check both sides.
    let at = Date.parse('2026-03-20T17:00:00Z');
    while (sunAltitude(at, 52.52, 13.405) > -6) at += TIME.MINUTE;
    expect(isDay(at - TIME.MINUTE, 52.52, 13.405)).toBe(true);
    expect(isDay(at, 52.52, 13.405)).toBe(false);
    expect(sunAltitude(at - TIME.MINUTE, 52.52, 13.405)).toBeGreaterThan(-6);
    expect(sunAltitude(at - TIME.MINUTE, 52.52, 13.405)).toBeLessThan(-5);
  });
});

describe('energy (SPEC 9.3, 17.2)', () => {
  it('regenerates 10 % × recovery factor per hour: factor 2 ⇒ empty to full in 5 hours', () => {
    expect(regenPerHour(fast)).toBe(20);
    const stored = { energy: 0, energyAt: 0 };
    expect(energyNow(stored, fast, 2.5 * TIME.HOUR, true)).toBe(50);
    expect(energyNow(stored, fast, 5 * TIME.HOUR, true)).toBe(100);
    expect(energyNow(stored, fast, 50 * TIME.HOUR, true)).toBe(100);
  });

  it('does not regenerate away from home and never exceeds the maximum', () => {
    expect(energyNow({ energy: 30, energyAt: 0 }, fast, 10 * TIME.HOUR, false)).toBe(30);
    expect(energyNow({ energy: 300, energyAt: 0 }, fast, 0, true)).toBe(100);
    expect(energyNow({ energy: 30, energyAt: 1000 }, fast, 500, true)).toBe(30);
    expect(displayEnergy(41.5)).toBe(42);
    expect(displayEnergy(41.49)).toBe(41);
  });

  it('feeding gives 10 % × recovery factor, capped', () => {
    expect(energyAfterFeeding(50, fast)).toBe(70);
    expect(energyAfterFeeding(95, fast)).toBe(100);
    const waldkauz = speciesById('waldkauz');
    expect(waldkauz).toBeDefined();
    if (waldkauz) expect(energyAfterFeeding(0, waldkauz)).toBeCloseTo(67.5, 6);
  });

  it('start energy is 60–100 % of the maximum', () => {
    expect(startEnergy(fast, 0)).toBe(60);
    expect(startEnergy(fast, 0.999999)).toBeCloseTo(100, 3);
    expect(startEnergy(fast, 0.5)).toBe(80);
  });

  it('care bonus: 10 of the last 14 days with at least one hour at home (v0.2, 9.3)', () => {
    const at = (day: string, hour = 0) => Date.parse(`${day}T00:00:00Z`) + hour * TIME.HOUR;
    const day = (n: number) => `2026-03-${String(n).padStart(2, '0')}`;
    const now = at('2026-03-31', 3);
    const care = (days: number[]) => new Set(days.map(day));
    const bonus = (careDays: Set<string>, away: { since: number; until: number | null }[] = []) =>
      hasCareBonus({ day: '2026-03-31', ownedSince: '2026-01-01', careDays, away, now });
    const range = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => from + i);

    // Always at home: the 14 days before the roll are 17–30; ten of them cared for.
    expect(bonus(care(range(21, 30)))).toBe(true);
    expect(bonus(care(range(22, 30)))).toBe(false);
    // Care on the roll day itself and before the window does not count.
    expect(bonus(care([...range(22, 30), 31, 16]))).toBe(false);

    // Away for five whole days (20–24): those days are skipped, the window reaches back to 12.
    const trip = [{ since: at(day(20)), until: at(day(25)) }];
    expect(bonus(care([...range(12, 16), ...range(25, 29)]), trip)).toBe(true);
    expect(bonus(care([...range(12, 16), ...range(25, 29)]))).toBe(false);
    // Less than an hour at home on a day: does not count either way.
    const short = [{ since: at(day(30), 0.5), until: null }];
    expect(homeTimeOn(day(30), short, now)).toBe(0.5 * TIME.HOUR);
    expect(bonus(care([...range(17, 25)]), short)).toBe(false);
    expect(bonus(care([...range(16, 25)]), short)).toBe(true);
    // Exactly one hour counts.
    const hour = [{ since: at(day(30), 1), until: at(day(31)) }];
    expect(homeTimeOn(day(30), hour, now)).toBe(TIME.HOUR);
    expect(bonus(care(range(21, 30)), hour)).toBe(true);

    // Only days since the start of ownership.
    expect(
      hasCareBonus({
        day: '2026-03-31',
        ownedSince: day(25),
        careDays: care(range(17, 30)),
        away: [],
        now,
      }),
    ).toBe(false);
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2);
  });
});

describe('daily wage (v0.4, SPEC 9.1.1)', () => {
  it('pays 3.0 on the day of registration and the 29 days after, then 2.0', () => {
    const day = (iso: string) => Date.parse(`${iso}T15:00:00Z`);
    expect(dailyWage('2026-11-01', day('2026-11-01'))).toBe(GOLD.DAILY);
    expect(dailyWage('2026-11-01', day('2026-11-30'))).toBe(GOLD.DAILY);
    expect(dailyWage('2026-11-01', day('2026-12-01'))).toBe(GOLD.DAILY_LATER);
    expect(GOLD.DAILY).toBe(30);
    expect(GOLD.DAILY_LATER).toBe(20);
  });
});

describe('gold (SPEC 9.1, 17.2)', () => {
  it('works in tenths without rounding errors', () => {
    expect(formatGold(30)).toBe('3,0');
    expect(formatGold(1)).toBe('0,1');
    expect(formatGold(1234)).toBe('123,4');
    expect(formatGold(-5)).toBe('-0,5');
    expect(formatGold(1234, '.')).toBe('123.4');
    expect(parseGold('1,5')).toBe(15);
    expect(parseGold(' 2 ')).toBe(20);
    expect(parseGold('0.1')).toBe(1);
    for (const bad of ['', '1,55', '-1', 'abc', '1e3', '12345'])
      expect(parseGold(bad)).toBe(undefined);
    expect(priceTenths(6)).toBe(60);
    // 0.1 + 0.2 in tenths is exact.
    expect(1 + 2).toBe(3);
  });

  it('needs full cover and blocks paid actions with a negative balance', () => {
    expect(canAfford(10, 10)).toBe(true);
    expect(canAfford(9, 10)).toBe(false);
    expect(canAfford(-1, 0)).toBe(false);
  });

  it('transfer limits: 0.1–20.0 and more than 10.0 left afterwards', () => {
    expect(transferProblem(200, 99)).toBe(null);
    expect(transferProblem(200, 100)).toBe('transfer_remaining');
    expect(transferProblem(102, 1)).toBe(null);
    expect(transferProblem(101, 1)).toBe('transfer_remaining');
    expect(transferProblem(500, 200)).toBe(null);
    expect(transferProblem(500, 201)).toBe('transfer_amount');
    expect(transferProblem(500, 0)).toBe('transfer_amount');
    expect(transferProblem(500, 1.5)).toBe('transfer_amount');
    expect(transferProblem(5, 10)).toBe('gold_insufficient');
    expect(transferProblem(-1, 1)).toBe('gold_insufficient');
    expect(maxTransfer(500)).toBe(GOLD.TRANSFER_MAX);
    expect(maxTransfer(105)).toBe(4);
    expect(maxTransfer(50)).toBe(0);
  });
});

describe('owl states (SPEC 9.2.5)', () => {
  const own = { kind: 'own', isChick: false } as const;
  it('allows actions per state', () => {
    expect(canTransport({ ...own, state: 'home' })).toBe(true);
    for (const state of [
      'flying',
      'gift_flight',
      'sick',
      'self_care',
      'vet',
      'brooding',
      'menagerie',
    ] as const) {
      expect(canTransport({ ...own, state }), state).toBe(false);
    }
    expect(canTransport({ state: 'home', kind: 'own', isChick: true })).toBe(false);
    expect(canTransport({ state: 'home', kind: 'loan', isChick: false })).toBe(true);
    expect(canTransport({ state: 'home', kind: 'bot', isChick: false })).toBe(false);
    expect(canGift({ state: 'home', kind: 'loan', isChick: false })).toBe(false);
    expect(canGift({ ...own, state: 'home' })).toBe(true);
    expect(maxRecipients({ state: 'home', kind: 'loan', isChick: false })).toBe(5);
    expect(maxRecipients({ ...own, state: 'home' })).toBe(5);
    expect(canCare({ ...own, state: 'sick' })).toBe(true);
    expect(canCare({ ...own, state: 'vet' })).toBe(false);
    expect(canCare({ ...own, state: 'flying' })).toBe(false);
    expect(canRelease({ ...own, state: 'self_care' })).toBe(true);
    expect(canRelease({ ...own, state: 'brooding' })).toBe(false);
    expect(canRelease({ state: 'home', kind: 'own', isChick: true })).toBe(false);
    expect(canRelease({ state: 'home', kind: 'loan', isChick: false })).toBe(false);
    expect(canRename({ state: 'home', kind: 'loan', isChick: false })).toBe(false);
    expect(canLendToMenagerie({ ...own, state: 'home' })).toBe(true);
    expect(canLendToMenagerie({ ...own, state: 'sick' })).toBe(false);
    expect(canLendToMenagerie({ state: 'home', kind: 'loan', isChick: false })).toBe(false);
    expect(canLendToMenagerie({ state: 'home', kind: 'own', isChick: true })).toBe(false);
    expect(regenerates('brooding')).toBe(true);
    expect(regenerates('vet')).toBe(false);
    expect(regenerates('flying')).toBe(false);
  });

  it('renaming once per calendar year, at most 50 own owls, random sex', () => {
    expect(canRenameInYear(null, 2026)).toBe(true);
    expect(canRenameInYear(2026, 2026)).toBe(false);
    expect(canRenameInYear(2025, 2026)).toBe(true);
    expect(canBuyMore(OWL.MAX_OWN_OWLS - 1)).toBe(true);
    expect(canBuyMore(OWL.MAX_OWN_OWLS)).toBe(false);
    expect(randomSex(0.1)).toBe('f');
    expect(randomSex(0.9)).toBe('m');
    expect(speciesById('nope')).toBe(undefined);
    expect(SPECIES.every((species) => speciesById(species.id) === species)).toBe(true);
  });
});
