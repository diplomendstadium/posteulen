import { describe, expect, it } from 'vitest';
import { SPECIES, OWL_IMAGE_KINDS, owlImageFileName } from '../src/species.ts';
import { GOLD, LETTER, MAP, SECURITY } from '../src/constants.ts';
import { OWL_NAMES, AUNT_NAMES, UNCLE_NAMES } from '../src/names-data.ts';
import { VERSION } from '../src/version.ts';

describe('species (SPEC Anhang B, 9.2.1)', () => {
  it('has 25 species with unique ids and image names', () => {
    expect(SPECIES).toHaveLength(25);
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(25);
    expect(new Set(SPECIES.map((s) => s.imageName)).size).toBe(25);
  });

  it('keeps all values inside the ranges of SPEC 9.2.1', () => {
    for (const s of SPECIES) {
      expect(s.price).toBeGreaterThanOrEqual(6);
      expect(s.price).toBeLessThanOrEqual(50);
      expect(s.maxEnergy).toBeGreaterThanOrEqual(100);
      expect(s.maxEnergy).toBeLessThanOrEqual(1200);
      expect(s.speedFactor).toBeGreaterThanOrEqual(0.5);
      expect(s.speedFactor).toBeLessThanOrEqual(2);
      expect(s.recoveryFactor).toBeGreaterThanOrEqual(0.5);
      expect(s.recoveryFactor).toBeLessThanOrEqual(2);
    }
  });

  it('uses image names without umlauts or spaces (SPEC Anhang B)', () => {
    for (const s of SPECIES) expect(s.imageName).toMatch(/^[A-Z][A-Za-z-]*$/);
  });

  it('builds the file names of Anhang B', () => {
    expect(OWL_IMAGE_KINDS).toHaveLength(7);
    expect(owlImageFileName('Waldkauz', '')).toBe('Waldkauz.png');
    expect(owlImageFileName('Waldkauz', 'Kueken')).toBe('Waldkauz-Kueken.png');
    expect(OWL_IMAGE_KINDS.map((k) => owlImageFileName('Uhu', k.suffix))).toEqual([
      'Uhu.png',
      'Uhu-Abflug.png',
      'Uhu-Ankunft.png',
      'Uhu-Fuettern.png',
      'Uhu-Streicheln.png',
      'Uhu-Grummelig.png',
      'Uhu-Kueken.png',
    ]);
  });
});

describe('constants (SPEC Anhang A)', () => {
  it('stores gold in tenths', () => {
    expect(GOLD.START).toBe(30);
    expect(GOLD.TRANSFER_MAX).toBe(200);
    expect(GOLD.TRANSFER_MIN_REMAINING_EXCLUSIVE).toBe(100);
  });

  it('keeps padding lengths and limits', () => {
    expect(LETTER.SMALL_PADDED_BYTES).toBe(4096);
    expect(LETTER.LARGE_PADDED_BYTES).toBe(16384);
    expect(SECURITY.MAX_REQUEST_BYTES).toBe(65536);
    expect(SECURITY.ARGON2_MEMORY_KIB).toBe(65536);
  });

  it('describes a sensible map section', () => {
    expect(MAP.WEST_LON).toBeLessThan(MAP.EAST_LON);
    expect(MAP.SOUTH_LAT).toBeLessThan(MAP.NORTH_LAT);
  });

  it('has the name lists of Anhang D and E', () => {
    expect(OWL_NAMES).toHaveLength(99);
    expect(new Set(OWL_NAMES).size).toBe(OWL_NAMES.length);
    expect(UNCLE_NAMES).toHaveLength(50);
    expect(AUNT_NAMES).toHaveLength(49);
  });

  it('has a semantic version', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });
});
