/**
 * Lambert azimuthal equal-area projection centred on Europe (as ETRS89-LAEA / EPSG:3035,
 * spherical approximation). Used for the map display only; all game logic uses lat/lon.
 * Units: kilometres. y grows northwards (SVG callers flip it).
 */
import { FLIGHT } from '../constants.ts';

const R = FLIGHT.EARTH_RADIUS_KM;
const PHI0 = (52 * Math.PI) / 180;
const LAMBDA0 = (10 * Math.PI) / 180;
const DEG = Math.PI / 180;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function project(lat: number, lon: number): Point {
  const phi = lat * DEG;
  const dl = lon * DEG - LAMBDA0;
  const k = Math.sqrt(
    2 / (1 + Math.sin(PHI0) * Math.sin(phi) + Math.cos(PHI0) * Math.cos(phi) * Math.cos(dl)),
  );
  return {
    x: R * k * Math.cos(phi) * Math.sin(dl),
    y: R * k * (Math.cos(PHI0) * Math.sin(phi) - Math.sin(PHI0) * Math.cos(phi) * Math.cos(dl)),
  };
}

export function unproject(x: number, y: number): { lat: number; lon: number } {
  const rho = Math.hypot(x, y);
  if (rho < 1e-9) return { lat: PHI0 / DEG, lon: LAMBDA0 / DEG };
  const c = 2 * Math.asin(Math.min(1, rho / (2 * R)));
  const phi = Math.asin(Math.cos(c) * Math.sin(PHI0) + (y * Math.sin(c) * Math.cos(PHI0)) / rho);
  const lambda =
    LAMBDA0 +
    Math.atan2(
      x * Math.sin(c),
      rho * Math.cos(PHI0) * Math.cos(c) - y * Math.sin(PHI0) * Math.sin(c),
    );
  return { lat: phi / DEG, lon: lambda / DEG };
}
