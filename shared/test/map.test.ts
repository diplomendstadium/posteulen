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
import { project, projectRelative, relativeLongitude, unproject } from '../src/map/projection.ts';

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

describe('Equal Earth projection (v0.7: the whole world)', () => {
  it('round-trips every point of the world (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -89.9, max: 89.9, noNaN: true }),
        fc.double({ min: -179.9, max: 179.9, noNaN: true }),
        (lat, lon) => {
          const p = project(lat, lon);
          const back = unproject(p.x, p.y);
          expect(back.lat).toBeCloseTo(lat, 9);
          expect(back.lon).toBeCloseTo(lon, 9);
        },
      ),
    );
  });

  it('is centred on 10° E and the equator', () => {
    expect(project(0, 10)).toEqual({ x: 0, y: 0 });
    expect(unproject(0, 0)).toEqual({ lat: 0, lon: 10 });
    expect(project(52, 10).x).toBe(0);
    expect(project(52, 10).y).toBeGreaterThan(0);
  });

  it('keeps the edge of the world on its side and wraps longitudes', () => {
    expect(relativeLongitude(190)).toBe(180);
    expect(relativeLongitude(-170)).toBe(180);
    expect(relativeLongitude(-169)).toBe(-179);
    expect(projectRelative(0, 180).x).toBeCloseTo(-projectRelative(0, -180).x, 9);
    expect(project(0, -170).x).toBeGreaterThan(0);
    // The world is about twice as wide as high (Equal Earth: 2.05).
    const width = 2 * projectRelative(0, 180).x;
    const height = 2 * projectRelative(90, 0).y;
    expect(width / height).toBeCloseTo(2.05, 2);
  });

  it('is equal-area: one square degree at the equator and at 60° N', () => {
    const area = (lat: number): number => {
      const a = project(lat, 10);
      const b = project(lat + 0.01, 10.01);
      return Math.abs((b.x - a.x) * (b.y - a.y));
    };
    // Spherical area ratio of the two cells: cos 60° (shear makes the box a small overestimate).
    expect(area(60) / area(0)).toBeCloseTo(Math.cos((60 * Math.PI) / 180), 1);
  });
});
