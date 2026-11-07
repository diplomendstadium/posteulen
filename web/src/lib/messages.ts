import { t } from './i18n.svelte.ts';
import { ApiError } from './api.ts';

/** German message for any error, never internals (SPEC 6). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const texts = t.errors as Record<string, string>;
    return texts[error.code] ?? t.errors.internal;
  }
  return t.errors.internal;
}
