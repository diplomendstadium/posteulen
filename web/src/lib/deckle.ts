/**
 * Deckle edge of a letter sheet (v0.3): one of six fixed clip-path variants in base.css
 * (`.deckle-0` … `.deckle-5`), chosen from the letter ID – a letter keeps its edge on every
 * visit, and no inline styles are needed (strict CSP, no inline styles).
 */
export const DECKLE_VARIANTS = 6;

export function deckleClass(id: string): string {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `deckle-${(hash >>> 0) % DECKLE_VARIANTS}`;
}
