/**
 * Letters between people (SPEC 5.8, 5.9; ARCHITECTURE 2.4):
 * sign (Ed25519, domain-separated, all fields) → pad (ISO 7816-4 to 4 096 / 16 384 bytes) →
 * encrypt (XChaCha20-Poly1305, random 256-bit letter key, bound associated data) →
 * wrap the letter key with HPKE for the recipient and for the sender.
 * Every check on receipt must pass, otherwise the content is not shown.
 */
import { CONTEXTS } from './contexts.ts';
import { decodeFields, encodeFields, fieldNumber, fieldText } from './encoding.ts';
import { unwrapKey, wrapKey } from './hpke.ts';
import { sodium } from './sodium.ts';
import { countCodePoints } from '../names.ts';
import { maxChars, paddedBytes, sanitizeLetterText, type Parchment } from '../text-rules.ts';
import { LETTER } from '../constants.ts';

export const LETTER_FORMAT = 1;
export type LetterKind = 'letter' | 'cover_gold' | 'cover_owl' | 'cover_chick';
export type LetterRole = 'recipient' | 'sender';
export const LETTER_KINDS: readonly LetterKind[] = [
  'letter',
  'cover_gold',
  'cover_owl',
  'cover_chick',
];

const NONCE_BYTES = 24;
const TAG_BYTES = 16;
const SIGNATURE_BYTES = 64;
const FIELD_COUNT = 9;

/** Exact ciphertext length per parchment – the server rejects anything else (SPEC 5.9). */
export function ciphertextBytes(parchment: Parchment): number {
  return NONCE_BYTES + paddedBytes(parchment) + TAG_BYTES;
}

/**
 * Padded size of a stored letter: the current size, or for large letters from before v0.3 the
 * old one (they were sealed with 16 KiB). Anything else is not a valid letter.
 */
function storedPaddedBytes(parchment: Parchment, ciphertextLength: number): number | null {
  if (ciphertextLength === ciphertextBytes(parchment)) return paddedBytes(parchment);
  const legacy = LETTER.LEGACY_LARGE_PADDED_BYTES;
  if (parchment === 'large' && ciphertextLength === NONCE_BYTES + legacy + TAG_BYTES) return legacy;
  return null;
}

export interface LetterMeta {
  readonly letterId: string;
  readonly senderId: string;
  readonly recipientId: string;
  /** Milliseconds since the epoch, assigned by the server (SPEC 5.8). */
  readonly sentAt: number;
  readonly kind: LetterKind;
  readonly parchment: Parchment;
}

export interface SealedLetter {
  readonly ciphertext: Uint8Array;
  readonly wrapRecipient: Uint8Array;
  readonly wrapSender: Uint8Array;
}

function body(meta: LetterMeta, text: string): Uint8Array {
  return encodeFields(
    CONTEXTS.LETTER,
    LETTER_FORMAT,
    meta.letterId,
    meta.senderId,
    meta.recipientId,
    meta.sentAt,
    meta.kind,
    meta.parchment,
    text,
  );
}

function associatedData(
  meta: Pick<LetterMeta, 'letterId' | 'senderId' | 'recipientId' | 'kind' | 'parchment'>,
): Uint8Array {
  return encodeFields(
    CONTEXTS.LETTER_AD,
    meta.letterId,
    meta.senderId,
    meta.recipientId,
    meta.kind,
    meta.parchment,
  );
}

function keyInfo(letterId: string, role: LetterRole): Uint8Array {
  return encodeFields(CONTEXTS.LETTER_KEY, letterId, role);
}

type SealKeys = {
  senderEd25519Secret: Uint8Array;
  senderX25519Public: Uint8Array;
  recipientX25519Public: Uint8Array;
};

export async function sealLetter(
  meta: LetterMeta,
  text: string,
  keys: SealKeys,
): Promise<SealedLetter> {
  const clean = sanitizeLetterText(text).text;
  if (clean !== text.normalize('NFC')) throw new Error('text violates the text rules');
  if (countCodePoints(clean) > maxChars(meta.parchment)) throw new Error('text too long');
  if (meta.kind !== 'letter' && meta.parchment !== 'small')
    throw new Error('cover letters use small parchment');
  return sealUnchecked(meta, clean, keys);
}

/**
 * Without the text checks – only for tests that simulate a manipulated client (SPEC 5.9:
 * the receiver must check again) or a large letter from before v0.3 (`blockBytes`).
 */
