/**
 * Languages of the user interface (v0.4). German is always the default; English is chosen
 * with the flag in the top right corner or in the settings and stored with the account.
 */
export const LANGUAGES = ['de', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'de';

export function isLanguage(value: unknown): value is Language {
  return value === 'de' || value === 'en';
}

/** Locale for dates and numbers: British English to match the flag. */
export function localeOf(language: Language): string {
  return language === 'en' ? 'en-GB' : 'de-DE';
}
