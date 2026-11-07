import { describe, expect, it } from 'vitest';
import {
  clampMotivation,
  interactionsOn,
  isCareDay,
  motivationAfter,
  motivationFactor,
  motivationPercent,
  motivationShare,
  nightlyMotivation,
} from '../src/game/motivation.ts';
import { energyAfterSnack } from '../src/game/energy.ts';
import { SPECIES } from '../src/species.ts';
import { speciesSnack } from '../src/texts/species.ts';

describe('motivation (v0.5)', () => {
  it('stays between 0.8 and 1.2 in steps of 0.1', () => {
    expect(clampMotivation(5)).toBe(8);
    expect(clampMotivation(15)).toBe(12);
    expect(motivationFactor(11)).toBe(1.1);
    expect(motivationPercent(12)).toBe(20);
    expect(motivationPercent(8)).toBe(-20);
    expect(motivationShare(8)).toBe(0);
    expect(motivationShare(10)).toBe(0.5);
    expect(motivationShare(12)).toBe(1);
  });

  it('sinks every night and rises once a day per kind of care', () => {
    expect(nightlyMotivation(10)).toBe(9);
    expect(nightlyMotivation(8)).toBe(8);
    expect(motivationAfter(10, false)).toBe(11);
    expect(motivationAfter(10, true)).toBe(10);
    expect(motivationAfter(12, false)).toBe(12);
  });

  it('a day counts as cared for with two different interactions', () => {
    const today = '2026-11-07';
    const last = { water: today, pet: '2026-11-06', feed: null, snack: today };
    expect(interactionsOn(last, today)).toEqual(['water', 'snack']);
    expect(isCareDay(1)).toBe(false);
    expect(isCareDay(2)).toBe(true);
  });

  it('the favourite snack gives 20 % × recovery and has a name per species', () => {
    const waldkauz = SPECIES.find((species) => species.id === 'waldkauz')!;
    expect(energyAfterSnack(100, waldkauz)).toBe(235);
    expect(energyAfterSnack(500, waldkauz)).toBe(540);
    expect(speciesSnack('waldkauz')).toBe('Haselnüsse');
    expect(speciesSnack('phoenix', 'en')).toBe('silver leaf');
    expect(speciesSnack('unbekannt')).toBe('Lieblingsleckerli');
    expect(speciesSnack('unbekannt', 'en')).toBe('favourite snack');
    for (const species of SPECIES) expect(speciesSnack(species.id)).not.toBe('Lieblingsleckerli');
  });
});
