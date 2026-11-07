/**
 * Master key and identity keys (SPEC 5.1–5.4, SPEC Anhang L.2).
 * - The master key (32 random bytes) never changes; only its wrapping depends on the password.
 * - Wrapping key = HKDF-SHA256(OPAQUE export_key, "PostEulen/master-key-wrap/v1").
 * - Private identity keys are encrypted with HKDF(master key, "PostEulen/identity-keys/v1").
 * - All encryption: XChaCha20-Poly1305 with random 24-byte nonce and bound associated data.
 */
import { CONTEXTS } from './contexts.ts';
import { encodeFields, fromBase64Url, toBase64Url } from './encoding.ts';
import { hkdfSha256 } from './hkdf.ts';
import { sodium } from './sodium.ts';

export const KEY_FORMAT = 1;
export const MASTER_KEY_BYTES = 32;
export const ED25519_SECRET_BYTES = 64;
export const X25519_SECRET_BYTES = 32;
export const PUBLIC_KEY_BYTES = 32;
const NONCE_BYTES = 24;
const TAG_BYTES = 16;
export const WRAPPED_MASTER_KEY_BYTES = NONCE_BYTES + MASTER_KEY_BYTES + TAG_BYTES;
export const ENCRYPTED_PRIVATE_KEYS_BYTES =
  NONCE_BYTES + ED25519_SECRET_BYTES + X25519_SECRET_BYTES + TAG_BYTES;

/** What the server stores (SPEC 5.1: only encrypted parts). */
export interface KeyPackage {
  readonly format: number;
  readonly wrappedMasterKey: string;
  readonly privateKeys: string;
}

export interface IdentityKeys {
  readonly ed25519Public: Uint8Array;
  readonly ed25519Secret: Uint8Array;
  readonly x25519Public: Uint8Array;
  readonly x25519Secret: Uint8Array;
}

export interface UnlockedAccount {
  readonly masterKey: Uint8Array;
  readonly identity: IdentityKeys;
  readonly vaultKey: Uint8Array;
}

export class KeyPackageError extends Error {}

async function seal(key: Uint8Array, plaintext: Uint8Array, ad: Uint8Array): Promise<Uint8Array> {
  const s = await sodium();
  const nonce = s.randombytes_buf(NONCE_BYTES);
  const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, ad, null, nonce, key);
  const out = new Uint8Array(NONCE_BYTES + ciphertext.length);
  out.set(nonce);
  out.set(ciphertext, NONCE_BYTES);
  return out;
}

async function open(key: Uint8Array, sealed: Uint8Array, ad: Uint8Array): Promise<Uint8Array> {
  const s = await sodium();
  if (sealed.length < NONCE_BYTES + TAG_BYTES) throw new KeyPackageError('ciphertext too short');
  try {
    return s.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      sealed.subarray(NONCE_BYTES),
      ad,
      sealed.subarray(0, NONCE_BYTES),
      key,
    );
  } catch {
    throw new KeyPackageError('decryption failed');
  }
}

function masterKeyAd(userId: string): Uint8Array {
  return encodeFields(CONTEXTS.AD_MASTER_KEY, userId, 'master-key', KEY_FORMAT);
}

function identityAd(userId: string): Uint8Array {
  return encodeFields(CONTEXTS.AD_IDENTITY_KEYS, userId, 'ed25519+x25519', KEY_FORMAT);
}

export function wrappingKey(exportKey: Uint8Array): Promise<Uint8Array> {
  return hkdfSha256(exportKey, CONTEXTS.MASTER_KEY_WRAP);
}

export async function generateIdentity(): Promise<IdentityKeys> {
  const s = await sodium();
  const ed = s.crypto_sign_keypair();
  const x = s.crypto_box_keypair();
  return {
    ed25519Public: ed.publicKey,
    ed25519Secret: ed.privateKey,
    x25519Public: x.publicKey,
    x25519Secret: x.privateKey,
  };
}

