import fs from 'node:fs';
import path from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  cellIndex,
  isLand,
  MASK_BYTES,
  MASK_HEIGHT,
  MASK_WIDTH,
  roundHome,
} from '../src/map/landmask.ts';
import { project, unproject } from '../src/map/projection.ts';

const mask = new Uint8Array(
  fs.readFileSync(path.resolve(import.meta.dirname, '../data/landmask.bin')),
);

describe('land/water mask (SPEC 12.3)', () => {
  it('has the size of the 0.02° grid', () => {
    expect([MASK_WIDTH, MASK_HEIGHT]).toEqual([1735, 1240]);
    expect(mask).toHaveLength(MASK_BYTES);
  });

  it.each([
    ['Berlin', 52.52, 13.405, true],
    ['Lissabon', 38.72, -9.14, true],
    ['Bergen', 60.39, 5.32, true],
    ['Algier (Nordafrika)', 36.75, 3.05, true],
    ['Sofia', 42.7, 23.32, true],
    ['Nordsee', 55.0, 3.0, false],
    ['Atlantik', 45.0, -8.0, false],
    ['Mittelmeer', 39.0, 5.0, false],
    ['Genfersee', 46.45, 6.55, false],
    ['Bodensee', 47.6, 9.4, false],
    ['außerhalb (New York)', 40.7, -74.0, false],
    ['außerhalb (Moskau)', 55.75, 37.6, false],
  ])('%s → Land: %s', (_name, lat, lon, land) => {
    expect(isLand(mask, lat, lon)).toBe(land);
  });

  it('treats invalid input as water and rejects a wrong mask', () => {
    expect(cellIndex(Number.NaN, 10)).toBe(-1);
    expect(isLand(mask, Number.POSITIVE_INFINITY, 10)).toBe(false);
    expect(() => isLand(new Uint8Array(10), 50, 10)).toThrow();
  });

  it('rounds homes to 0.01°', () => {
    expect(roundHome(52.5249, 13.4051)).toEqual({ latE2: 5252, lonE2: 1341 });
  });
});

describe('LAEA projection', () => {
  it('round-trips every point of the map section (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 35.8, max: 60.6, noNaN: true }),
        fc.double({ min: -10.7, max: 24, noNaN: true }),
        (lat, lon) => {
          const p = project(lat, lon);
          const back = unproject(p.x, p.y);
          expect(back.lat).toBeCloseTo(lat, 9);
          expect(back.lon).toBeCloseTo(lon, 9);
        },
      ),
    );
  });

  it('is centred on 52° N, 10° E', () => {
    expect(project(52, 10)).toEqual({ x: 0, y: 0 });
    expect(unproject(0, 0)).toEqual({ lat: 52, lon: 10 });
  });
});
