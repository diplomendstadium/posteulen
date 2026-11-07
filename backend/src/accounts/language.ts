/**
 * Language of an account (v0.4): chosen at registration (the view the account was created
 * in) and changeable in the settings or with the flag. The server needs it only for texts it
 * writes itself – bot letters and replies, names of loan owls and chicks, push texts.
 */
import { DEFAULT_LANGUAGE, isLanguage, type Language } from '@posteulen/shared/i18n.ts';
import type { Context } from '../context.ts';

export function languageOf(ctx: Context, userId: string): Language {
  const row = ctx.db.get<{ language: string }>('SELECT language FROM users WHERE id = ?', userId);
  return isLanguage(row?.language) ? row.language : DEFAULT_LANGUAGE;
}
