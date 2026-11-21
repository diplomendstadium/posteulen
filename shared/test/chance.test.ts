import { describe, expect, it } from 'vitest';
import {
  chickCount,
  giftRequired,
  laysEggs,
  loanIdentities,
  loanIdentity,
  menagerieWage,
  pastGracePeriod,
  loanNamesOn,
  pickTeam,
  teamSpecies,
  randomOwlName,
  rollsSick,
  sicknessProbability,
  speciesPrice,
} from '../src/game/chance.ts';
import { OWL_NAMES_F, OWL_NAMES_M } from '../src/names-data.ts';
import { LOAN_TEAMS, SPECIES } from '../src/species.ts';

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
  it('offers one whole team, never the phoenix (v1.1)', () => {
    for (let seed = 1; seed < 200; seed++) {
      const offer = teamSpecies(pickTeam(seeded(seed)));
      expect(offer).toHaveLength(5);
      expect(new Set(offer).size).toBe(5);
      expect(offer).not.toContain('phoenix');
      for (const id of offer) expect(SPECIES.some((species) => species.id === id)).toBe(true);
    }
    expect(pickTeam(() => 0.9999999)).toBe('D');
    expect(pickTeam(() => 0)).toBe('A');
  });

  it('has four teams with every species but the phoenix exactly once (v1.1)', () => {
    const all = Object.values(LOAN_TEAMS).flat();
    expect(Object.keys(LOAN_TEAMS)).toEqual(['A', 'B', 'C', 'D']);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(
      SPECIES.filter((species) => !species.mythical)
        .map((species) => species.id)
        .sort(),
    );
  });

  it('derives name and sex of loan owls from HMAC bytes', () => {
    const a = loanIdentity(new Uint8Array([1, 2, 3, 4]));
    expect(loanIdentity(new Uint8Array([1, 2, 3, 4]))).toEqual(a);
    // The name suits the sex (Anhang D).
    expect(a.sex).toBe('f');
    expect(OWL_NAMES_F).toContain(a.name);
    const male = loanIdentity(new Uint8Array([1, 2, 3, 5]));
    expect(male.sex).toBe('m');
    expect(OWL_NAMES_M).toContain(male.name);
    expect(OWL_NAMES_F).toContain(loanIdentity(new Uint8Array([])).name);
    expect(randomOwlName(0)).toBe(OWL_NAMES_F[0]);
    expect(randomOwlName(0.9999999, OWL_NAMES_M)).toBe(OWL_NAMES_M.at(-1));
  });

  it('pays 10 % of the species price', () => {
    expect(menagerieWage(6)).toBe(6);
    expect(menagerieWage(49)).toBe(49);
    expect(speciesPrice('waldkauz')).toBe(6);
    expect(speciesPrice('nope')).toBe(0);
  });
});

describe('loan identities of a day (v0.2)', () => {
  it('three different names, even if every derivation gives the same bytes', () => {
    const same = loanIdentities(['a', 'b', 'c'], () => new Uint8Array([1, 2, 3, 4, 5, 6]));
    expect(new Set(same.map((identity) => identity.name)).size).toBe(3);
    expect(
      same.every((identity) =>
        (identity.sex === 'f' ? OWL_NAMES_F : OWL_NAMES_M).includes(identity.name),
      ),
    ).toBe(true);
  });

  it('keeps the first derivation and uses further attempts only on a clash', () => {
    const bytes = (species: string, attempt: number) =>
      new Uint8Array([species === 'b' && attempt === 0 ? 1 : attempt, 0, species.charCodeAt(0)]);
    const result = loanIdentities(['a', 'b'], bytes);
    expect(result[0]).toEqual(loanIdentity(bytes('a', 0)));
    expect(result[1]?.name).not.toBe(result[0]?.name);
  });

  it('energy share in [0, 1)', () => {
    expect(loanIdentity(new Uint8Array([0, 0, 0, 0, 255, 255])).energyShare).toBeLessThan(1);
    expect(loanIdentity(new Uint8Array([])).energyShare).toBe(0);
  });
});

describe('locks for loan owls (v0.7, SPEC 9.6)', () => {
  it('never offers the team of the day before (v1.1)', () => {
    for (const previous of ['A', 'B', 'C', 'D'] as const) {
      const seen = new Set<string>();
      const random = seeded(11);
      for (let draw = 0; draw < 60; draw++) seen.add(pickTeam(random, previous));
      expect(seen.has(previous)).toBe(false);
      expect(seen.size).toBe(3);
    }
  });

  it('rotates the names in three groups by day', () => {
    const days = ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
    const groups = days.map((day) => loanNamesOn(day));
    // Each list of Anhang D has about 108 names: about 36 per group.
    expect(groups[0]!.length).toBeGreaterThan(30);
    for (const name of groups[0]!) {
      expect(groups[1]).not.toContain(name);
      expect(groups[2]).not.toContain(name);
    }
    expect(groups[3]).toEqual(groups[0]);
    expect(loanNamesOn('1969-12-31', ['a', 'b', 'c'])).toHaveLength(1);
  });
});
