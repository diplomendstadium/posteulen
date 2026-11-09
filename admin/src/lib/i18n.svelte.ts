/**
 * v0.8: language of the admin panel and of the bots control centre – German by default, English
 * on request (the switch in the top bar; remembered on this device). Entries of the error log
 * and the names of server-side things stay as the server wrote them (German).
 */
import { de, fill, type Texts } from '@posteulen/shared/texts/de.ts';
import { en } from '@posteulen/shared/texts/en.ts';
import { DEFAULT_LANGUAGE, isLanguage, localeOf, type Language } from '@posteulen/shared/i18n.ts';
import { speciesName as nameOfSpecies } from '@posteulen/shared/species.ts';

const KEY = 'posteulen.panel.language';

function stored(): Language {
  try {
    const value = localStorage.getItem(KEY);
    return isLanguage(value) ? value : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export const panel = $state<{ lang: Language }>({ lang: stored() });

export function setPanelLanguage(language: Language): void {
  panel.lang = language;
  document.documentElement.lang = language;
  try {
    localStorage.setItem(KEY, language);
  } catch {
    // Without storage the choice lasts for this visit only.
  }
}

document.documentElement.lang = panel.lang;

export const t: Texts = new Proxy({} as Texts, {
  get: (_target, key) => (panel.lang === 'en' ? en : de)[key as keyof Texts],
});

export { fill };

export function locale(): string {
  return localeOf(panel.lang);
}

export function speciesName(id: string): string {
  return nameOfSpecies(id, panel.lang);
}
