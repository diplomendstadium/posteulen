/**
 * Text rules for letters (SPEC 5.9): NFC; no emojis, control characters (except line breaks)
 * or invisible formatting/direction characters. One function for writing and reading – the
 * receiving browser applies it again, because the server cannot check encrypted letters.
 */
import { LETTER } from './constants.ts';
import { countCodePoints } from './names.ts';

export type Parchment = 'small' | 'large';

/**
 * Emoji = Extended_Pictographic (except ©, ® and ™), emoji modifiers, regional indicators,
 * U+FE0F and U+20E3. Not \p{Emoji}: that would also remove 0–9, # and *.
 */
const EMOJI = /(?![©®™])\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|️|⃣/gu;
/** Control characters except \n, and all format characters (zero-width, direction marks, tags …). */
const INVISIBLE = /(?!\n)\p{Cc}|\p{Cf}/gu;

export interface SanitizedText {
  readonly text: string;
  /** Emojis were removed (UI hint: „Pergament kennt keine Smileys.“). */
  readonly removedEmoji: boolean;
  readonly removedOther: boolean;
}

export function sanitizeLetterText(input: string): SanitizedText {
  const normalized = input.normalize('NFC').replace(/\r\n?/g, '\n');
  const withoutEmoji = normalized.replace(EMOJI, '');
  const text = withoutEmoji.replace(INVISIBLE, '');
  return {
    text,
    removedEmoji: withoutEmoji !== normalized,
    removedOther: text !== withoutEmoji,
  };
}

export function maxChars(parchment: Parchment): number {
  return parchment === 'large' ? LETTER.LARGE_MAX_CHARS : LETTER.SMALL_MAX_CHARS;
}

export function paddedBytes(parchment: Parchment): number {
  return parchment === 'large' ? LETTER.LARGE_PADDED_BYTES : LETTER.SMALL_PADDED_BYTES;
}

/** A letter text is valid if it is already clean, not empty and fits the parchment. */
export function letterTextError(
  text: string,
  parchment: Parchment,
): 'empty' | 'too_long' | 'invalid' | null {
  const clean = sanitizeLetterText(text).text;
  if (clean !== text.normalize('NFC')) return 'invalid';
  if (clean.trim() === '') return 'empty';
  if (countCodePoints(clean) > maxChars(parchment)) return 'too_long';
  return null;
}
