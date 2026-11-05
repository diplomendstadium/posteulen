/**
 * Day and night (SPEC 9.4.1, 12.1): "day" means the sun is higher than −6° at the place and
 * time in question (twilight counts as day). Sun positions come from SunCalc.
 */
import { getPosition } from 'suncalc';
import { FLIGHT } from '../constants.ts';

export function sunAltitude(at: number, lat: number, lon: number): number {
  return getPosition(new Date(at), lat, lon).altitude;
}

export function isDay(at: number, lat: number, lon: number): boolean {
  return sunAltitude(at, lat, lon) > FLIGHT.DAY_SUN_ALTITUDE_DEG;
}
