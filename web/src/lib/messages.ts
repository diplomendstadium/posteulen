import { t } from './i18n.svelte.ts';
import { ApiError, isStale } from './api.ts';

/** German message for any error, never internals (SPEC 6). */
export function errorMessage(error: unknown): string {
  // Work of an earlier account context (SPEC 5.5).
  if (isStale(error)) return t.errors.stale;
  if (error instanceof ApiError) {
    const texts = t.errors as Record<string, string>;
    return texts[error.code] ?? t.errors.internal;
  }
  return t.errors.internal;
}
