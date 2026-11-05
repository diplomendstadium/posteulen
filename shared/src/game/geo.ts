/** Great-circle geometry on a sphere with radius 6 371 km (SPEC 9.4.1). Angles in degrees. */
import { FLIGHT } from '../constants.ts';

export interface Point {
  readonly lat: number;
  readonly lon: number;
}

const RAD = Math.PI / 180;

/** Haversine distance in km. */
export function distanceKm(a: Point, b: Point): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * FLIGHT.EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point at `fraction` (0…1) of the great-circle arc from a to b (spherical interpolation). */
export function interpolate(a: Point, b: Point, fraction: number): Point {
  if (fraction <= 0) return a;
  if (fraction >= 1) return b;
  const delta = distanceKm(a, b) / FLIGHT.EARTH_RADIUS_KM;
  if (delta < 1e-12) return a;
  const sinDelta = Math.sin(delta);
  const wa = Math.sin((1 - fraction) * delta) / sinDelta;
  const wb = Math.sin(fraction * delta) / sinDelta;
  const [lat1, lon1, lat2, lon2] = [a.lat * RAD, a.lon * RAD, b.lat * RAD, b.lon * RAD];
  const x = wa * Math.cos(lat1) * Math.cos(lon1) + wb * Math.cos(lat2) * Math.cos(lon2);
  const y = wa * Math.cos(lat1) * Math.sin(lon1) + wb * Math.cos(lat2) * Math.sin(lon2);
  const z = wa * Math.sin(lat1) + wb * Math.sin(lat2);
  return {
    lat: Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD,
    lon: Math.atan2(y, x) / RAD,
  };
}

/** Rounds coordinates for storage (1e-4° ≈ 11 m). */
export function roundPoint(p: Point): Point {
  return { lat: Math.round(p.lat * 1e4) / 1e4, lon: Math.round(p.lon * 1e4) / 1e4 };
}
