/**
 * Name rules (SPEC 7.1, 9.2.4): one function for validation and one for the comparison key.
 * Used everywhere names are compared (registration, login, contact requests, renaming,
 * reserved and locked names).
 */
import { ACCOUNT, OWL } from './constants.ts';

const LETTERS = 'äöüÄÖÜßàáâãåæçèéêëìíîïñòóôõøœùúûÀÁÂÃÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕØŒÙÚÛ';
const ALLOWED = new RegExp(`^[A-Za-z0-9 ${LETTERS}]+$`, 'u');

export type NameError =
  'too_short' | 'too_long' | 'invalid_characters' | 'invalid_spaces' | 'reserved';

export interface NameCheck {
  /** NFC-normalised display form, exactly as typed otherwise. */
  readonly display: string;
  /** Comparison key (SPEC 7.1). */
  readonly key: string;
}

/** Number of characters = Unicode code points after NFC (SPEC 7.1, 5.9). */
export function countCodePoints(text: string): number {
  return Array.from(text).length;
}

/**
 * Comparison key, in this order: remove accents (NFKD), lower case, ß→ss, æ→ae, œ→oe, ø→o,
 * then treat easily confused characters as equal: 0→o, 1→l, i→l.
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFC')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ø/g, 'o')
    .replace(/0/g, 'o')
    .replace(/[1i]/g, 'l');
}

const RESERVED = [
  'administrator',
  'admin',
  'root',
  'moderator',
  'support',
  'system',
  'systemnachrichten',
  'unbekannt',
  'posteulen',
  'posteule',
  'erklärbär',
  'erklaerbaer',
  'tante',
  'onkel',
  'bot',
  'papeterie',
  'menagerie',
].map((name) => normalizeName(name).replace(/ /g, ''));

const RESERVED_FIRST_WORDS = ['tante', 'onkel'].map(normalizeName);

function checkCharacters(display: string, min: number, max: number): NameError | null {
  const length = countCodePoints(display);
  if (length < min) return 'too_short';
  if (length > max) return 'too_long';
  if (!ALLOWED.test(display)) return 'invalid_characters';
  if (display.startsWith(' ') || display.endsWith(' ') || display.includes('  ')) {
    return 'invalid_spaces';
  }
  return null;
}

export function isReservedName(name: string): boolean {
  const key = normalizeName(name);
  if (RESERVED.includes(key.replace(/ /g, ''))) return true;
  const firstWord = key.split(' ')[0] ?? '';
  return RESERVED_FIRST_WORDS.includes(firstWord);
}

/** Validates a user name (SPEC 7.1). Uniqueness and lock periods are checked by the server. */
export function checkUserName(input: string): NameCheck | NameError {
  const display = input.normalize('NFC');
  const error = checkCharacters(display, ACCOUNT.USER_NAME_MIN_CHARS, ACCOUNT.USER_NAME_MAX_CHARS);
  if (error) return error;
  if (isReservedName(display)) return 'reserved';
  return { display, key: normalizeName(display) };
}

/** Validates an owl name (SPEC 9.2.4): same characters as user names, not unique, not reserved. */
export function checkOwlName(input: string): NameCheck | NameError {
  const display = input.normalize('NFC');
  const error = checkCharacters(display, OWL.NAME_MIN_CHARS, OWL.NAME_MAX_CHARS);
  if (error) return error;
  return { display, key: normalizeName(display) };
}

/** Passwords are NFC-normalised before OPAQUE (SPEC 7.2); length in code points. */
export function normalizePassword(password: string): string {
  return password.normalize('NFC');
}

export type PasswordError = 'too_short' | 'too_long';

export function checkPassword(password: string): PasswordError | null {
  const length = countCodePoints(normalizePassword(password));
  if (length < ACCOUNT.PASSWORD_MIN_CHARS) return 'too_short';
  if (length > ACCOUNT.PASSWORD_MAX_CHARS) return 'too_long';
  return null;
}
