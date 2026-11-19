/**
 * Version 1.2.3: the small Markdown subset of the info text on the start page and the text
 * itself in both languages.
 */
import { describe, expect, it } from 'vitest';
import { parseInlines, parseMarkdown } from '../src/markdown.ts';
import { ABOUT_DE, ABOUT_EN } from '../src/texts/about.ts';

describe('Markdown subset (SPEC 8.1)', () => {
  it('reads headings, pictures and paragraphs', () => {
    expect(
      parseMarkdown('# Titel\n\n![desk](right)\n\nZeile eins\nZeile zwei\n\n\n![group](left)'),
    ).toEqual([
      { kind: 'heading', text: 'Titel' },
      { kind: 'picture', picture: 'desk', align: 'right' },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'Zeile eins Zeile zwei' }] },
      { kind: 'picture', picture: 'group', align: 'left' },
    ]);
  });

  it('knows bold, italic and links to pages of the app only', () => {
    expect(parseInlines('**Fett:** und *kursiv* – die [Hilfe](/hilfe).')).toEqual([
      { kind: 'strong', text: 'Fett:' },
      { kind: 'text', text: ' und ' },
      { kind: 'em', text: 'kursiv' },
      { kind: 'text', text: ' – die ' },
      { kind: 'link', text: 'Hilfe', href: '/hilfe' },
      { kind: 'text', text: '.' },
    ]);
    // Other addresses stay text – no way out of the app, no scripts.
    for (const href of ['https://example.org', '//example.org', 'javascript:alert(1)']) {
      expect(parseInlines(`[x](${href})`)).toEqual([{ kind: 'text', text: `[x](${href})` }]);
    }
    // A picture inside a paragraph is no picture.
    expect(parseMarkdown('Text ![desk](right)')[0]?.kind).toBe('paragraph');
  });
});

describe('info text on the start page (SPEC 8.1)', () => {
  const outline = (text: string) =>
    parseMarkdown(text).map((block) =>
      block.kind === 'paragraph'
        ? 'p'
        : block.kind === 'picture'
          ? `${block.picture}:${block.align}`
          : 'h',
    );

  it('has the same structure in German and English, with five pictures (v1.2.4: six parts)', () => {
    expect(outline(ABOUT_EN)).toEqual(outline(ABOUT_DE));
    expect(outline(ABOUT_DE).filter((part) => part.includes(':'))).toEqual([
      'desk:right',
      'homecoming:left',
      'menagerie:right',
      'post:left',
      'feeding:right',
    ]);
    expect(outline(ABOUT_DE).filter((part) => part === 'h')).toHaveLength(6);
  });

  it('names the address of the instance instead of a fixed one, no in-app purchases', () => {
    for (const text of [ABOUT_DE, ABOUT_EN]) {
      expect(text).not.toContain('posteulen.de');
      expect(text.match(/\{host\}/g)).toHaveLength(2);
      // No leftover picture instructions from the delivered text.
      expect(text).not.toMatch(/\.png/);
    }
    expect(ABOUT_DE).toContain('keine In-App-Käufe');
    expect(ABOUT_EN).toContain('no in-app purchases');
    expect(ABOUT_DE).toContain('Es gibt keine Werbung');
  });
});
