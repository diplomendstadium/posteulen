/**
 * Links in letter texts (SPEC 6): only http(s) is clickable, the full address is shown, and
 * rendering is always as text. v0.6.1: addresses that could deceive are shown with their host
 * in ASCII (punycode) and marked, so that the browser shows a warning next to them.
 */
export interface TextPart {
  readonly text: string;
  readonly href?: string;
  /**
   * v0.6.1: the written address could imitate another one (characters outside ASCII in the
   * host, e.g. a Cyrillic "а", or user info such as "https://bank.example@other.example").
   * The link then shows the technical form of the real address, with a warning next to it.
   */
  readonly suspicious?: boolean;
}

/** The written authority (user info, host, port) between "//" and the next "/", "?" or "#". */
function writtenAuthority(url: string): { authority: string; rest: string } {
  const start = url.indexOf('//') + 2;
  const end = url.slice(start).search(/[/?#]/);
  const stop = end === -1 ? url.length : start + end;
  return { authority: url.slice(start, stop), rest: url.slice(stop) };
}

/**
 * Splits text into plain parts and http(s) links (SPEC 6: only http/https are clickable, the
 * full URL is shown). Rendering is always as text, never as HTML. Addresses that could deceive
 * are shown with their host in ASCII (punycode) and marked (v0.6.1).
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
    let parsed: URL | null;
    try {
      parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') parsed = null;
    } catch {
      parsed = null;
    }
    if (!parsed) {
      parts.push({ text: url });
    } else {
      const { authority, rest } = writtenAuthority(url);
      const unusual =
        /[^\x21-\x7e]/.test(authority) || parsed.username !== '' || parsed.password !== '';
      parts.push(
        unusual
          ? {
              text: `${parsed.protocol}//${parsed.host}${rest}`,
              href: parsed.href,
              suspicious: true,
            }
          : { text: url, href: url },
      );
    }
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
