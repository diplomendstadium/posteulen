/**
 * Shortest order for several recipients (v0.3.2): every order is tried (at most 5! = 120) and
 * the one with the shortest total distance wins – from home over all recipients and back home
 * again, along great circles. Of two equally long orders (a round trip in both directions) the
 * one starting with the nearer recipient wins. Only a suggestion: the user can still
 * change the order before sending (SPEC 8.4).
 */
import { distanceKm, type Point } from './geo.ts';

function permutations(items: readonly number[]): number[][] {
  if (items.length <= 1) return [[...items]];
  const result: number[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const tail of permutations(rest)) result.push([item, ...tail]);
  });
  return result;
}

export function routeLengthKm(home: Point, stops: readonly Point[]): number {
  let total = 0;
  let at = home;
  for (const stop of stops) {
    total += distanceKm(at, stop);
    at = stop;
  }
  return total + distanceKm(at, home);
}

/** Indices of `stops` in the order of the shortest round trip from `home`. */
export function shortestOrder(home: Point, stops: readonly Point[]): number[] {
  if (stops.length < 2) return stops.map((_, index) => index);
  let best = stops.map((_, index) => index);
  let bestKm = routeLengthKm(home, stops);
  for (const order of permutations(best)) {
    const km = routeLengthKm(
      home,
      order.map((index) => stops[index] as Point),
    );
    // A round trip is as long in both directions: then the nearer first recipient wins.
    const tie =
      Math.abs(km - bestKm) < 1e-6 &&
      distanceKm(home, stops[order[0] as number] as Point) <
        distanceKm(home, stops[best[0] as number] as Point) - 1e-9;
    if (km < bestKm - 1e-6 || tie) {
      best = order;
      bestKm = km;
    }
  }
  return best;
}
