/**
 * v0.7: local time at a (fictional) home in the European map section – for the greeting on the
 * overview (SPEC 8.3). Each country of the section has one time zone (generated grid,
 * `timezones-data.ts`); the browser's Intl knows the rules including summer time.
 */
import { MAP } from '../constants.ts';
import {
  TZ_ALPHABET,
  TZ_HEIGHT,
  TZ_RESOLUTION_DEG,
  TZ_WIDTH,
  ZONE_ROWS,
  ZONES,
} from './timezones-data.ts';

/** Used where the grid has no zone (outside the section, open sea). */
export const FALLBACK_ZONE = 'Europe/Berlin';

/** The IANA time zone at a point of the section. */
export function zoneAt(lat: number, lon: number): string {
  const row = Math.floor((MAP.NORTH_LAT - lat) / TZ_RESOLUTION_DEG);
  const col = Math.floor((lon - MAP.WEST_LON) / TZ_RESOLUTION_DEG);
  if (row < 0 || row >= TZ_HEIGHT || col < 0 || col >= TZ_WIDTH) return FALLBACK_ZONE;
  const runs = ZONE_ROWS[row] ?? '';
  let position = 0;
  for (const match of runs.matchAll(/([-A-Za-z])(\d+)/g)) {
    position += Number(match[2]);
    if (col < position) {
      const index = TZ_ALPHABET.indexOf(match[1] ?? '-');
      return index >= 0 ? (ZONES[index] ?? FALLBACK_ZONE) : FALLBACK_ZONE;
    }
  }
  return FALLBACK_ZONE;
}

/** Hour (0–23) and minute at `at` in a time zone; the device's own time if Intl fails. */
export function localTime(at: number, zone: string): { hour: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(at));
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    if (Number.isFinite(hour) && Number.isFinite(minute)) return { hour, minute };
  } catch {
    // An unknown zone: fall through to the device's time.
  }
  const date = new Date(at);
  return { hour: date.getHours(), minute: date.getMinutes() };
}

export type DayPart = 'morning' | 'day' | 'evening' | 'night';

/** Morning 5–11, day 11–18, evening 18–22, night 22–5 (local hours). */
export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 18) return 'day';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}
