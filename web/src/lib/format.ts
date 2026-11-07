import { locale } from './i18n.svelte.ts';

/** Time display in the local time of the device (SPEC 0), in the notation of the language. */
export function time(ms: number): string {
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(
    new Date(ms),
  );
}

export function dateTime(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat(
    locale(),
    sameDay ? { hour: '2-digit', minute: '2-digit' } : { dateStyle: 'medium', timeStyle: 'short' },
  ).format(date);
}

export { linkify, type TextPart } from '@posteulen/shared/links.ts';
