/** Writing and reading letters in the browser (SPEC 5.8, 8.4). */
import { sanitizeLetterText, type Parchment } from '@posteulen/shared/text-rules.ts';
import { api, ApiError } from './api.ts';
import { account } from './auth.svelte.ts';
import { assertCurrent, currentContext, type AccountContext } from './context.ts';
import { checkKeysOnDisplay, keysMatch, vault, whenVaultSynced } from './vault.svelte.ts';

export interface ApiLetter {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly kind: 'letter' | 'cover_gold' | 'cover_owl' | 'cover_chick';
  readonly parchment: Parchment;
  /** v1.1: written in the Christmas season at the sender's home – Christmas parchment. */
  readonly christmas?: boolean;
  readonly sentAt: number;
  readonly arrivesAt: number;
  readonly status: 'in_flight' | 'delivered' | 'returned';
  readonly read: boolean;
  /** v0.5: the recipient could not verify the letter. */
  readonly unreadable?: boolean;
  readonly arrivalSeen: boolean;
  readonly owl: {
    readonly name: string;
    readonly species: string;
    /** v0.7: whose owl carried it, seen from this account. */
    readonly carrier?: 'own' | 'loan' | 'foreign';
    /** v0.7: the holder of a visiting owl that carried my reply (null: not a contact). */
    readonly holderName?: string | null;
  };
  /** Cover letter to gold: the amount in tenths. */
  readonly coverGold?: number;
  readonly role: 'sender' | 'recipient';
  readonly ciphertext: string | null;
  readonly wrap: string | null;
  /** Letters to and from bots are plain text (SPEC 10.1). */
  readonly plaintext: string | null;
  /** v0.8: pictures of a control-centre bot (IDs for /api/bot-media/:id). */
  readonly media?: readonly string[];
}

export interface ShownLetter extends ApiLetter {
  readonly text: string | null;
  /** v0.8.2: why the letter cannot be shown (reported to the admin's error log). */
  readonly failure?: string;
}

export interface PreparedLetters {
  readonly token: string;
  readonly letters: readonly { recipientId: string; letterId: string; sentAt: number }[];
  readonly keys: readonly { userId: string; ed25519: string; x25519: string }[];
}

export type Prepared = PreparedLetters;

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
  /** v0.7: rest at each recipient (hours). */
  rest = 0,
): Promise<Prepared> {
  return api<Prepared>('POST', '/api/letters/prepare', {
    recipients,
    parchment,
    owlId,
    ...(rest > 0 ? { rest } : {}),
  });
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
  const context = currentContext();
  const own = account.keys;
  if (!context || !own || own.userId !== context.accountId) {
    throw new ApiError(401, { code: 'unauthorized' });
  }
  const me = context.accountId;
  for (const key of prepared.keys) {
    if (!(await keysMatch(key.userId, key, context))) throw new KeyMismatchError(key.userId);
  }
  const [{ sealLetter }, { fromBase64Url, toBase64Url }] = await Promise.all([
    import('@posteulen/shared/crypto/letter.ts'),
    import('@posteulen/shared/crypto/encoding.ts'),
  ]);
  assertCurrent(context);
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
    assertCurrent(context);
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
  const context = currentContext();
  const items = await sealFor(prepared, 'letter', parchment, text);
  return api<SendResult>(
    'POST',
    '/api/letters/send',
    { token: prepared.token, items },
    { context },
  );
}

/** v1.1: the letters of a chat and its Christmas parchment pair (1–4, both sides alike). */
export interface Conversation {
  readonly letters: ShownLetter[];
  readonly christmasPaper: number;
  /**
   * The contact's keys were still being loaded (vault not completely synchronised): letters
   * that could not be verified show a waiting state and are neither reported as unreadable nor
   * counted as read; the chat checks again once the vault is ready.
   */
  readonly keysPending: boolean;
}

