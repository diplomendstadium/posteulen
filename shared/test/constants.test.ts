import { describe, expect, it } from 'vitest';
import {
  SPECIES,
  OWL_IMAGE_KINDS,
  SCENE_IMAGES,
  imageKindsOf,
  owlImageFileName,
} from '../src/species.ts';
import { GOLD, LETTER, MAP, SECURITY } from '../src/constants.ts';
import { OWL_NAMES } from '../src/names-data.ts';
import { VERSION } from '../src/version.ts';

describe('species (SPEC Anhang B, 9.2.1)', () => {
  it('has 19 species (v0.5 the phoenix, v0.8.4 the Virginiauhu) with unique ids and image names', () => {
    expect(SPECIES).toHaveLength(19);
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(19);
    expect(new Set(SPECIES.map((s) => s.imageName)).size).toBe(19);
    // v0.8.4: the Virginiauhu – a special species bots may use, never for sale.
    expect(SPECIES.find((s) => s.id === 'virginiauhu')).toMatchObject({
      price: 80,
      maxEnergy: 1300,
      speedFactor: 3.4,
      recoveryFactor: 2,
      mythical: true,
      notForSale: true,
      forBots: true,
    });
    const phoenix = SPECIES.filter((s) => s.mythical && !s.forBots);
    expect(phoenix).toEqual([
      expect.objectContaining({
        id: 'phoenix',
        price: 100,
        maxEnergy: 2000,
        speedFactor: 4,
        recoveryFactor: 2,
      }),
    ]);
  });

  it('keeps all values inside the ranges of SPEC 9.2.1', () => {
    for (const s of SPECIES.filter((species) => !species.mythical)) {
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

  it('v0.5.1: Sumpfohreule 7 gold, Bartkauz 12 gold', () => {
    expect(SPECIES.find((s) => s.id === 'sumpfohreule')?.price).toBe(7);
    expect(SPECIES.find((s) => s.id === 'bartkauz')?.price).toBe(12);
  });

  it('uses image names without umlauts or spaces (SPEC Anhang B)', () => {
    for (const s of SPECIES) expect(s.imageName).toMatch(/^[A-Z][A-Za-z-]*$/);
  });

  it('builds the file names of Anhang B', () => {
    expect(OWL_IMAGE_KINDS).toHaveLength(17);
    expect(owlImageFileName('Waldkauz', '')).toBe('Waldkauz.png');
    expect(owlImageFileName('Waldkauz', 'Kueken')).toBe('Waldkauz-Kueken.png');
    expect(owlImageFileName('Maehnenkauz', 'Abflug')).toBe('Maehnenkauz-Abflug.png');
    expect(OWL_IMAGE_KINDS.map((k) => owlImageFileName('Schleiereule', k.suffix))).toEqual([
      'Schleiereule.png',
      'Schleiereule-Abflug.png',
      'Schleiereule-Ankunft.png',
      'Schleiereule-Fuettern.png',
      'Schleiereule-Streicheln.png',
      'Schleiereule-Grummelig.png',
      'Schleiereule-Kueken.png',
      'Schleiereule-Tagflug.png',
      'Schleiereule-Nachtflug.png',
      'Schleiereule-Heimkehr-Tag.png',
      'Schleiereule-Heimkehr-Nacht.png',
      'Schleiereule-Trinken.png',
      'Schleiereule-Leckerli.png',
      'Schleiereule-Nachtpause.png',
      'Schleiereule-Tagschlaf-Unterwegs.png',
      'Schleiereule-Tagschlaf-Zuhause.png',
      'Schleiereule-Brueten.png',
    ]);
  });

  it('gives the phoenix neither a chick nor a brooding picture (v0.7)', () => {
    const phoenix = SPECIES.find((s) => s.mythical);
    const owl = SPECIES.find((s) => !s.mythical);
    expect(phoenix && imageKindsOf(phoenix).map((k) => k.kind)).not.toContain('brooding');
    expect(phoenix && imageKindsOf(phoenix)).toHaveLength(15);
    expect(owl && imageKindsOf(owl)).toHaveLength(17);
    expect(SCENE_IMAGES.map((scene) => scene.file)).toContain('Verbrennen.png');
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
    expect(LETTER.LARGE_PADDED_BYTES).toBe(65536);
    expect(LETTER.LEGACY_LARGE_PADDED_BYTES).toBe(16384);
    expect(SECURITY.MAX_REQUEST_BYTES).toBe(65536);
    // v0.6: five large letters (padded, plus tag and both wrapped keys) fit as Base64 (SPEC 6).
    const perLetter = Math.ceil(((LETTER.LARGE_PADDED_BYTES + 16 + 2 * 128) * 4) / 3) + 200;
    expect(LETTER.MAX_RECIPIENTS * perLetter).toBeLessThan(SECURITY.MAX_LETTER_REQUEST_BYTES);
    expect(SECURITY.MAX_BOT_LETTER_REQUEST_BYTES).toBeGreaterThan(LETTER.LARGE_MAX_CHARS * 4 * 2);
    expect(SECURITY.ARGON2_MEMORY_KIB).toBe(65536);
  });

  it('describes a sensible map section', () => {
    expect(MAP.WEST_LON).toBeLessThan(MAP.EAST_LON);
    expect(MAP.SOUTH_LAT).toBeLessThan(MAP.NORTH_LAT);
  });

  it('has the name list of Anhang D (v0.8: no names of aunt and uncle any more)', () => {
    expect(OWL_NAMES).toHaveLength(130);
    expect(new Set(OWL_NAMES).size).toBe(OWL_NAMES.length);
  });

  it('has a semantic version', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });
});
