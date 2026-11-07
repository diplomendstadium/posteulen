/**
 * Language of the web app (v0.4). German is the default; the flag in the top right corner
 * switches. Before login the choice is remembered on this device (localStorage); after login
 * the language of the account wins and the flag changes it there too.
 *
 * `t` always returns the texts of the current language. The app is re-rendered as a whole
 * when the language changes (App.svelte, `{#key}`), so texts computed once in a component
 * follow as well.
 */
import { de, fill, type Texts } from '@posteulen/shared/texts/de.ts';
import { en } from '@posteulen/shared/texts/en.ts';
import { formatGold as formatTenths } from '@posteulen/shared/game/gold.ts';
import { DEFAULT_LANGUAGE, isLanguage, localeOf, type Language } from '@posteulen/shared/i18n.ts';
import { speciesName as nameOfSpecies } from '@posteulen/shared/species.ts';

const KEY = 'posteulen.language';

function stored(): Language {
  try {
    const value = localStorage.getItem(KEY);
    return isLanguage(value) ? value : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export const i18n = $state<{ lang: Language }>({ lang: stored() });

/** Switches the view and remembers the choice on this device (no server request here). */
export function setLanguage(language: Language): void {
  i18n.lang = language;
  document.documentElement.lang = language;
  try {
    localStorage.setItem(KEY, language);
  } catch {
    // Without storage the choice lasts for this visit only.
  }
}

document.documentElement.lang = i18n.lang;

/** The texts of the current language (a view on `de` or `en`). */
export const t: Texts = new Proxy({} as Texts, {
  get: (_target, key) => (i18n.lang === 'en' ? en : de)[key as keyof Texts],
});

export { fill };

/** "12,3" or "12.3", depending on the language. */
export function formatGold(tenths: number): string {
  return formatTenths(tenths, i18n.lang === 'en' ? '.' : ',');
}

export function speciesName(id: string): string {
  return nameOfSpecies(id, i18n.lang);
}

/** Locale for dates and numbers. */
export function locale(): string {
  return localeOf(i18n.lang);
}

/** "3,0 Gold" or "3.0 gold". */
export function goldText(tenths: number): string {
  return fill(t.header.goldAmount, { amount: formatGold(tenths) });
}

/** A decimal number with fixed digits in the notation of the language ("52,38" / "52.38"). */
export function decimal(value: number, digits: number): string {
  const text = value.toFixed(digits);
  return i18n.lang === 'en' ? text : text.replace('.', ',');
}
