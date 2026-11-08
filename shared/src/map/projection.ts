/**
 * Map projection (SPEC 12): v0.7 the whole world in the Equal Earth projection (Šavrič, Patterson,
 * Jenny 2018; equal-area), centred on 10° E so that Western Europe sits in the middle and is
 * barely sheared. Until v0.6 the map used a Lambert azimuthal equal-area projection centred on
 * Europe, which cannot show the whole world. Used for the map display only; all game logic uses
 * lat/lon. Units: kilometres. y grows northwards (SVG callers flip it).
 */
import { FLIGHT } from '../constants.ts';

const R = FLIGHT.EARTH_RADIUS_KM;
/** Central meridian of the map (degrees east). */
export const CENTRAL_MERIDIAN = 10;
const DEG = Math.PI / 180;

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Longitude relative to the central meridian, in (−180°, 180°]. */
export function relativeLongitude(lon: number): number {
  let delta = (((lon - CENTRAL_MERIDIAN) % 360) + 360) % 360;
  if (delta > 180) delta -= 360;
  return delta;
}

/**
 * Projects a latitude and a longitude *relative to the central meridian* (−180°…180°). The map
 * tool uses it directly for points on the edge of the world (±180° must not flip sides).
 */
export function projectRelative(lat: number, delta: number): Point {
  const theta = Math.asin(M * Math.sin(lat * DEG));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  return {
    x:
      (R * 2 * Math.sqrt(3) * delta * DEG * Math.cos(theta)) /
      (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1)),
    y: R * theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)),
  };
}

export function project(lat: number, lon: number): Point {
  return projectRelative(lat, relativeLongitude(lon));
}

/** Inverse of `project` (Newton iteration for the parametric latitude). */
export function unproject(x: number, y: number): { lat: number; lon: number } {
  const yr = Math.max(-1.3173627, Math.min(1.3173627, y / R));
  let theta = yr;
  for (let i = 0; i < 12; i++) {
    const t2 = theta * theta;
    const t6 = t2 * t2 * t2;
    const f = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - yr;
    const df = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2);
    const step = f / df;
    theta -= step;
    if (Math.abs(step) < 1e-12) break;
  }
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  const derivative = 9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1;
  // x = R · 2√3 · λ · cos θ / (3 · derivative)  ⇒  λ = 3 · x · derivative / (R · 2√3 · cos θ)
  const lambda = (3 * x * derivative) / (R * 2 * Math.sqrt(3) * Math.cos(theta));
  const lat = Math.asin(Math.max(-1, Math.min(1, Math.sin(theta) / M))) / DEG;
  let lon = lambda / DEG + CENTRAL_MERIDIAN;
  if (lon > 180) lon -= 360;
  if (lon <= -180) lon += 360;
  return { lat, lon };
}
