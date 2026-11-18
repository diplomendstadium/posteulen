/**
 * Version 1.2.1: the desk pictures of the letters page by season, the order of the owl overview
 * and the Virginiauhu at 65 km/h.
 */
import { describe, expect, it } from 'vitest';
import { owlSpeedKmh } from '../src/game/flight.ts';
import { expectedBack, overviewOrder, speciesById, type OverviewOwl } from '../src/game/owls.ts';
import { deskSeason, deskSeasonOfDate } from '../src/game/season.ts';
import { SCENE_IMAGES } from '../src/species.ts';

describe('desk pictures by season (SPEC 9.11)', () => {
  const at = (month: number, day: number, year = 2026) => deskSeasonOfDate({ year, month, day });

  it('follows the calendar: Christmas, winter, spring, summer, autumn, November', () => {
    // 2026: first Advent on 29 November.
    expect(at(11, 28)).toBe('november');
    expect(at(11, 29)).toBe('christmas');
    expect(at(12, 26)).toBe('christmas');
    expect(at(12, 27)).toBe('winter');
    expect(at(1, 1)).toBe('winter');
    expect(at(2, 28)).toBe('winter');
    expect(at(2, 29, 2028)).toBe('winter');
    expect(at(3, 1)).toBe('spring');
    expect(at(5, 31)).toBe('spring');
    expect(at(6, 1)).toBe('summer');
    expect(at(8, 31)).toBe('summer');
    expect(at(9, 1)).toBe('autumn');
    expect(at(10, 31)).toBe('autumn');
    expect(at(11, 1)).toBe('november');
    // 2024: first Advent on 1 December – the first of December is Christmas, the 30th November.
    expect(at(11, 30, 2024)).toBe('november');
    expect(at(12, 1, 2024)).toBe('christmas');
    // 2025: first Advent on 30 November.
    expect(at(11, 29, 2025)).toBe('november');
    expect(at(11, 30, 2025)).toBe('christmas');
  });

  it('uses the local date at home – the same dates worldwide', () => {
    // 28 February 23:30 UTC: still winter in London, already spring in Tokyo.
    const moment = Date.UTC(2026, 1, 28, 23, 30);
    expect(deskSeason(moment, 51.5, -0.1)).toBe('winter');
    expect(deskSeason(moment, 35.7, 139.7)).toBe('spring');
    // The southern hemisphere has the same calendar seasons (decision of the client).
    expect(deskSeason(Date.UTC(2026, 6, 1, 12), -33.87, 151.2)).toBe('summer');
  });

  it('has a desk picture by day and by night for every season, and no letters picture any more', () => {
    const files = SCENE_IMAGES.map((scene) => scene.file);
    for (const season of ['Weihnachten', 'Winter', 'Fruehling', 'Sommer', 'Herbst', 'November']) {
      expect(files).toContain(`Schreibtisch-${season}-Tag.png`);
      expect(files).toContain(`Schreibtisch-${season}-Nacht.png`);
    }
    expect(files).not.toContain('Briefwechsel.png');
    expect(files).toContain('Menagerie-Innen-Weihnachten-Nacht.png');
  });
});

describe('order of the owl overview (SPEC 8.5)', () => {
  const owl = (name: string, values: Partial<OverviewOwl> = {}): OverviewOwl => ({
    name,
    ready: true,
    energy: 50,
    maxEnergy: 100,
    stateUntil: null,
    adultAt: null,
    absence: null,
    ...values,
  });
  const names = (list: readonly OverviewOwl[]) => list.map((entry) => entry.name);
  const compare = (a: string, b: string) => a.localeCompare(b, 'de');

  it('puts the ready owls on top, the fullest energy in per cent first', () => {
    const { ready, busy } = overviewOrder(
      [
        owl('Bruno', { energy: 300, maxEnergy: 1000 }),
        owl('Anni', { energy: 90, maxEnergy: 100 }),
        owl('Cleo', { energy: 45, maxEnergy: 50 }),
        owl('Dora', { energy: 0, maxEnergy: 0 }),
      ],
      compare,
    );
    // Equal shares by name; an empty maximum counts as empty.
    expect(names(ready)).toEqual(['Anni', 'Cleo', 'Bruno', 'Dora']);
    expect(busy).toEqual([]);
  });

  it('sorts the others by the expected return, unknown last', () => {
    const away = (returnsAt: number | null, nextStop?: number) => ({
      returnsAt,
      ...(nextStop === undefined ? {} : { nextStop: { arrivesAt: nextStop } }),
    });
    const { ready, busy } = overviewOrder(
      [
        owl('Flieger', { ready: false, absence: away(5000) }),
        owl('Krank', { ready: false, stateUntil: 3000 }),
        owl('Küken', { ready: false, adultAt: 9000 }),
        owl('Leihe', { ready: false, absence: away(null, 4000) }),
        owl('Rätsel', { ready: false }),
        owl('Anderes Rätsel', { ready: false }),
        owl('Daheim'),
      ],
      compare,
    );
    expect(names(ready)).toEqual(['Daheim']);
    expect(names(busy)).toEqual(['Krank', 'Leihe', 'Flieger', 'Küken', 'Anderes Rätsel', 'Rätsel']);
    expect(expectedBack(owl('x', { absence: away(7000), stateUntil: 1 }))).toBe(7000);
    expect(expectedBack(owl('x'))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('Virginiauhu (SPEC 9.2.2)', () => {
  it('flies at 65 km/h', () => {
    expect(owlSpeedKmh(speciesById('virginiauhu')!.speedFactor)).toBeCloseTo(65, 6);
  });
});
