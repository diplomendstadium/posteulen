/**
 * v1.2.4: a place for the device's time zone (SPEC 9.11) – without an account the start page
 * shows day and night by the sun at the main city of the device's time zone instead of a fixed
 * place. Zones without a place (`UTC`, `Etc/GMT+1` …) use a point at 50° north whose longitude
 * follows the device's offset from UTC (15° per hour).
 */
import { ZONE_PLACES } from './zone-places-data.ts';

export interface Place {
  readonly lat: number;
  readonly lon: number;
}

let parsed: ReadonlyMap<string, Place> | undefined;

function places(): ReadonlyMap<string, Place> {
  parsed ??= new Map(
    ZONE_PLACES.split(';').map((entry) => {
      const [zone = '', coords = ''] = entry.split(':');
      const [lat = 0, lon = 0] = coords.split(',').map(Number);
      return [zone, { lat, lon }] as const;
    }),
  );
  return parsed;
}

/** The main city of an IANA time zone, or null for an unknown zone. */
export function zonePlace(zone: string): Place | null {
  return places().get(zone) ?? null;
}

/**
 * Where the device probably is: the place of its time zone, otherwise 50° north at the
 * longitude of its offset. `offsetMinutes` as `Date.prototype.getTimezoneOffset` (UTC − local).
 */
export function devicePlace(zone: string | undefined, offsetMinutes: number): Place {
  const place = zone ? zonePlace(zone) : null;
  if (place) return place;
  const lon = Math.max(-180, Math.min(180, -offsetMinutes / 4));
  return { lat: 50, lon };
}