/**
 * Loads and verifies a conversation; invalid letters show no content (SPEC 5.8). Bound to the
 * account context it started in: answers, decryption and checks of an earlier context are
 * dropped (StaleApiError / StaleContextError).
 */
export async function loadConversation(
  peerId: string,
  context: AccountContext | null = currentContext(),
): Promise<Conversation> {
  const own = account.keys;
  if (!context || !own || own.userId !== context.accountId) {
    return { letters: [], christmasPaper: 1, keysPending: true };
  }
  const me = context.accountId;
  const ownKeys = own;
  const [{ openLetter }, { fromBase64Url }] = await Promise.all([
    import('@posteulen/shared/crypto/letter.ts'),
    import('@posteulen/shared/crypto/encoding.ts'),
  ]);
  assertCurrent(context);
  const { letters, christmasPaper } = await api<{
    letters: ApiLetter[];
    christmasPaper?: number;
  }>('GET', `/api/chats/${peerId}/letters`, undefined, { context });
  // Received letters of a person need the bound keys: wait for the complete synchronisation
  // of the vault in this context (with a timeout – then the letters wait visibly).
  const needsKeys = letters.some(
    (letter) => letter.role === 'recipient' && letter.plaintext === null && letter.ciphertext,
  );
  const synced = needsKeys ? await whenVaultSynced(context) : vault.synced;
  assertCurrent(context);
  // SPEC 5.7: when showing received letters, the server's keys are compared with the vault.
  if (synced) void checkKeysOnDisplay(peerId, context);
  const peerKeys = (vault.entries[peerId]?.entry.keySets ?? []).map((set) =>
    fromBase64Url(set.ed25519),
  );
  const shown: ShownLetter[] = [];
  // One after the other with a context check each: decryption cannot be aborted.
  for (const letter of letters) {
    shown.push(await openOne(letter));
    assertCurrent(context);
  }
  return {
    letters: shown,
    christmasPaper: christmasPaper ?? 1,
    keysPending: needsKeys && !synced,
  };

  async function openOne(letter: ApiLetter): Promise<ShownLetter> {
    // v0.6.1: only letters between me and this peer belong here.
    const between =
      letter.role === 'sender'
        ? letter.senderId === me && letter.recipientId === peerId
        : letter.senderId === peerId && letter.recipientId === me;
    if (!between) return { ...letter, text: null, failure: 'foreign' };
    // Bot letters are plain text; the same text rules apply on display (SPEC 10.5).
    if (letter.plaintext !== null) {
      return { ...letter, text: sanitizeLetterText(letter.plaintext).text };
    }
    if (!letter.ciphertext || !letter.wrap) return { ...letter, text: null, failure: 'missing' };
    const signers = letter.role === 'sender' ? [ownKeys.ed25519Public] : peerKeys;
    if (letter.role === 'recipient' && signers.length === 0) {
      return { ...letter, text: null, failure: synced ? 'no_keys' : 'keys_pending' };
    }
    const opened = await openLetter({
      server: {
        letterId: letter.id,
        senderId: letter.senderId,
        recipientId: letter.recipientId,
        sentAt: letter.sentAt,
        kind: letter.kind,
        parchment: letter.parchment,
      },
      role: letter.role,
      ownUserId: me,
      ownX25519Secret: ownKeys.x25519Secret,
      ownX25519Public: ownKeys.x25519Public,
      senderEd25519Publics: signers,
      ciphertext: fromBase64Url(letter.ciphertext),
      wrap: fromBase64Url(letter.wrap),
    });
    if (opened.ok) return { ...letter, text: opened.text };
    return { ...letter, text: null, failure: opened.reason };
  }
}

export { reportableFailures } from './letter-reports.ts';

/** A plain-text letter to one's own bot (SPEC 10.1). */
export function sendToBot(
  botId: string,
  owlId: string,
  parchment: Parchment,
  text: string,
): Promise<SendResult> {
  return api<SendResult>('POST', '/api/bot-letters/send', { botId, owlId, parchment, text });
}
