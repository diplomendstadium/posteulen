/**
 * HPKE (RFC 9180) for letter keys (SPEC 5.8): mode Base, DHKEM(X25519, HKDF-SHA256),
 * HKDF-SHA256, ChaCha20-Poly1305. Output: enc (32 bytes) ‖ ciphertext (48 bytes).
 */
import { CipherSuite, HkdfSha256 } from '@hpke/core';
import { Chacha20Poly1305 } from '@hpke/chacha20poly1305';
import { DhkemX25519HkdfSha256 } from '@hpke/dhkem-x25519';

export const WRAPPED_KEY_BYTES = 80;

let suite: CipherSuite | undefined;
function cipherSuite(): CipherSuite {
  suite ??= new CipherSuite({
    kem: new DhkemX25519HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });
  return suite;
}

export async function wrapKey(
  recipientPublic: Uint8Array,
  info: Uint8Array,
  key: Uint8Array,
): Promise<Uint8Array> {
  const s = cipherSuite();
  const publicKey = await s.kem.deserializePublicKey(recipientPublic as Uint8Array<ArrayBuffer>);
  const sender = await s.createSenderContext({
    recipientPublicKey: publicKey,
    info: info as Uint8Array<ArrayBuffer>,
  });
  const ciphertext = new Uint8Array(await sender.seal(key as Uint8Array<ArrayBuffer>));
  const out = new Uint8Array(32 + ciphertext.length);
  out.set(new Uint8Array(sender.enc));
  out.set(ciphertext, 32);
  return out;
}

export async function unwrapKey(
  recipientSecret: Uint8Array,
  recipientPublic: Uint8Array,
  info: Uint8Array,
  wrapped: Uint8Array,
): Promise<Uint8Array> {
  if (wrapped.length !== WRAPPED_KEY_BYTES) throw new Error('wrapped key has the wrong length');
  const s = cipherSuite();
  const privateKey = await s.kem.deserializePrivateKey(recipientSecret as Uint8Array<ArrayBuffer>);
  const publicKey = await s.kem.deserializePublicKey(recipientPublic as Uint8Array<ArrayBuffer>);
  const recipient = await s.createRecipientContext({
    recipientKey: { privateKey, publicKey },
    enc: wrapped.slice(0, 32),
    info: info as Uint8Array<ArrayBuffer>,
  });
  return new Uint8Array(await recipient.open(wrapped.slice(32)));
}
