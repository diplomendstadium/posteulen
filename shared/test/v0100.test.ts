/**
 * Version 0.10.0: carrying capacity per species, loan price by capacity, feeding while not full.
 */
import { describe, expect, it } from 'vitest';
import { GOLD } from '../src/constants.ts';
import {
  canCarry,
  canFeedAgain,
  cargoCovers,
  cargoNeeded,
  cargoOf,
  loanPrice,
} from '../src/game/owls.ts';

describe('carrying capacity (v0.10, SPEC 9.2.1)', () => {
  it('needs gold > long parchment > short parchment', () => {
    expect(cargoNeeded({ parchment: 'small' })).toBe('short');
    expect(cargoNeeded({ parchment: 'large' })).toBe('long');
    expect(cargoNeeded({ parchment: 'small', gold: true })).toBe('gold');
    expect(cargoNeeded({ parchment: 'large', gold: true })).toBe('gold');
    expect(cargoCovers('gold', 'short')).toBe(true);
    expect(cargoCovers('long', 'gold')).toBe(false);
    expect(cargoCovers('short', 'long')).toBe(false);
  });

  it('matches the species list', () => {
    expect(canCarry('elfenkauz', { parchment: 'small' })).toBe(true);
    expect(canCarry('elfenkauz', { parchment: 'large' })).toBe(false);
    expect(canCarry('waldkauz', { parchment: 'large' })).toBe(true);
    expect(canCarry('waldkauz', { parchment: 'small', gold: true })).toBe(false);
    expect(canCarry('virginiauhu', { parchment: 'small', gold: true })).toBe(true);
    // An unknown species carries as little as possible.
    expect(cargoOf('dodo')).toBe('short');
  });

  it('loan owls that carry gold cost 0.2 gold, the others 0.1', () => {
    expect(loanPrice('bartkauz')).toBe(GOLD.LOAN_PRICE_GOLD);
    expect(loanPrice('schleiereule')).toBe(GOLD.LOAN_PRICE);
    expect(loanPrice('kanincheneule')).toBe(GOLD.LOAN_PRICE);
    expect([GOLD.LOAN_PRICE, GOLD.LOAN_PRICE_GOLD]).toEqual([1, 2]);
  });
});

describe('feeding (v0.10, SPEC 9.3)', () => {
  it('once a day in any case, more often only while the energy is not full', () => {
    expect(canFeedAgain({ fedToday: false, energy: 540, maxEnergy: 540 })).toBe(true);
    expect(canFeedAgain({ fedToday: true, energy: 539, maxEnergy: 540 })).toBe(true);
    expect(canFeedAgain({ fedToday: true, energy: 540, maxEnergy: 540 })).toBe(false);
  });
});

describe('the Virginiauhu (v0.10)', () => {
  it('can be offered as a loan owl like every species but the phoenix', async () => {
    const { pickOffer } = await import('../src/game/chance.ts');
    // Always the last species of the pool: the Virginiauhu stands near the end of the list.
    expect(pickOffer(() => 0.999)).toContain('virginiauhu');
    expect(pickOffer(() => 0.999)).not.toContain('phoenix');
  });
});
