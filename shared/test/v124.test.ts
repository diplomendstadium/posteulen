/**
 * Version 1.2.4: species values of the client, the flown distance of a plan, a place for the
 * device's time zone (start page), the welcome and the descriptions in the post office and
 * the donation link of the info text.
 */
import { describe, expect, it } from 'vitest';
import { GOLD } from '../src/constants.ts';
import { flownKm, owlSpeedKmh, type Segment } from '../src/game/flight.ts';
import { distanceKm } from '../src/game/geo.ts';
import { parseInlines, parseMarkdown } from '../src/markdown.ts';
import { devicePlace, zonePlace } from '../src/map/zone-place.ts';
import { LOAN_TEAMS, SPECIES, speciesName } from '../src/species.ts';
import { ABOUT_DE, ABOUT_EN } from '../src/texts/about.ts';
import {
  LOAN_DESCRIPTIONS,
  LOAN_DESCRIPTIONS_EN,
  loanDescription,
  loanReady,
} from '../src/texts/species.ts';

const species = (id: string) => SPECIES.find((s) => s.id === id)!;

describe('species values (v1.2.4, SPEC Anhang B)', () => {
  it('has the new prices, speeds, recovery and energy of the client', () => {
    expect(species('sumpfohreule').price).toBe(10);
    expect(species('schleiereule')).toMatchObject({ speedFactor: 1.3, recoveryFactor: 1.3 });
    expect(species('sperbereule').recoveryFactor).toBe(1.2);
    expect(species('waldkauz')).toMatchObject({
      speedFactor: 1,
      recoveryFactor: 0.9,
      maxEnergy: 430,
    });
    expect(owlSpeedKmh(species('waldkauz').speedFactor)).toBe(25);
    // The Sperbereule of the post office text flies 50 km/h.
    expect(owlSpeedKmh(species('sperbereule').speedFactor)).toBe(50);
  });

  it('has no fee for the long parchment any more', () => {
    expect('LARGE_PARCHMENT_SURCHARGE' in GOLD).toBe(false);
  });
});

describe('flown distance of a plan (v1.2.4, SPEC 9.2)', () => {
  it('adds up the flight segments only', () => {
    const berlin = { lat: 52.52, lon: 13.4 };
    const hamburg = { lat: 53.55, lon: 9.99 };
    const plan: Segment[] = [
      { kind: 'fly', t0: 0, t1: 1, from: berlin, to: hamburg, e0: 0, e1: 0 },
      { kind: 'sleep', t0: 1, t1: 2, at: hamburg, e0: 0, e1: 0 },
      { kind: 'stop', t0: 2, t1: 3, at: hamburg, index: 0, e0: 0, e1: 0 },
      { kind: 'fly', t0: 3, t1: 4, from: hamburg, to: berlin, e0: 0, e1: 0 },
    ];
    expect(flownKm(plan)).toBeCloseTo(2 * distanceKm(berlin, hamburg), 9);
    expect(flownKm([])).toBe(0);
  });
});

describe('place of the device time zone (v1.2.4, SPEC 9.11)', () => {
  it('knows the main city of every zone, also under old names', () => {
    expect(zonePlace('Europe/Berlin')).toEqual({ lat: 52.5, lon: 13.4 });
    expect(zonePlace('Europe/Kiev')).toEqual(zonePlace('Europe/Kyiv'));
    expect(zonePlace('Australia/Sydney')?.lat).toBeLessThan(-30);
    expect(zonePlace('Mars/Olympus')).toBeNull();
  });

  it('falls back to 50° north at the longitude of the offset', () => {
    expect(devicePlace('America/New_York', 300)).toEqual(zonePlace('America/New_York'));
    // UTC+1 (offset −60 minutes) → 15° east; UTC−5 → 75° west.
    expect(devicePlace('UTC', -60)).toEqual({ lat: 50, lon: 15 });
    expect(devicePlace(undefined, 300)).toEqual({ lat: 50, lon: -75 });
    expect(devicePlace(undefined, -14 * 60).lon).toBe(180);
  });
});

