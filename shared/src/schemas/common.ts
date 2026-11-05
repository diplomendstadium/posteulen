/** Shared building blocks for strict request schemas (SPEC 6: types, lengths, no unknown fields). */
import * as v from 'valibot';

export const Base64Url = (min: number, max: number) =>
  v.pipe(v.string(), v.minLength(min), v.maxLength(max), v.regex(/^[A-Za-z0-9_-]+$/));

/** External IDs: 128 bits base64url = 22 characters. */
export const Id = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{22}$/));

export const ShortText = (max: number) => v.pipe(v.string(), v.maxLength(max));
