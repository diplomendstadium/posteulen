/** Shared building blocks for strict request schemas (SPEC 6: types, lengths, no unknown fields). */
import * as v from 'valibot';

/**
 * Unpadded base64url. A length of 4n + 1 can never be decoded; v0.6.1 rejects it here, before
 * it reached the decoder and ended as a server error.
 */
export const Base64Url = (min: number, max: number) =>
  v.pipe(
    v.string(),
    v.minLength(min),
    v.maxLength(max),
    v.regex(/^[A-Za-z0-9_-]+$/),
    v.check((text) => text.length % 4 !== 1),
  );

/** External IDs: 128 bits base64url = 22 characters. */
export const Id = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{22}$/));

export const ShortText = (max: number) => v.pipe(v.string(), v.maxLength(max));
