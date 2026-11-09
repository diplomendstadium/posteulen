import { locale } from '../../../admin/src/lib/i18n.svelte.ts';

export function dateTime(ms: number): string {
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(ms),
  );
}

export function utcTime(ms: number): string {
  return new Intl.DateTimeFormat(locale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(ms));
}

/** "2026-11-09T14:30" in the local time of this device (for datetime-local inputs). */
export function toLocalInput(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string): number {
  return new Date(value).getTime();
}

/** Tenths of gold as "2,5" or "2.5". */
export function gold(tenths: number): string {
  return (tenths / 10).toLocaleString(locale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
