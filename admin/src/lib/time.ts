/** v0.8.3: the time zone of this device – all times of the admin panel and the control centre. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** v1.4.3: a duration such as the uptime, in days and hours (or hours and minutes, or minutes). */
export function formatDuration(
  ms: number,
  words: {
    day: string;
    days: string;
    hour: string;
    hours: string;
    minute: string;
    minutes: string;
  },
): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(total / (24 * 60));
  const hours = Math.floor((total % (24 * 60)) / 60);
  const minutes = total % 60;
  const part = (n: number, one: string, many: string): string =>
    (n === 1 ? one : many).replace('{n}', String(n));
  if (days > 0)
    return hours > 0
      ? `${part(days, words.day, words.days)}, ${part(hours, words.hour, words.hours)}`
      : part(days, words.day, words.days);
  if (hours > 0)
    return minutes > 0
      ? `${part(hours, words.hour, words.hours)}, ${part(minutes, words.minute, words.minutes)}`
      : part(hours, words.hour, words.hours);
  return part(minutes, words.minute, words.minutes);
}