export async function sealUnchecked(
  meta: LetterMeta,
  clean: string,
  keys: SealKeys,
  blockBytes: number = paddedBytes(meta.parchment),
): Promise<SealedLetter> {
  const s = await sodium();
  const content = body(meta, clean);
  const signature = s.crypto_sign_detached(
    encodeFields(CONTEXTS.LETTER_SIG, content),
    keys.senderEd25519Secret,
  );
  const plain = new Uint8Array(content.length + SIGNATURE_BYTES);
  plain.set(content);
  plain.set(signature, content.length);
  const padded = s.pad(plain, blockBytes);
  if (padded.length !== blockBytes) throw new Error('padding overflow');
  const letterKey = s.randombytes_buf(32);
  const nonce = s.randombytes_buf(NONCE_BYTES);
  const encrypted = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    padded,
    associatedData(meta),
    null,
    nonce,
    letterKey,
  );
  const ciphertext = new Uint8Array(NONCE_BYTES + encrypted.length);
  ciphertext.set(nonce);
  ciphertext.set(encrypted, NONCE_BYTES);
  const result = {
    ciphertext,
    wrapRecipient: await wrapKey(
      keys.recipientX25519Public,
      keyInfo(meta.letterId, 'recipient'),
      letterKey,
    ),
    wrapSender: await wrapKey(keys.senderX25519Public, keyInfo(meta.letterId, 'sender'), letterKey),
  };
  letterKey.fill(0);
  return result;
}

export type OpenResult =
  | { readonly ok: true; readonly text: string; readonly sentAt: number }
  | { readonly ok: false; readonly reason: string };

/**
 * Opens a letter. `server` is what the server claims (metadata); `ownUserId` and the
 * sender's signing key come from the local account and the contact vault (SPEC 5.8).
 */
export async function openLetter(input: {
  readonly server: Pick<LetterMeta, 'letterId' | 'senderId' | 'recipientId' | 'kind' | 'parchment'>;
  readonly role: LetterRole;
  readonly ownUserId: string;
  readonly ownX25519Secret: Uint8Array;
  readonly ownX25519Public: Uint8Array;
  /** All keys ever bound to the sender in the vault; old letters stay verifiable (SPEC 5.7). */
  readonly senderEd25519Publics: readonly Uint8Array[];
  readonly ciphertext: Uint8Array;
  readonly wrap: Uint8Array;
}): Promise<OpenResult> {
  const s = await sodium();
  const fail = (reason: string): OpenResult => ({ ok: false, reason });
  const { server } = input;
  const blockBytes = storedPaddedBytes(server.parchment, input.ciphertext.length);
  if (blockBytes === null) return fail('length');
  if (input.role === 'recipient' && server.recipientId !== input.ownUserId)
    return fail('not_for_me');
  if (input.role === 'sender' && server.senderId !== input.ownUserId) return fail('not_mine');
  let letterKey: Uint8Array;
  try {
    letterKey = await unwrapKey(
      input.ownX25519Secret,
      input.ownX25519Public,
      keyInfo(server.letterId, input.role),
      input.wrap,
    );
  } catch {
    return fail('key');
  }
  let padded: Uint8Array;
  try {
    padded = s.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      input.ciphertext.subarray(NONCE_BYTES),
      associatedData(server),
      input.ciphertext.subarray(0, NONCE_BYTES),
      letterKey,
    );
  } catch {
    return fail('decrypt');
  } finally {
    letterKey.fill(0);
  }
  try {
    const plain = s.unpad(padded, blockBytes);
    const { fields, rest } = decodeFields(plain, FIELD_COUNT);
    if (rest.length !== SIGNATURE_BYTES) return fail('format');
    const content = plain.subarray(0, plain.length - SIGNATURE_BYTES);
    const signed = encodeFields(CONTEXTS.LETTER_SIG, content);
    if (
      !input.senderEd25519Publics.some((key) => s.crypto_sign_verify_detached(rest, signed, key))
    ) {
      return fail('signature');
    }
    const [context, format, letterId, senderId, recipientId, sentAt, kind, parchment, text] =
      fields.map((f, i) => (i === 1 || i === 5 ? fieldNumber(f) : fieldText(f)));
    if (context !== CONTEXTS.LETTER || format !== LETTER_FORMAT) return fail('format');
    // The signed content must match what the server says (no forwarding, no relabelling).
    if (
      letterId !== server.letterId ||
      senderId !== server.senderId ||
      kind !== server.kind ||
      parchment !== server.parchment
    ) {
      return fail('metadata');
    }
    if (recipientId !== server.recipientId) return fail('not_for_me');
    if (input.role === 'recipient' && recipientId !== input.ownUserId) return fail('not_for_me');
    const clean = sanitizeLetterText(String(text)).text;
    if (countCodePoints(clean) > maxChars(server.parchment)) return fail('too_long');
    return { ok: true, text: clean, sentAt: Number(sentAt) };
  } catch {
    return fail('format');
  }
}
