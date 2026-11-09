import { t } from './i18n.svelte.ts';
import { ApiError } from './api.ts';

export function message(error: unknown): string {
  if (error instanceof ApiError)
    return (t.errors as Record<string, string>)[error.code] ?? t.errors.internal;
  return t.errors.internal;
}
