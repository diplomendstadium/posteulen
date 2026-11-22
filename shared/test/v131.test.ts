/**
 * Version 1.3.1 (pure rules): pairs and eggs (SPEC 9.9), passwords that are too easy to guess
 * (7.2), names of Anhang D, pictures at night (9.2.6), loan owls in both languages (9.6).
 */
import { describe, expect, it } from 'vitest';
import { OWL, TIME } from '../src/constants.ts';
import { eggProbability, metOnVisit, pairedAtHome, readyTogether } from '../src/game/pairs.ts';
import { laysEggs, loanIdentities } from '../src/game/chance.ts';
import { commonPasswords, passwordWeakness } from '../src/security/password.ts';
import { owlNames } from '../src/names-data.ts';
import { imageKindsOf, SPECIES } from '../src/species.ts';

const H = TIME.HOUR;
const D = TIME.DAY;
/** 2026-11-20 12:00 UTC. */
const AT = Date.parse('2026-11-20T12:00:00Z');
const MIDNIGHT = Date.parse('2026-11-20T00:00:00Z');

describe('pairs (SPEC 9.9)', () => {
  it('time ready together: both from their start, minus every time either was not ready', () => {
    const a = { from: 0, notReady: [{ since: 2 * H, until: 4 * H }] };
    const b = {
      from: H,
      notReady: [
        { since: 3 * H, until: 5 * H },
        { since: 9 * H, until: null },
      ],
    };
    // 1–10 h together, minus 2–5 h (merged) and 9–10 h (b still away).
    expect(readyTogether(a, b, 0, 10 * H, 10 * H)).toBe(5 * H);
  });

  it('at home: more than 6 hours on at least 2 of the last 7 days', () => {
    const always = { from: 0, notReady: [] };
    expect(pairedAtHome(always, always, AT)).toBe(true);
    // Only today (12 hours) – one day is not enough.
    const sinceToday = { from: MIDNIGHT, notReady: [] };
    expect(pairedAtHome(sinceToday, always, AT)).toBe(false);
    // Yesterday from 18:00 (6 hours exactly, not more) and today: not enough.
    const fromSix = { from: MIDNIGHT - 6 * H, notReady: [] };
    expect(pairedAtHome(fromSix, always, AT)).toBe(false);
    const fromFive = { from: MIDNIGHT - 7 * H, notReady: [] };
    expect(pairedAtHome(fromFive, always, AT)).toBe(true);
    // Away for more than a week before: older days do not count.
    const away = { from: 0, notReady: [{ since: AT - 20 * D, until: MIDNIGHT - 7 * H }] };
    expect(pairedAtHome(away, always, AT)).toBe(true);
    const awayLonger = { from: 0, notReady: [{ since: AT - 20 * D, until: MIDNIGHT - 5 * H }] };
    expect(pairedAtHome(awayLonger, always, AT)).toBe(false);
    expect(OWL.PAIR_WINDOW_DAYS).toBe(7);
  });

  it('on a visit: at least 2 hours of the rest next to a ready male', () => {
    const male = { from: 0, notReady: [{ since: 10 * H, until: 11 * H }] };
    expect(metOnVisit(male, 8 * H, 10 * H)).toBe(true);
    expect(metOnVisit(male, 9 * H, 12 * H)).toBe(true);
    expect(metOnVisit(male, 9 * H, 11.5 * H)).toBe(false);
    expect(metOnVisit({ from: 9 * H, notReady: [] }, 8 * H, 10 * H)).toBe(false);
  });

  it('eggs: 1/100, twice with one rule, three times (not four) with both', () => {
    expect(eggProbability(false, false)).toBe(OWL.EGG_PROBABILITY);
    expect(eggProbability(true, false)).toBe(2 * OWL.EGG_PROBABILITY);
    expect(eggProbability(false, true)).toBe(2 * OWL.EGG_PROBABILITY);
    expect(eggProbability(true, true)).toBe(3 * OWL.EGG_PROBABILITY);
    expect(laysEggs(0.025, eggProbability(true, false))).toBe(false);
    expect(laysEggs(0.025, eggProbability(true, true))).toBe(true);
    expect(laysEggs(0.005)).toBe(true);
  });
});

describe('passwords too easy to guess (SPEC 7.2)', () => {
  it('not the user name, not on the list, no simple pattern', async () => {
    const list = await commonPasswords();
    expect(list.size).toBeGreaterThan(5000);
    const weak = (password: string, name = 'Bob') => passwordWeakness(password, name, list);
    expect(weak('Alexander mag Eulen', 'Alex')).toBe('contains_name');
    // Compared like names: accents, ß, 0/o and 1/l/i do not help.
    expect(weak('Ich heiße René und mag Eulen', 'Rene')).toBe('contains_name');
    expect(weak('Mein Name ist J0nas Müller', 'Jonas')).toBe('contains_name');
    expect(weak('passwortpasswort')).toBe('common');
    expect(weak('123456789012345')).toBe('common');
    expect(weak('IloveYouForever')).toBe('common');
    expect(weak('qwertzuiopasdfgh')).toBe('pattern');
    expect(weak('Hallo123Hallo123')).toBe('pattern');
    expect(weak('abcdefghijklmn2024!')).toBe('pattern');
    expect(weak('1qay2wsx3edc4rfv')).toBe('pattern');
    expect(weak('ababababababababa')).toBe('pattern');
    expect(weak('Eulenpost fliegt nachts weit')).toBeNull();
    expect(weak('Mein Hund heißt Bello und schnarcht')).toBeNull();
    // Short names (two characters) are not checked.
    expect(weak('Ein Satz mit Bo darin, lang genug', 'Bo')).toBeNull();
  });
});

describe('names and pictures (v1.3.1)', () => {
  it('Anhang D: removed names are gone from the German lists', () => {
    expect(owlNames('de', 'm')).not.toEqual(expect.arrayContaining(['Eli']));
    for (const name of ['Eli', 'Kiki']) expect(owlNames('de', 'm')).not.toContain(name);
    for (const name of ['Neo', 'Niko', 'Pino', 'Rio', 'Wendelin'])
      expect(owlNames('de', 'f')).not.toContain(name);
    // Still there for the other sex.
    expect(owlNames('de', 'f')).toContain('Eli');
    expect(owlNames('de', 'm')).toContain('Wendelin');
  });

  it('brooding and healthy again at night (none for the phoenix)', () => {
    const owl = SPECIES.find((species) => species.id === 'waldkauz')!;
    const phoenix = SPECIES.find((species) => species.mythical)!;
    const kinds = imageKindsOf(owl).map((kind) => kind.kind);
    expect(kinds).toEqual(expect.arrayContaining(['broodingNight', 'healthyNight']));
    expect(imageKindsOf(phoenix).map((kind) => kind.kind)).not.toContain('broodingNight');
  });

  it('a loan owl keeps its sex when another name is looked for (both languages alike)', () => {
    // Every attempt would bring the same name: the clash only changes the name.
    const bytes = (attempt: number) => Uint8Array.from([0, 0, attempt, attempt, 9, 9, 1]);
    const ids = loanIdentities(['waldkauz', 'bartkauz', 'schneeeule'], (_s, n) => bytes(n));
    expect(new Set(ids.map((id) => id.sex)).size).toBe(1);
    expect(new Set(ids.map((id) => id.name)).size).toBe(3);
  });
});
