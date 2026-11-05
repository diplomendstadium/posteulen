/**
 * Contact vault (SPEC 5.7): per contact the bound public keys and the "compared" flag,
 * encrypted and authenticated with the vault key (associated data: own ID, contact ID, version),
 * so that the server can neither read nor swap entries.
 */
import { CONTEXTS } from './contexts.ts';
import { encodeFields, fromBase64Url, toBase64Url } from './encoding.ts';
import { sodium } from './sodium.ts';

export interface KeySet {
  readonly ed25519: string;
  readonly x25519: string;
  readonly firstSeen: number;
}

export interface VaultEntry {
  readonly contactUserId: string;
  /** Oldest first; the last one is the current binding. Old ones keep old letters verifiable. */
  readonly keySets: readonly KeySet[];
  readonly compared: boolean;
  readonly separated: boolean;
}

function ad(ownUserId: string, contactUserId: string, version: number): Uint8Array {
  return encodeFields(CONTEXTS.AD_VAULT, ownUserId, contactUserId, version);
}

export async function sealVaultEntry(
  vaultKey: Uint8Array,
  ownUserId: string,
  version: number,
  entry: VaultEntry,
): Promise<string> {
  const s = await sodium();
  const nonce = s.randombytes_buf(24);
  const plain = new TextEncoder().encode(JSON.stringify(entry));
  const cipher = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plain,
    ad(ownUserId, entry.contactUserId, version),
    null,
    nonce,
    vaultKey,
  );
  const out = new Uint8Array(24 + cipher.length);
  out.set(nonce);
  out.set(cipher, 24);
  return toBase64Url(out);
}

export async function openVaultEntry(
  vaultKey: Uint8Array,
  ownUserId: string,
  contactUserId: string,
  version: number,
  blob: string,
): Promise<VaultEntry> {
  const s = await sodium();
  const bytes = fromBase64Url(blob);
  const plain = s.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    bytes.subarray(24),
    ad(ownUserId, contactUserId, version),
    bytes.subarray(0, 24),
    vaultKey,
  );
  const entry = JSON.parse(new TextDecoder().decode(plain)) as VaultEntry;
  if (entry.contactUserId !== contactUserId)
    throw new Error('vault entry belongs to another contact');
  return entry;
}

export function currentKeys(entry: VaultEntry): KeySet | undefined {
  return entry.keySets[entry.keySets.length - 1];
}

/** Binding on (re-)coupling (SPEC 5.7 last point). */
export function bindKeys(
  previous: VaultEntry | null,
  contactUserId: string,
  keys: { ed25519: string; x25519: string },
  now: number,
): { entry: VaultEntry; changed: boolean } {
  const current = previous ? currentKeys(previous) : undefined;
  if (previous && current && current.ed25519 === keys.ed25519 && current.x25519 === keys.x25519) {
    return { entry: { ...previous, separated: false }, changed: false };
  }
  const keySets = [...(previous?.keySets ?? []), { ...keys, firstSeen: now }];
  return {
    entry: { contactUserId, keySets, compared: false, separated: false },
    changed: previous !== null,
  };
}

/** The key set that was valid for a letter: the one whose signature verifies is chosen by the caller. */
export function allSigningKeys(entry: VaultEntry): Uint8Array[] {
  return entry.keySets.map((set) => fromBase64Url(set.ed25519));
}

/**
 * Safety number (SPEC 5.7): SHA-512 over both IDs and key sets, sorted by user ID; 60 digits
 * in 12 groups of five. Identical for both sides.
 */
export async function safetyNumber(
  a: { userId: string; ed25519: string; x25519: string },
  b: { userId: string; ed25519: string; x25519: string },
): Promise<string> {
  const [first, second] = a.userId < b.userId ? [a, b] : [b, a];
  const input = encodeFields(
    CONTEXTS.SAFETY_NUMBER,
    first.userId,
    fromBase64Url(first.ed25519),
    fromBase64Url(first.x25519),
    second.userId,
    fromBase64Url(second.ed25519),
    fromBase64Url(second.x25519),
  );
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-512', input as BufferSource));
  const groups: string[] = [];
  for (let i = 0; i < 12; i++) {
    let value = 0;
    for (let j = 0; j < 5; j++) value = value * 256 + (digest[i * 5 + j] ?? 0);
    groups.push(String(value % 100_000).padStart(5, '0'));
  }
  return groups.join(' ');
}

/** Label of an own contact request (the requested name), readable only by the requester. */
export async function sealLabel(
  vaultKey: Uint8Array,
  ownUserId: string,
  text: string,
): Promise<string> {
  const s = await sodium();
  const nonce = s.randombytes_buf(24);
  const cipher = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    new TextEncoder().encode(text),
    encodeFields(CONTEXTS.AD_REQUEST_LABEL, ownUserId),
    null,
    nonce,
    vaultKey,
  );
  const out = new Uint8Array(24 + cipher.length);
  out.set(nonce);
  out.set(cipher, 24);
  return toBase64Url(out);
}

export async function openLabel(
  vaultKey: Uint8Array,
  ownUserId: string,
  blob: string,
): Promise<string> {
  const s = await sodium();
  const bytes = fromBase64Url(blob);
  const plain = s.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    bytes.subarray(24),
    encodeFields(CONTEXTS.AD_REQUEST_LABEL, ownUserId),
    bytes.subarray(0, 24),
    vaultKey,
  );
  return new TextDecoder().decode(plain);
}
