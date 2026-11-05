import { describe, expect, it } from 'vitest';
import { hkdfSha256 } from '../src/crypto/hkdf.ts';

const hex = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'hex'));
const toHex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

describe('HKDF-SHA256 via WebCrypto (D-02)', () => {
  it('matches RFC 5869 test case 1', async () => {
    const okm = await hkdfSha256(
      hex('0b'.repeat(22)),
      hex('f0f1f2f3f4f5f6f7f8f9'),
      42,
      hex('000102030405060708090a0b0c'),
    );
    expect(toHex(okm)).toBe(
      '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
    );
  });

  it('matches RFC 5869 test case 3 (empty salt and info)', async () => {
    const okm = await hkdfSha256(hex('0b'.repeat(22)), new Uint8Array(0), 42);
    expect(toHex(okm)).toBe(
      '8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8',
    );
  });

  it('separates contexts', async () => {
    const ikm = new Uint8Array(32).fill(7);
    const a = await hkdfSha256(ikm, 'PostEulen/a/v1');
    const b = await hkdfSha256(ikm, 'PostEulen/b/v1');
    expect(a).toHaveLength(32);
    expect(toHex(a)).not.toBe(toHex(b));
  });

  it('rejects invalid lengths', async () => {
    await expect(hkdfSha256(new Uint8Array(32), 'x', 0)).rejects.toThrow(RangeError);
    await expect(hkdfSha256(new Uint8Array(32), 'x', 255 * 32 + 1)).rejects.toThrow(RangeError);
  });
});
