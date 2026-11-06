/** Writing and reading letters in the browser (SPEC 5.8, 8.4). */
import { sanitizeLetterText, type Parchment } from '@posteulen/shared/text-rules.ts';
import { api, ApiError } from './api.ts';
import { account } from './auth.svelte.ts';
import { keysMatch, vault } from './vault.svelte.ts';

export interface ApiLetter {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly kind: 'letter' | 'cover_gold' | 'cover_owl' | 'cover_chick';
  readonly parchment: Parchment;
  readonly sentAt: number;
  readonly arrivesAt: number;
  readonly status: 'in_flight' | 'delivered' | 'returned';
  readonly read: boolean;
  readonly arrivalSeen: boolean;
  readonly owl: { readonly name: string; readonly species: string };
  /** Cover letter to gold: the amount in tenths. */
  readonly coverGold?: number;
  readonly role: 'sender' | 'recipient';
  readonly ciphertext: string | null;
  readonly wrap: string | null;
  /** Letters to and from bots are plain text (SPEC 10.1). */
  readonly plaintext: string | null;
}

export interface ShownLetter extends ApiLetter {
  readonly text: string | null;
}

export interface PreparedLetters {
  readonly token: string;
  readonly letters: readonly { recipientId: string; letterId: string; sentAt: number }[];
  readonly keys: readonly { userId: string; ed25519: string; x25519: string }[];
}

export interface Prepared extends PreparedLetters {
  readonly cost: number;
}

export interface SealedItem {
  readonly letterId: string;
  readonly ciphertext: string;
  readonly wrapRecipient: string;
  readonly wrapSender: string;
}

export class KeyMismatchError extends Error {}

export function prepare(
  recipients: readonly string[],
  parchment: Parchment,
  owlId: string,
): Promise<Prepared> {
  return api<Prepared>('POST', '/api/letters/prepare', { recipients, parchment, owlId });
}

/**
 * Seals one letter per prepared recipient (SPEC 5.8). The server's public keys must match
 * the contact vault, otherwise nothing is sent (SPEC 5.7).
 */
export async function sealFor(
  prepared: PreparedLetters,
  kind: ApiLetter['kind'],
  parchment: Parchment,
  text: string,
): Promise<SealedItem[]> {
  const own = account.keys;
  const me = account.profile?.id;
  if (!own || !me) throw new ApiError(401, { code: 'unauthorized' });
  for (const key of prepared.keys) {
    if (!(await keysMatch(key.userId, key))) throw new KeyMismatchError(key.userId);
  }
  const [{ sealLetter }, { fromBase64Url, toBase64Url }] = await Promise.all([
    import('@posteulen/shared/crypto/letter.ts'),
    import('@posteulen/shared/crypto/encoding.ts'),
  ]);
  const items: SealedItem[] = [];
  for (const letter of prepared.letters) {
    const recipientKey = prepared.keys.find((key) => key.userId === letter.recipientId);
    if (!recipientKey) throw new Error('missing key');
    const sealed = await sealLetter(
      {
        letterId: letter.letterId,
        senderId: me,
        recipientId: letter.recipientId,
        sentAt: letter.sentAt,
        kind,
        parchment,
      },
      text,
      {
        senderEd25519Secret: own.ed25519Secret,
        senderX25519Public: own.x25519Public,
        recipientX25519Public: fromBase64Url(recipientKey.x25519),
      },
    );
    items.push({
      letterId: letter.letterId,
      ciphertext: toBase64Url(sealed.ciphertext),
      wrapRecipient: toBase64Url(sealed.wrapRecipient),
      wrapSender: toBase64Url(sealed.wrapSender),
    });
  }
  return items;
}

export interface SendResult {
  readonly owl: { readonly name: string; readonly species: string };
  readonly letters: readonly { id: string; recipientId: string; arrivesAt: number }[];
  readonly returnsAt: number | null;
}

/** Seals one letter per recipient and sends them in one request. */
export async function sendPrepared(
  prepared: Prepared,
  parchment: Parchment,
  text: string,
): Promise<SendResult> {
  const items = await sealFor(prepared, 'letter', parchment, text);
  return api<SendResult>('POST', '/api/letters/send', { token: prepared.token, items });
}

/** Loads and verifies a conversation; invalid letters show no content (SPEC 5.8). */
export async function loadConversation(peerId: string): Promise<ShownLetter[]> {
  const own = account.keys;
  const me = account.profile?.id;
  if (!own || !me) return [];
  const [{ openLetter }, { fromBase64Url }] = await Promise.all([
    import('@posteulen/shared/crypto/letter.ts'),
    import('@posteulen/shared/crypto/encoding.ts'),
  ]);
  const { letters } = await api<{ letters: ApiLetter[] }>('GET', `/api/chats/${peerId}/letters`);
  const peerKeys = (vault.entries[peerId]?.entry.keySets ?? []).map((set) =>
    fromBase64Url(set.ed25519),
  );
  return Promise.all(
    letters.map(async (letter): Promise<ShownLetter> => {
      // Bot letters are plain text; the same text rules apply on display (SPEC 10.5).
      if (letter.plaintext !== null) {
        return { ...letter, text: sanitizeLetterText(letter.plaintext).text };
      }
      if (!letter.ciphertext || !letter.wrap) return { ...letter, text: null };
      const signers = letter.role === 'sender' ? [own.ed25519Public] : peerKeys;
      const opened = await openLetter({
        server: {
          letterId: letter.id,
          senderId: letter.senderId,
          recipientId: letter.recipientId,
          kind: letter.kind,
          parchment: letter.parchment,
        },
        role: letter.role,
        ownUserId: me,
        ownX25519Secret: own.x25519Secret,
        ownX25519Public: own.x25519Public,
        senderEd25519Publics: signers,
        ciphertext: fromBase64Url(letter.ciphertext),
        wrap: fromBase64Url(letter.wrap),
      });
      return { ...letter, text: opened.ok ? opened.text : null };
    }),
  );
}

/** A plain-text letter to one's own bot (SPEC 10.1). */
export function sendToBot(
  botId: string,
  owlId: string,
  parchment: Parchment,
  text: string,
): Promise<SendResult> {
  return api<SendResult>('POST', '/api/bot-letters/send', { botId, owlId, parchment, text });
}
