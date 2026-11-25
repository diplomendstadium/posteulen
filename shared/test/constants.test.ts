import { describe, expect, it } from 'vitest';
import {
  SPECIES,
  OWL_IMAGE_KINDS,
  SCENE_IMAGES,
  imageKindsOf,
  owlImageFileName,
} from '../src/species.ts';
import { GOLD, LETTER, MAP, SECURITY } from '../src/constants.ts';
import {
  anyOwlNames,
  OWL_NAMES_EN_F,
  OWL_NAMES_EN_M,
  OWL_NAMES_F,
  OWL_NAMES_M,
  owlNames,
} from '../src/names-data.ts';
import { VERSION } from '../src/version.ts';

describe('species (SPEC Anhang B, 9.2.1)', () => {
  it('has 21 species (v0.5 the phoenix, v0.8.4 the Virginiauhu, v1.1 two more) with unique ids and image names', () => {
    expect(SPECIES).toHaveLength(21);
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(21);
    expect(new Set(SPECIES.map((s) => s.imageName)).size).toBe(21);
    // v0.10: the Virginiauhu is an ordinary species (v0.8.4: 80, not for sale; v1.1: 68 gold).
    const virginiauhu = SPECIES.find((s) => s.id === 'virginiauhu');
    expect(virginiauhu).toMatchObject({
      price: 68,
      maxEnergy: 1300,
      speedFactor: 2.6,
      recoveryFactor: 2,
      cargo: 'gold',
    });
    expect(virginiauhu?.mythical).toBeUndefined();
    expect(virginiauhu?.notForSale).toBeUndefined();
    // Only the phoenix is mythical; v0.10 for 150 gold (before 100).
    const phoenix = SPECIES.filter((s) => s.mythical);
    expect(phoenix).toEqual([
      expect.objectContaining({
        id: 'phoenix',
        price: 150,
        maxEnergy: 2000,
        speedFactor: 4,
        recoveryFactor: 2,
      }),
    ]);
  });

  it('keeps all values inside the ranges of SPEC 9.2.1', () => {
    // The Virginiauhu (v0.8.4, for sale since v0.10) stays above the usual ranges on purpose,
    // and so does the recovery of the Ostkreischeule (v1.1, 30 % per hour, checked below).
    for (const s of SPECIES.filter(
      (species) => !species.mythical && species.id !== 'virginiauhu',
    )) {
      expect(s.price).toBeGreaterThanOrEqual(6);
      expect(s.price).toBeLessThanOrEqual(50);
      expect(s.maxEnergy).toBeGreaterThanOrEqual(100);
      expect(s.maxEnergy).toBeLessThanOrEqual(1200);
      expect(s.speedFactor).toBeGreaterThanOrEqual(0.5);
      expect(s.speedFactor).toBeLessThanOrEqual(2);
      expect(s.recoveryFactor).toBeGreaterThanOrEqual(0.5);
      expect(s.recoveryFactor).toBeLessThanOrEqual(s.id === 'ostkreischeule' ? 3 : 2);
    }
  });

  it('v0.10: what each species carries (SPEC 9.2.1)', () => {
    const by = (cargo: string) =>
      SPECIES.filter((s) => s.cargo === cargo)
        .map((s) => s.id)
        .sort();
    // v1.2.4: eight small and medium species carry only the short parchment.
    expect(by('short')).toEqual(
      [
        'elfenkauz',
        'kanincheneule',
        'maehnenkauz',
        'ostkreischeule',
        'schleiereule',
        'suedliche-weissgesichtseule',
        'waldohreule',
        'zypernzwergohreule',
      ].sort(),
    );
    expect(by('long')).toEqual(['haubenkauz', 'maskeneule', 'sumpfohreule', 'waldkauz'].sort());
    expect(by('gold')).toEqual(
      [
        'bartkauz',
        'brillenkauz',
        'milchuhu',
        'phoenix',
        'riesenfischuhu',
        'riesenkauz',
        'schneeeule',
        'sperbereule',
        'virginiauhu',
      ].sort(),
    );
  });

  it('Sumpfohreule 10 gold (v1.2.4), Bartkauz 12 gold', () => {
    expect(SPECIES.find((s) => s.id === 'sumpfohreule')?.price).toBe(10);
    expect(SPECIES.find((s) => s.id === 'bartkauz')?.price).toBe(12);
  });

  it('uses image names without umlauts or spaces (SPEC Anhang B)', () => {
    for (const s of SPECIES) expect(s.imageName).toMatch(/^[A-Z][A-Za-z-]*$/);
  });

  it('builds the file names of Anhang B', () => {
    expect(OWL_IMAGE_KINDS).toHaveLength(32);
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
      'Schleiereule-Nacht.png',
      'Schleiereule-Weihnachten-Tag.png',
      'Schleiereule-Weihnachten-Nacht.png',
      'Schleiereule-Weihnachten-Schlaf.png',
      'Schleiereule-Grummelig-Nacht.png',
      'Schleiereule-Krank.png',
      'Schleiereule-Krank-Nacht.png',
      'Schleiereule-Medizin.png',
      'Schleiereule-Gesund.png',
      'Schleiereule-Brueten-Nacht.png',
      'Schleiereule-Gesund-Nacht.png',
      'Schleiereule-Langeweile.png',
      'Schleiereule-Langeweile-Nacht.png',
      'Schleiereule-Frei.png',
      'Schleiereule-Frei-Nacht.png',
    ]);
  });

  it('gives the phoenix neither a chick nor a brooding picture, nor pictures of illness', () => {
    const phoenix = SPECIES.find((s) => s.mythical);
    const owl = SPECIES.find((s) => !s.mythical);
    expect(phoenix && imageKindsOf(phoenix).map((k) => k.kind)).not.toContain('brooding');
    expect(phoenix && imageKindsOf(phoenix)).toHaveLength(24);
    expect(owl && imageKindsOf(owl)).toHaveLength(32);
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

  it('has the four name lists of Anhang D, by sex and language, without doubles', () => {
    expect(OWL_NAMES_M).toHaveLength(107);
    expect(OWL_NAMES_F).toHaveLength(102);
    expect(OWL_NAMES_EN_M).toHaveLength(109);
    expect(OWL_NAMES_EN_F).toHaveLength(109);
    for (const list of [OWL_NAMES_M, OWL_NAMES_F, OWL_NAMES_EN_M, OWL_NAMES_EN_F]) {
      expect(new Set(list).size).toBe(list.length);
    }
    expect(owlNames('de', 'm')).toBe(OWL_NAMES_M);
    expect(owlNames('en', 'f')).toBe(OWL_NAMES_EN_F);
    expect(OWL_NAMES_M).toContain('Adalbert');
    expect(OWL_NAMES_F).not.toContain('Adalbert');
    expect(anyOwlNames('de')).toContain('Adalbert');
    expect(anyOwlNames('de')).toContain('Adelheid');
  });

  it('has a semantic version', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });
});
