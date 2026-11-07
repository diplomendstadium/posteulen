import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  checkOwlName,
  checkPassword,
  checkUserName,
  countCodePoints,
  isReservedName,
  normalizeName,
} from '../src/names.ts';

describe('name normalisation (SPEC 7.1)', () => {
  it.each([
    ['René', 'Rene'],
    ['Straße', 'STRASSE'],
    ['AIex', 'Alex'],
    ['J0nas', 'Jonas'],
    ['Œuvre', 'oeuvre'],
    ['Ærø', 'aero'],
    ['ali', 'All'],
    ['Lilli1', 'LILLII'],
  ])('treats %s and %s as the same name', (a, b) => {
    expect(normalizeName(a)).toBe(normalizeName(b));
  });

  it('keeps different names apart', () => {
    expect(normalizeName('Anna')).not.toBe(normalizeName('Anne'));
    expect(normalizeName('Peter Pan')).not.toBe(normalizeName('PeterPan'));
  });

  it('is idempotent and case-insensitive (property)', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const key = normalizeName(s);
        expect(normalizeName(key)).toBe(key);
        expect(normalizeName(s.toUpperCase())).toBe(normalizeName(s.toLowerCase()));
      }),
    );
  });
});

describe('user names (SPEC 7.1)', () => {
  it('accepts allowed names and keeps the spelling', () => {
    expect(checkUserName('René Müller')).toEqual({ display: 'René Müller', key: 'rene muller' });
    expect(checkUserName('Zoë')).toMatchObject({ key: 'zoe' });
    expect(checkUserName('Zoÿ')).toBe('invalid_characters');
    expect(checkUserName('François 2')).toMatchObject({ display: 'François 2' });
    expect(checkUserName('ÇÉÑØŒ')).toMatchObject({ display: 'ÇÉÑØŒ' });
  });

  it('normalises NFD input to NFC before counting', () => {
    const decomposed = 'René';
    expect(checkUserName(decomposed)).toEqual({ display: 'René', key: 'rene' });
    expect(countCodePoints(decomposed.normalize('NFC'))).toBe(4);
  });

  it.each([
    ['Al', 'too_short'],
    ['A'.repeat(21), 'too_long'],
    ['Иван', 'invalid_characters'],
    ['Alex!', 'invalid_characters'],
    ['ẞabc', 'invalid_characters'],
    ['Ana​', 'invalid_characters'],
    [' Alex', 'invalid_spaces'],
    ['Alex ', 'invalid_spaces'],
    ['Al  ex', 'invalid_spaces'],
    ['Al\tex', 'invalid_characters'],
  ])('rejects %j (%s)', (name, error) => {
    expect(checkUserName(name)).toBe(error);
  });

  it.each([
    'Admin',
    'ADMINISTRATOR',
    'Adm1n',
    'root',
    'Erklärbär',
    'Erklaerbaer',
    'Erklär Bär',
    'Post Eulen',
    'PostEule',
    'Systemnachrichten',
    'Unbekannt',
    'Tante',
    'Tante Emma',
    'onkel Paul',
    'Bot',
    'Papeterie',
    'Menagerie',
    'Support',
    'Moderator',
    // v0.6: the bots' names in the English view.
    'Explainer Bear',
    'ExplainerBear',
    'Aunt',
    'Aunt Emma',
    'uncle Paul',
    'System messages',
    'Unknown',
  ])('rejects the reserved name %s', (name) => {
    expect(isReservedName(name)).toBe(true);
    expect(checkUserName(name)).toBe('reserved');
  });

  it('allows names that only contain a reserved word later', () => {
    expect(checkUserName('Emma Tante')).toMatchObject({ display: 'Emma Tante' });
    expect(checkUserName('Auntie')).toMatchObject({ display: 'Auntie' });
    expect(checkUserName('Rooter')).toMatchObject({ display: 'Rooter' });
  });

  it('never throws on arbitrary input (property)', () => {
    fc.assert(fc.property(fc.string({ unit: 'binary' }), (s) => void checkUserName(s)));
  });
});

describe('owl names and passwords', () => {
  it('validates owl names (SPEC 9.2.4)', () => {
    expect(checkOwlName('Ab')).toMatchObject({ display: 'Ab' });
    expect(checkOwlName('A')).toBe('too_short');
    expect(checkOwlName('Tante')).toMatchObject({ display: 'Tante' });
  });

  it('checks password length in code points after NFC (SPEC 7.2)', () => {
    expect(checkPassword('a'.repeat(14))).toBe('too_short');
    expect(checkPassword('a'.repeat(15))).toBeNull();
    expect(checkPassword('ä'.repeat(15))).toBeNull();
    expect(checkPassword('ä'.repeat(15))).toBeNull();
    expect(checkPassword('a'.repeat(257))).toBe('too_long');
    expect(checkPassword('🦉'.repeat(15))).toBeNull();
  });
});
