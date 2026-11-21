/**
 * Version 1.2.1: the desk pictures of the letters page by season and the Virginiauhu at 65 km/h
 * (the order of the owl overview changed in v1.3, see v130.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { owlSpeedKmh } from '../src/game/flight.ts';
import { speciesById } from '../src/game/owls.ts';
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

describe('Virginiauhu (SPEC 9.2.2)', () => {
  it('flies at 65 km/h', () => {
    expect(owlSpeedKmh(speciesById('virginiauhu')!.speedFactor)).toBeCloseTo(65, 6);
  });
});
