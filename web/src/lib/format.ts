/** Time display in the local time of the device (SPEC 0). */
export function time(ms: number): string {
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(ms),
  );
}

export function dateTime(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat(
    'de-DE',
    sameDay ? { hour: '2-digit', minute: '2-digit' } : { dateStyle: 'medium', timeStyle: 'short' },
  ).format(date);
}

export interface TextPart {
  readonly text: string;
  readonly href?: string;
}

/**
 * Splits text into plain parts and http(s) links (SPEC 6: only http/https are clickable, the
 * full URL is shown). Rendering is always as text, never as HTML.
 */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const pattern = /\bhttps?:\/\/[^\s<>"]+/gi;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    let url = match[0];
    // Trailing punctuation usually ends the sentence, not the URL.
    while (/[.,;:!?)\]]$/.test(url)) url = url.slice(0, -1);
    const start = match.index;
    if (start > last) parts.push({ text: text.slice(last, start) });
    let valid: boolean;
    try {
      const parsed = new URL(url);
      valid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      valid = false;
    }
    parts.push(valid ? { text: url, href: url } : { text: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