describe('post office (v1.2.4, SPEC 9.6)', () => {
  it('names who is ready to travel, with “unser” and “unsere”', () => {
    const name = (id: string) => speciesName(id);
    expect(loanReady(LOAN_TEAMS.A, name)).toBe(
      'Im Moment sind unsere Sperbereule, unsere Ostkreischeule, unser Waldkauz, unsere Südliche Weißgesichtseule und unser Riesenfischuhu reisebereit.',
    );
    expect(loanReady(['bartkauz'], name)).toBe('Im Moment ist unser Bartkauz reisebereit.');
    expect(loanReady([], name)).toBe('');
    expect(loanReady(['waldkauz', 'schleiereule'], (id) => speciesName(id, 'en'), 'en')).toBe(
      'At the moment our Tawny Owl and our Barn Owl are ready to travel.',
    );
    expect(loanReady(['milchuhu'], (id) => speciesName(id, 'en'), 'en')).toBe(
      "At the moment our Verreaux's Eagle-Owl is ready to travel.",
    );
  });

  it('keeps the order of the teams of the client', () => {
    expect(LOAN_TEAMS.B[0]).toBe('zypernzwergohreule');
    expect(LOAN_TEAMS.D).toEqual([
      'waldohreule',
      'elfenkauz',
      'bartkauz',
      'haubenkauz',
      'virginiauhu',
    ]);
  });

  it('describes every loan species in both languages, without prices', () => {
    const loanSpecies = Object.values(LOAN_TEAMS).flat().sort();
    expect(Object.keys(LOAN_DESCRIPTIONS).sort()).toEqual(loanSpecies);
    expect(Object.keys(LOAN_DESCRIPTIONS_EN).sort()).toEqual(loanSpecies);
    for (const id of loanSpecies) {
      for (const text of [loanDescription(id, 'de'), loanDescription(id, 'en')]) {
        expect(text).toBeTruthy();
        expect(text).not.toMatch(/Gold,? für|\d+,\d+ Gold|\d+\.\d+ gold/);
      }
    }
    expect(loanDescription('phoenix')).toBeUndefined();
  });
});

describe('info text on the start page (v1.2.4, SPEC 8.1)', () => {
  it('links to the donation page with the keyword “donate” only', () => {
    expect(parseInlines('Jede [Spende](donate) hilft.')).toEqual([
      { kind: 'text', text: 'Jede ' },
      { kind: 'link', text: 'Spende', href: 'donate' },
      { kind: 'text', text: ' hilft.' },
    ]);
    expect(parseInlines('[x](donatex)')).toEqual([{ kind: 'text', text: '[x](donatex)' }]);
  });

  it('explains the costs, shows the homecoming owl and bolds “no in-app purchases”', () => {
    for (const text of [ABOUT_DE, ABOUT_EN]) {
      expect(text).toContain('](donate)');
      expect(text).toContain('![homecoming](left)');
      expect(text).not.toContain('![group]');
    }
    expect(ABOUT_DE).toContain('**Selbstverständlich gibt es auch keine In-App-Käufe.**');
    expect(ABOUT_EN).toContain('**Of course there are no in-app purchases either.**');
    expect(ABOUT_DE).toMatch(/10 € im Monat.*30 € im Monat/);
    expect(ABOUT_DE).toContain('Einladungscode');
    expect(ABOUT_EN).toContain('invitation code');
    const headings = (text: string) =>
      parseMarkdown(text)
        .filter((block) => block.kind === 'heading')
        .map((block) => (block.kind === 'heading' ? block.text : ''));
    expect(headings(ABOUT_DE)).toContain('Wer bezahlt das eigentlich?');
    expect(headings(ABOUT_EN)).toContain('Who pays for all this?');
  });
});
