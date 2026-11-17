/**
 * v1.1: the Christmas season (SPEC 9.11) – from the start of the first Sunday of Advent until
 * the end of 26 December, by the local time at a (fictional) home. The time zone comes from the
 * same grid as the greeting (8.3); the rules including summer time from Intl.
 */
import { CHRISTMAS } from '../constants.ts';
import { zoneAt } from '../map/timezone.ts';

export interface LocalDate {
  readonly year: number;
  /** 1–12 */
  readonly month: number;
  readonly day: number;
}

/** Calendar date at `at` in a time zone; the device's date if Intl fails. */
export function localDate(at: number, zone: string): LocalDate {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(at));
    const value = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
    const date = { year: value('year'), month: value('month'), day: value('day') };
    if (Object.values(date).every(Number.isFinite)) return date;
  } catch {
    // An unknown zone: fall through to the device's date.
  }
  const date = new Date(at);
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/**
 * First Sunday of Advent: the fourth Sunday before Christmas Day, between 27 November and
 * 3 December. Returned as month and day.
 */
export function firstAdvent(year: number): { month: number; day: number } {
  const christmasEve = new Date(Date.UTC(year, 11, 24)).getUTCDay();
  // The last Sunday on or before 24 December, three weeks earlier.
  const day = 24 - christmasEve - 21;
  return day >= 1 ? { month: 12, day } : { month: 11, day: 30 + day };
}

/** Whether a calendar date lies in the Christmas season (first Advent to 26 December). */
export function isChristmasDate(date: LocalDate): boolean {
  const advent = firstAdvent(date.year);
  const value = date.month * 100 + date.day;
  return (
    value >= advent.month * 100 + advent.day &&
    value <= CHRISTMAS.LAST_MONTH * 100 + CHRISTMAS.LAST_DAY
  );
}

/** Whether it is Christmas season at this place and time (local time there). */
export function isChristmas(at: number, lat: number, lon: number): boolean {
  return isChristmasDate(localDate(at, zoneAt(lat, lon)));
}

/**
 * The Christmas parchment pair (1–4) of a conversation, from HMAC bytes over both IDs in a
 * fixed order: the same for both sides, never stored (SPEC 8.4).
 */
export function christmasPaper(hmac: Uint8Array): number {
  return ((hmac[0] ?? 0) % CHRISTMAS.PAPERS) + 1;
}
