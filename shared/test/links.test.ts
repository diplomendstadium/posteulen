import { describe, expect, it } from 'vitest';
import { linkify } from '../src/links.ts';

describe('links in letters (SPEC 6)', () => {
  it('makes only http(s) clickable and shows ordinary links as written', () => {
    expect(linkify('Siehe https://example.org/a?b=1#c. Danke!')).toEqual([
      { text: 'Siehe ' },
      { text: 'https://example.org/a?b=1#c', href: 'https://example.org/a?b=1#c' },
      { text: '. Danke!' },
    ]);
    expect(linkify('javascript:alert(1) ftp://x.example')).toEqual([
      { text: 'javascript:alert(1) ftp://x.example' },
    ]);
    expect(linkify('(http://example.org/x)')).toEqual([
      { text: '(' },
      { text: 'http://example.org/x', href: 'http://example.org/x' },
      { text: ')' },
    ]);
    // Non-ASCII in the path is fine: only the host decides where a link leads.
    expect(linkify('https://de.wikipedia.org/wiki/Straße')).toEqual([
      {
        text: 'https://de.wikipedia.org/wiki/Straße',
        href: 'https://de.wikipedia.org/wiki/Straße',
      },
    ]);
  });

  it('shows look-alike hosts in punycode and marks them (v0.6.1)', () => {
    // Cyrillic "\u0430" (U+0430) instead of the Latin "a".
    const [part] = linkify('https://p\u0430ypal.com/login');
    expect(part?.suspicious).toBe(true);
    expect(part?.text).toBe('https://xn--pypal-4ve.com/login');
    expect(part?.href).toBe('https://xn--pypal-4ve.com/login');
    // A full-width dot is a dot for the browser: the real host is shown.
    expect(linkify('https://example\u3002org')[0]).toMatchObject({
      text: 'https://example.org',
      suspicious: true,
    });
    // Legitimate international domains are marked as well (by design).
    expect(linkify('https://müller.de')[0]).toMatchObject({
      text: 'https://xn--mller-kva.de',
      suspicious: true,
    });
    // Already in punycode: shown as written, nothing hidden.
    expect(linkify('https://xn--pypal-4ve.com')[0]).toEqual({
      text: 'https://xn--pypal-4ve.com',
      href: 'https://xn--pypal-4ve.com',
    });
  });

  it('shows the real host of addresses with user info (v0.6.1)', () => {
    expect(linkify('https://bank.example@evil.example/x')[0]).toEqual({
      text: 'https://evil.example/x',
      href: 'https://bank.example@evil.example/x',
      suspicious: true,
    });
    expect(linkify('http://a:b@host.example:8080')[0]).toMatchObject({
      text: 'http://host.example:8080',
      suspicious: true,
    });
  });

  it('leaves unparsable addresses as plain text', () => {
    expect(linkify('https://[::1')).toEqual([{ text: 'https://[::1' }]);
  });
});
