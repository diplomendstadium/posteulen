/**
 * v1.3.1: passwords that are too easy to guess (SPEC 7.2). The server never sees a password
 * (OPAQUE, 5.3), so the app checks at registration and on a password change:
 * - the password contains the user name (compared like names, 7.1; names with at least 3
 *   characters),
 * - it is on a public list of frequently used passwords (common-passwords-data.ts),
 * - it follows a simple pattern: at most 3 different characters, one block repeated
 *   ("hallo123hallo123"), or a run along the alphabet, the digits or a keyboard row
 *   ("123456789012345", "qwertzuiopasdfg").
 * Patterns are also checked without digits and signs at the end ("abcdefghijklmn2024!").
 */
import { normalizeName } from '../names.ts';

export type PasswordWeakness = 'contains_name' | 'common' | 'pattern';

/** Runs of neighbouring keys and characters, lower case (German, English, French keyboards). */
const SEQUENCES: readonly string[] = [
  'abcdefghijklmnopqrstuvwxyz',
  '01234567890',
  'qwertzuiopü',
  'asdfghjklöä',
  'yxcvbnm',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  'azertyuiop',
  'qsdfghjklm',
  'wxcvbn',
  '1234567890ß',
  // Columns of the German keyboard.
  '1qay2wsx3edc4rfv5tgb6zhn7ujm8ik9ol0pö',
  '1qaz2wsx3edc4rfv5tgb6yhn7ujm8ik9ol0p',
];

/** The pairs of neighbours in any sequence, both ways. */
const NEIGHBOURS: ReadonlySet<string> = new Set(
  SEQUENCES.flatMap((sequence) => {
    const chars = [...sequence];
    return chars.slice(1).flatMap((char, index) => {
      const before = chars[index] ?? '';
      return [before + char, char + before];
    });
  }),
);

/** At most this share of the steps may leave a run, e.g. at a row change. */
const RUN_SHARE = 0.8;

function isRun(chars: readonly string[]): boolean {
  if (chars.length < 2) return false;
  let steps = 0;
  for (let index = 1; index < chars.length; index++) {
    const pair = (chars[index - 1] ?? '') + (chars[index] ?? '');
    // The same key twice counts as a step of the pattern too ("aabbcc").
    if (NEIGHBOURS.has(pair) || chars[index - 1] === chars[index]) steps++;
  }
  return steps / (chars.length - 1) >= RUN_SHARE;
}

function isRepeated(chars: readonly string[]): boolean {
  const text = chars.join('');
  for (let size = 1; size <= chars.length / 2; size++) {
    if (chars.length % size !== 0) continue;
    if (
      chars
        .slice(0, size)
        .join('')
        .repeat(chars.length / size) === text
    )
      return true;
  }
  return false;
}

function isPattern(text: string): boolean {
  const chars = [...text];
  return new Set(chars).size <= 3 || isRepeated(chars) || isRun(chars);
}

/** The password, for the checks: NFC, lower case, without spaces at the ends. */
function folded(password: string): string {
  return password.normalize('NFC').toLowerCase().trim();
}

let list: ReadonlySet<string> | null = null;

/** The list of frequent passwords, loaded only when needed (it is about 180 KB). */
export async function commonPasswords(): Promise<ReadonlySet<string>> {
  if (!list) {
    const { COMMON_PASSWORDS } = await import('./common-passwords-data.ts');
    list = new Set(COMMON_PASSWORDS.split('\n'));
  }
  return list;
}

/**
 * Why a password is too easy to guess, or null. `common` is the list of frequent passwords
 * (`commonPasswords()`); the length is checked separately (`checkPassword`, names.ts).
 */
export function passwordWeakness(
  password: string,
  userName: string,
  common: ReadonlySet<string>,
): PasswordWeakness | null {
  const text = folded(password);
  // Compared like names (7.1): no accents, ß → ss, 0 → o, 1/i → l, without spaces.
  const name = normalizeName(userName.normalize('NFC')).replace(/\s+/g, '');
  const key = normalizeName(text).replace(/\s+/g, '');
  if (name.length >= 3 && key.includes(name)) return 'contains_name';
  if (common.has(text)) return 'common';
  const core = text.replace(/[\d\p{P}\p{S}\s]+$/u, '');
  if (isPattern(text) || ([...core].length >= 8 && isPattern(core))) return 'pattern';
  return null;
}
