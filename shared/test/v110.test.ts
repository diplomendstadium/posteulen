/** Version 1.1 (SPEC 9.11, 9.6, Anhang B): Christmas season, teams, new species. */
import { describe, expect, it } from 'vitest';
import {
  christmasPaper,
  firstAdvent,
  isChristmas,
  isChristmasDate,
  localDate,
} from '../src/game/season.ts';
import { LETTER } from '../src/constants.ts';
import { SPECIES } from '../src/species.ts';
import { owlSpeedKmh } from '../src/game/flight.ts';
import { speciesSnack, speciesDescription } from '../src/texts/species.ts';

const BERLIN = { lat: 52.52, lon: 13.4 };
const LISBON = { lat: 38.72, lon: -9.14 };

describe('Christmas season (v1.1, SPEC 9.11)', () => {
  it('finds the first Sunday of Advent between 27 November and 3 December', () => {
    expect(firstAdvent(2026)).toEqual({ month: 11, day: 29 });
    expect(firstAdvent(2025)).toEqual({ month: 11, day: 30 });
    expect(firstAdvent(2027)).toEqual({ month: 11, day: 28 });
    expect(firstAdvent(2022)).toEqual({ month: 11, day: 27 });
    expect(firstAdvent(2023)).toEqual({ month: 12, day: 3 });
    for (let year = 2020; year < 2060; year++) {
      const { month, day } = firstAdvent(year);
      expect(new Date(Date.UTC(year, month - 1, day)).getUTCDay()).toBe(0);
    }
  });

  it('lasts from the first Sunday of Advent to the end of 26 December', () => {
    expect(isChristmasDate({ year: 2026, month: 11, day: 28 })).toBe(false);
    expect(isChristmasDate({ year: 2026, month: 11, day: 29 })).toBe(true);
    expect(isChristmasDate({ year: 2026, month: 12, day: 24 })).toBe(true);
    expect(isChristmasDate({ year: 2026, month: 12, day: 26 })).toBe(true);
    expect(isChristmasDate({ year: 2026, month: 12, day: 27 })).toBe(false);
    expect(isChristmasDate({ year: 2026, month: 1, day: 5 })).toBe(false);
    expect(isChristmasDate({ year: 2023, month: 12, day: 2 })).toBe(false);
    expect(isChristmasDate({ year: 2023, month: 12, day: 3 })).toBe(true);
  });

  it('counts the local time at the home (time zone with summer time)', () => {
    // 28 Nov 2026, 23:30 UTC: in Berlin already the first Sunday of Advent, in Lisbon not yet.
    const at = Date.UTC(2026, 10, 28, 23, 30);
    expect(localDate(at, 'Europe/Berlin')).toEqual({ year: 2026, month: 11, day: 29 });
    expect(isChristmas(at, BERLIN.lat, BERLIN.lon)).toBe(true);
    expect(isChristmas(at, LISBON.lat, LISBON.lon)).toBe(false);
    // 26 Dec 2026, 23:30 UTC: in Berlin over, in Lisbon still 26 December.
    const end = Date.UTC(2026, 11, 26, 23, 30);
    expect(isChristmas(end, BERLIN.lat, BERLIN.lon)).toBe(false);
    expect(isChristmas(end, LISBON.lat, LISBON.lon)).toBe(true);
  });

  it('falls back to the device date for an unknown time zone', () => {
    const at = Date.UTC(2026, 11, 24, 12);
    const device = new Date(at);
    expect(localDate(at, 'Nirgendwo/Eulenturm')).toEqual({
      year: device.getFullYear(),
      month: device.getMonth() + 1,
      day: device.getDate(),
    });
  });

  it('picks one of four parchment pairs from HMAC bytes', () => {
    const seen = new Set<number>();
    for (let byte = 0; byte < 256; byte++) seen.add(christmasPaper(new Uint8Array([byte])));
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
    expect(christmasPaper(new Uint8Array([]))).toBe(1);
  });
});

describe('version 1.1 values', () => {
  it('offers 6 and 12 hours of rest as well', () => {
    expect(LETTER.REST_HOURS_CHOICES).toEqual([0, 1, 2, 6, 12, 24, 48]);
  });

  it('has the two new species with the values of the client', () => {
    const screech = SPECIES.find((species) => species.id === 'ostkreischeule');
    const scops = SPECIES.find((species) => species.id === 'zypernzwergohreule');
    expect(screech && Math.round(owlSpeedKmh(screech.speedFactor))).toBe(47);
    expect(screech?.maxEnergy).toBe(299);
    expect(screech?.recoveryFactor).toBe(3);
    expect(screech?.price).toBe(47);
    expect(screech?.cargo).toBe('long');
    expect(scops && Math.round(owlSpeedKmh(scops.speedFactor))).toBe(36);
    expect(scops?.maxEnergy).toBe(130);
    expect(scops?.recoveryFactor).toBe(1.9);
    expect(scops?.price).toBe(15);
    expect(scops?.cargo).toBe('short');
    for (const id of ['ostkreischeule', 'zypernzwergohreule']) {
      expect(speciesDescription(id, 'de')).toBeTruthy();
      expect(speciesDescription(id, 'en')).toBeTruthy();
    }
    expect(speciesSnack('zypernzwergohreule')).toBe('Erdnüsse');
  });

  it('raises the price of the Virginiauhu and gives it marshmallow mice', () => {
    expect(SPECIES.find((species) => species.id === 'virginiauhu')?.price).toBe(68);
    expect(speciesSnack('virginiauhu')).toBe('Speckmäuse');
    expect(speciesSnack('virginiauhu', 'en')).toBe('marshmallow mice');
    expect(speciesDescription('virginiauhu')).toContain('Speckmäuse');
  });
});
