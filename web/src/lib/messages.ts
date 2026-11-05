import { de } from '@posteulen/shared/texts/de.ts';
import { ApiError } from './api.ts';

/** German message for any error, never internals (SPEC 6). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const texts = de.errors as Record<string, string>;
    return texts[error.code] ?? de.errors.internal;
  }
  return de.errors.internal;
}