/** Registration: new master key and identity, packaged for the server (SPEC 5.2 step 3). */
export async function createAccountKeys(
  userId: string,
  exportKey: Uint8Array,
): Promise<{ keyPackage: KeyPackage; account: UnlockedAccount }> {
  const s = await sodium();
  const masterKey = s.randombytes_buf(MASTER_KEY_BYTES);
  const identity = await generateIdentity();
  const keyPackage = await packageKeys(userId, exportKey, masterKey, identity);
  const vaultKey = await hkdfSha256(masterKey, CONTEXTS.CONTACT_VAULT);
  return { keyPackage, account: { masterKey, identity, vaultKey } };
}

export async function packageKeys(
  userId: string,
  exportKey: Uint8Array,
  masterKey: Uint8Array,
  identity: IdentityKeys,
): Promise<KeyPackage> {
  const wrapped = await seal(await wrappingKey(exportKey), masterKey, masterKeyAd(userId));
  const secrets = new Uint8Array(ED25519_SECRET_BYTES + X25519_SECRET_BYTES);
  secrets.set(identity.ed25519Secret);
  secrets.set(identity.x25519Secret, ED25519_SECRET_BYTES);
  const identityKey = await hkdfSha256(masterKey, CONTEXTS.IDENTITY_KEYS);
  const privateKeys = await seal(identityKey, secrets, identityAd(userId));
  secrets.fill(0);
  return {
    format: KEY_FORMAT,
    wrappedMasterKey: toBase64Url(wrapped),
    privateKeys: toBase64Url(privateKeys),
  };
}

/**
 * Password change (SPEC 5.6): the unchanged master key is wrapped with the new export_key;
 * the encrypted private keys stay exactly as they are.
 */
export async function rewrapMasterKey(
  userId: string,
  keyPackage: KeyPackage,
  oldExportKey: Uint8Array,
  newExportKey: Uint8Array,
): Promise<KeyPackage> {
  const masterKey = await unwrapMasterKey(userId, keyPackage, oldExportKey);
  const wrapped = await seal(await wrappingKey(newExportKey), masterKey, masterKeyAd(userId));
  masterKey.fill(0);
  return { ...keyPackage, wrappedMasterKey: toBase64Url(wrapped) };
}

export async function unwrapMasterKey(
  userId: string,
  keyPackage: KeyPackage,
  exportKey: Uint8Array,
): Promise<Uint8Array> {
  if (keyPackage.format !== KEY_FORMAT) throw new KeyPackageError('unknown key format');
  return open(
    await wrappingKey(exportKey),
    fromBase64Url(keyPackage.wrappedMasterKey),
    masterKeyAd(userId),
  );
}

/**
 * Login: unwraps everything and checks that the private keys match the public keys the server
 * delivered (a swapped package is detected).
 */
export async function unlockAccount(
  userId: string,
  keyPackage: KeyPackage,
  exportKey: Uint8Array,
  publicKeys: { ed25519: Uint8Array; x25519: Uint8Array },
): Promise<UnlockedAccount> {
  const s = await sodium();
  const masterKey = await unwrapMasterKey(userId, keyPackage, exportKey);
  const identityKey = await hkdfSha256(masterKey, CONTEXTS.IDENTITY_KEYS);
  const secrets = await open(
    identityKey,
    fromBase64Url(keyPackage.privateKeys),
    identityAd(userId),
  );
  if (secrets.length !== ED25519_SECRET_BYTES + X25519_SECRET_BYTES) {
    throw new KeyPackageError('unexpected key length');
  }
  const ed25519Secret = secrets.slice(0, ED25519_SECRET_BYTES);
  const x25519Secret = secrets.slice(ED25519_SECRET_BYTES);
  const ed25519Public = s.crypto_sign_ed25519_sk_to_pk(ed25519Secret);
  const x25519Public = s.crypto_scalarmult_base(x25519Secret);
  if (!s.memcmp(ed25519Public, publicKeys.ed25519) || !s.memcmp(x25519Public, publicKeys.x25519)) {
    throw new KeyPackageError('private keys do not match the public keys');
  }
  const vaultKey = await hkdfSha256(masterKey, CONTEXTS.CONTACT_VAULT);
  return {
    masterKey,
    identity: { ed25519Public, ed25519Secret, x25519Public, x25519Secret },
    vaultKey,
  };
}
