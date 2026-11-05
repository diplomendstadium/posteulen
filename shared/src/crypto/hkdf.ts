/**
 * HKDF-SHA256 (RFC 5869) via WebCrypto, available in all target browsers and in Node.js
 * (D-02). Salt is empty unless given; `info` is a domain-separation string.
 */
const encoder = new TextEncoder();

export async function hkdfSha256(
  ikm: Uint8Array,
  info: string | Uint8Array,
  length = 32,
  salt: Uint8Array = new Uint8Array(0),
): Promise<Uint8Array> {
  if (!Number.isInteger(length) || length < 1 || length > 255 * 32) {
    throw new RangeError('invalid HKDF output length');
  }
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, [
    'deriveBits',
  ]);
  const infoBytes = typeof info === 'string' ? encoder.encode(info) : info;
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: infoBytes as BufferSource },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}
