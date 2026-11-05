import { describe, expect, it } from 'vitest';
import {
  chickCount,
  giftRequired,
  laysEggs,
  loanIdentity,
  papeterieWage,
  pastGracePeriod,
  pickOffer,
  randomOwlName,
  rollsSick,
  sicknessProbability,
  speciesPrice,
} from '../src/game/chance.ts';
import { OWL_NAMES } from '../src/names-data.ts';
import { SPECIES } from '../src/species.ts';

/** Fixed seed (SPEC 17.2). */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function rate(trials: number, event: (random: number) => boolean, seed = 7): number {
  const random = seeded(seed);
  let hits = 0;
  for (let i = 0; i < trials; i++) if (event(random())) hits++;
  return hits / trials;
}

describe('probabilities with a fixed seed (SPEC 17.2)', () => {
  it('sickness 1/30, with care bonus × 0.3', () => {
    expect(sicknessProbability(false)).toBeCloseTo(1 / 30, 10);
    expect(sicknessProbability(true)).toBeCloseTo(0.01, 10);
    expect(rate(300_000, (r) => rollsSick(r, false))).toBeCloseTo(1 / 30, 2);
    expect(rate(300_000, (r) => rollsSick(r, true))).toBeCloseTo(0.01, 2);
  });

  it('eggs 1/100', () => {
    expect(rate(300_000, laysEggs)).toBeCloseTo(0.01, 2);
    expect(laysEggs(0.0099)).toBe(true);
    expect(laysEggs(0.01)).toBe(false);
  });

  it('1–3 chicks, uniformly; gift required from two', () => {
    const random = seeded(3);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 90_000; i++) counts[chickCount(random())]!++;
    expect(counts[0]).toBe(0);
    for (const n of [1, 2, 3]) expect(counts[n]! / 90_000).toBeCloseTo(1 / 3, 1);
    expect(chickCount(0.999999)).toBe(3);
    expect(giftRequired(1)).toBe(false);
    expect(giftRequired(2)).toBe(true);
    expect(giftRequired(3)).toBe(true);
  });
});

describe('protection period (SPEC 9.8)', () => {
  it('rolls from the 28th day after the start of ownership on', () => {
    expect(pastGracePeriod('2026-11-01', '2026-11-28')).toBe(false);
    expect(pastGracePeriod('2026-11-01', '2026-11-29')).toBe(true);
    expect(pastGracePeriod('2026-11-01', '2027-01-01')).toBe(true);
  });
});

describe('menagerie (SPEC 9.6, 9.7)', () => {
  it('offers three different species', () => {
    for (let seed = 1; seed < 200; seed++) {
      const offer = pickOffer(seeded(seed));
      expect(offer).toHaveLength(3);
      expect(new Set(offer).size).toBe(3);
      for (const id of offer) expect(SPECIES.some((species) => species.id === id)).toBe(true);
    }
    expect(pickOffer(() => 0.9999999)).toHaveLength(3);
  });

  it('derives name and sex of loan owls from HMAC bytes', () => {
    const a = loanIdentity(new Uint8Array([1, 2, 3, 4]));
    expect(loanIdentity(new Uint8Array([1, 2, 3, 4]))).toEqual(a);
    expect(OWL_NAMES).toContain(a.name);
    expect(a.sex).toBe('f');
    expect(loanIdentity(new Uint8Array([1, 2, 3, 5])).sex).toBe('m');
    expect(OWL_NAMES).toContain(loanIdentity(new Uint8Array([])).name);
    expect(randomOwlName(0)).toBe(OWL_NAMES[0]);
    expect(randomOwlName(0.9999999)).toBe(OWL_NAMES.at(-1));
  });

  it('pays 10 % of the species price', () => {
    expect(papeterieWage(6)).toBe(6);
    expect(papeterieWage(49)).toBe(49);
    expect(speciesPrice('waldkauz')).toBe(6);
    expect(speciesPrice('nope')).toBe(0);
  });
});
