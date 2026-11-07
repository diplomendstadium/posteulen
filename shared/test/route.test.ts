import { describe, expect, it } from 'vitest';
import { routeLengthKm, shortestOrder } from '../src/game/route.ts';

const PARIS = { lat: 48.86, lon: 2.35 };
const BRUSSELS = { lat: 50.85, lon: 4.35 };
const HAMBURG = { lat: 53.55, lon: 9.99 };
const BERLIN = { lat: 52.52, lon: 13.4 };
const MUNICH = { lat: 48.14, lon: 11.58 };

describe('kürzeste Route für mehrere Empfänger (v0.3.2)', () => {
  it('findet die kürzeste Rundreise ab Zuhause', () => {
    // Given in a zig-zag order; the shortest round trip from Paris goes north-east and back south.
    const stops = [MUNICH, BRUSSELS, BERLIN, HAMBURG];
    const order = shortestOrder(PARIS, stops);
    const best = routeLengthKm(
      PARIS,
      order.map((i) => stops[i]!),
    );
    expect(best).toBeLessThan(routeLengthKm(PARIS, stops));
    expect(order.map((i) => stops[i])).toEqual([BRUSSELS, HAMBURG, BERLIN, MUNICH]);
  });

  it('lässt eine schon beste Reihenfolge und einzelne Empfänger unverändert', () => {
    expect(shortestOrder(PARIS, [BERLIN])).toEqual([0]);
    expect(shortestOrder(PARIS, [])).toEqual([]);
    const best = shortestOrder(PARIS, [BRUSSELS, HAMBURG, BERLIN, MUNICH]);
    expect(best).toEqual([0, 1, 2, 3]);
  });
});
