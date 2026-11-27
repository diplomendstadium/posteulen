/**
 * v1.4.3: time-based one-time passwords after RFC 6238 / RFC 4226 (SPEC 5.11) with the HMAC of
 * Node's crypto module – no own cryptography: HMAC-SHA1 over the counter, dynamic truncation,
 * six digits. Secrets travel as Base32 (RFC 4648, without padding) for authenticator apps such as
 * KeePassXC.
 */
import crypto from 'node:crypto';
import { TWO_FACTOR } from '@posteulen/shared/constants.ts';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/** HOTP value of one counter (RFC 4226). */
export function hotp(
  secret: Uint8Array,
  counter: number,
  digits: number = TWO_FACTOR.DIGITS,
): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac('sha1', secret).update(message).digest();
  // Dynamic truncation (RFC 4226, 5.3): four bytes from the offset in the last nibble.
  const offset = mac.readUInt8(mac.length - 1) & 0x0f;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/** Time step of a moment (RFC 6238, T0 = 0). */
export function timeStep(now: number): number {
  return Math.floor(now / 1000 / TWO_FACTOR.PERIOD_SECONDS);
}

/**
 * The time step a code belongs to, if it fits the current step or one next to it and is newer
 * than the last step used (a code never works twice); otherwise null.
 */
export function matchTotp(
  secret: Uint8Array,
  code: string,
  now: number,
  lastStep: number,
): number | null {
  if (!new RegExp(`^\\d{${TWO_FACTOR.DIGITS}}$`).test(code)) return null;
  const current = timeStep(now);
  for (let delta = -TWO_FACTOR.WINDOW_STEPS; delta <= TWO_FACTOR.WINDOW_STEPS; delta++) {
    const step = current + delta;
    if (step <= lastStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (crypto.timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

/** The `otpauth://` address for QR codes and authenticator apps. */
export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TWO_FACTOR.DIGITS),
    period: String(TWO_FACTOR.PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
