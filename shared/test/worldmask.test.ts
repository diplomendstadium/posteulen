/** v0.8: the coarse world mask – bots live anywhere on land (SPEC 12.3). */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isLandAnywhere,
  MASK_BYTES,
  WORLD_MASK_BYTES,
  worldCellIndex,
} from '../src/map/landmask.ts';

const data = path.resolve(import.meta.dirname, '../data');
const section = new Uint8Array(fs.readFileSync(path.join(data, 'landmask.bin')));
const world = new Uint8Array(fs.readFileSync(path.join(data, 'worldmask.bin')));

describe('world land mask (v0.8)', () => {
  it('has the expected size', () => {
    expect(section.length).toBe(MASK_BYTES);
    expect(world.length).toBe(WORLD_MASK_BYTES);
  });

  it.each([
    ['Sydney', -33.87, 151.0, true],
    ['New York', 40.7, -74.0, true],
    ['Tokyo', 35.7, 139.7, true],
    ['Cape Town', -33.9, 18.5, true],
    ['Berlin (section)', 52.52, 13.4, true],
    ['North Sea (section)', 55, 3, false],
    ['Pacific', 0, -150, false],
    ['Atlantic', 30, -40, false],
  ])('%s', (_name, lat, lon, land) => {
    expect(isLandAnywhere(section, world, lat, lon)).toBe(land);
  });

  it('wraps longitudes and rejects invalid coordinates', () => {
    expect(worldCellIndex(10, 190)).toBe(worldCellIndex(10, -170));
    expect(worldCellIndex(91, 0)).toBe(-1);
    expect(worldCellIndex(Number.NaN, 0)).toBe(-1);
    expect(isLandAnywhere(section, world, 95, 0)).toBe(false);
    expect(() => isLandAnywhere(section, new Uint8Array(3), 0, -150)).toThrow();
  });
});
