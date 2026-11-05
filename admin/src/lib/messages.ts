import { de } from '@posteulen/shared/texts/de.ts';
import { ApiError } from './api.ts';

export function message(error: unknown): string {
  if (error instanceof ApiError)
    return (de.errors as Record<string, string>)[error.code] ?? de.errors.internal;
  return de.errors.internal;
}
