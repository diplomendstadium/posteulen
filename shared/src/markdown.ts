/**
 * A small, safe Markdown subset for fixed texts of the app (the info text on the start page,
 * SPEC 8.1). The result is plain data that the web app renders as elements – never as HTML.
 *
 * Blocks are separated by blank lines: `# Heading`, `![picture](left|right)` on a line of its
 * own, everything else is a paragraph (its line breaks become spaces). Inside a paragraph:
 * `**bold**`, `*italic*` and `[text](/path)` – links only to pages of the app (a path starting
 * with a single "/") and `[text](donate)`, the donation page of the project (`DONATION.URL`,
 * v1.2.4); anything else stays text.
 */

export type MarkdownInline =
  | { readonly kind: 'text' | 'strong' | 'em'; readonly text: string }
  | { readonly kind: 'link'; readonly text: string; readonly href: string };

export type MarkdownBlock =
  | { readonly kind: 'heading'; readonly text: string }
  | { readonly kind: 'paragraph'; readonly inlines: readonly MarkdownInline[] }
  | { readonly kind: 'picture'; readonly picture: string; readonly align: 'left' | 'right' };

const PICTURE = /^!\[([a-z]+)\]\((left|right)\)$/;
const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((\/(?!\/)[^)\s]*|donate)\)/g;

export function parseInlines(text: string): MarkdownInline[] {
  const result: MarkdownInline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) result.push({ kind: 'text', text: text.slice(last, match.index) });
    const [, strong, em, linkText, href] = match;
    if (strong !== undefined) result.push({ kind: 'strong', text: strong });
    else if (em !== undefined) result.push({ kind: 'em', text: em });
    else result.push({ kind: 'link', text: linkText ?? '', href: href ?? '/' });
    last = match.index + match[0].length;
  }
  if (last < text.length) result.push({ kind: 'text', text: text.slice(last) });
  return result;
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  for (const chunk of source.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const text = chunk.trim();
    if (!text) continue;
    const picture = PICTURE.exec(text);
    if (picture) {
      blocks.push({
        kind: 'picture',
        picture: picture[1] ?? '',
        align: picture[2] === 'left' ? 'left' : 'right',
      });
    } else if (text.startsWith('# ')) {
      blocks.push({ kind: 'heading', text: text.slice(2).trim() });
    } else {
      blocks.push({ kind: 'paragraph', inlines: parseInlines(text.replace(/\s*\n\s*/g, ' ')) });
    }
  }
  return blocks;
}
