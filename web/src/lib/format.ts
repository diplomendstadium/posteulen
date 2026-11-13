import { fill, locale, t } from './i18n.svelte.ts';
import { account } from './auth.svelte.ts';
import { zoneAt } from '@posteulen/shared/map/timezone.ts';

/**
 * v0.7.1: times are shown in the local time of the player's (fictional) home – the time zone of
 * the country there, with summer time (as the greeting, SPEC 8.3). Signed out (no home known)
 * the device's time zone is used.
 */
function homeZone(): string | undefined {
  const home = account.profile?.home;
  return home ? zoneAt(home.lat, home.lon) : undefined;
}

function format(options: Intl.DateTimeFormatOptions, ms: number): string {
  const timeZone = homeZone();
  try {
    return new Intl.DateTimeFormat(locale(), {
      ...options,
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(ms));
  } catch {
    // An unknown zone in an old browser: the device's time instead of nothing.
    return new Intl.DateTimeFormat(locale(), options).format(new Date(ms));
  }
}

/** Time of day, in the notation of the language. */
export function time(ms: number): string {
  return format({ hour: '2-digit', minute: '2-digit' }, ms);
}

/**
 * Only the time for today (at home), otherwise date and time. v0.8.5: `full` always shows the
 * whole date with the year (e.g. "13.11.2026, 14:00").
 */
export function dateTime(ms: number, full = false): string {
  if (full)
    return format(
      { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
      ms,
    );
  const day = (value: number): string => format({ dateStyle: 'short' }, value);
  const sameDay = day(ms) === day(Date.now());
  return format(
    sameDay ? { hour: '2-digit', minute: '2-digit' } : { dateStyle: 'medium', timeStyle: 'short' },
    ms,
  );
}

/**
 * v0.7.2: a remaining time – under an hour in minutes (at least 1), otherwise in hours
 * (rounded up). v0.8.5: units written out ("21 Minuten"), so a sentence ending in "." never
 * gets a double full stop.
 */
export function duration(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60)
    return minutes === 1 ? t.duration.minute : fill(t.duration.minutes, { n: minutes });
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? t.duration.hour : fill(t.duration.hours, { n: hours });
}

export { linkify, type TextPart } from '@posteulen/shared/links.ts';
