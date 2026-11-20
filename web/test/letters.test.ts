/**
 * The iPad case (SPEC 5.5, 5.8): a valid letter of about 680 characters on long parchment
 * between two people stays readable for the right account, is never reported as unreadable while
 * keys are still loading, and a genuinely manipulated letter is still recognised.
 */
import { describe, expect, it } from 'vitest';
import { generateIdentity } from '@posteulen/shared/crypto/keypackage.ts';
import { openLetter, sealLetter } from '@posteulen/shared/crypto/letter.ts';
import { reportableFailures } from '../src/lib/letter-reports.ts';

const TEXT = (
  'Liebe Bea, heute Morgen saß eine Waldohreule auf dem Gartenzaun und schaute mich an, als ' +
  'wüsste sie schon, dass ich dir schreiben will. Der Herbst ist hier ganz golden, die Äpfel ' +
  'liegen im Gras und die Igel sind ständig unterwegs. '
)
  .repeat(4)
  .slice(0, 680);

async function people() {
  const [a, b, c] = await Promise.all([generateIdentity(), generateIdentity(), generateIdentity()]);
  return { a, b, c };
}

const meta = {
  letterId: 'letter-1',
  senderId: 'C',
  recipientId: 'B',
  sentAt: 1_700_000_000_000,
  kind: 'letter' as const,
  parchment: 'large' as const,
};

describe('680-character letter on long parchment', () => {
  it('is sealed and opened for the right recipient', async () => {
    expect([...TEXT]).toHaveLength(680);
    const { b, c } = await people();
    const sealed = await sealLetter(meta, TEXT, {
      senderEd25519Secret: c.ed25519Secret,
      senderX25519Public: c.x25519Public,
      recipientX25519Public: b.x25519Public,
    });
    const opened = await openLetter({
      server: meta,
      role: 'recipient',
      ownUserId: 'B',
      ownX25519Secret: b.x25519Secret,
      ownX25519Public: b.x25519Public,
      senderEd25519Publics: [c.ed25519Public],
      ciphertext: sealed.ciphertext,
      wrap: sealed.wrapRecipient,
    });
    expect(opened.ok && opened.text).toBe(TEXT);
  });

  it('cannot be opened with the keys of the previous account A (no mixing)', async () => {
    const { a, b, c } = await people();
    const sealed = await sealLetter(meta, TEXT, {
      senderEd25519Secret: c.ed25519Secret,
      senderX25519Public: c.x25519Public,
      recipientX25519Public: b.x25519Public,
    });
    const opened = await openLetter({
      server: meta,
      role: 'recipient',
      ownUserId: 'B',
      ownX25519Secret: a.x25519Secret,
      ownX25519Public: a.x25519Public,
      senderEd25519Publics: [c.ed25519Public],
      ciphertext: sealed.ciphertext,
      wrap: sealed.wrapRecipient,
    });
    expect(opened.ok).toBe(false);
  });

  it('a manipulated sender (wrong signing key) is still recognised', async () => {
    const { a, b, c } = await people();
    const sealed = await sealLetter(meta, TEXT, {
      senderEd25519Secret: a.ed25519Secret,
      senderX25519Public: a.x25519Public,
      recipientX25519Public: b.x25519Public,
    });
    const opened = await openLetter({
      server: meta,
      role: 'recipient',
      ownUserId: 'B',
      ownX25519Secret: b.x25519Secret,
      ownX25519Public: b.x25519Public,
      senderEd25519Publics: [c.ed25519Public],
      ciphertext: sealed.ciphertext,
      wrap: sealed.wrapRecipient,
    });
    expect(opened.ok).toBe(false);
  });
});

describe('reporting unreadable letters', () => {
  const unread = (failure?: string, text: string | null = null) => ({
    id: failure ?? 'ok',
    role: 'recipient' as const,
    status: 'delivered' as const,
    read: false,
    text,
    ...(failure ? { failure } : {}),
  });

  it('nothing is reported while the keys are still loading', () => {
    expect(
      reportableFailures({ letters: [unread('no_keys'), unread('signature')], keysPending: true }),
    ).toEqual(new Map());
    expect(reportableFailures({ letters: [unread('keys_pending')], keysPending: false })).toEqual(
      new Map(),
    );
  });

  it('letters of another account are never reported for this one', () => {
    expect(reportableFailures({ letters: [unread('foreign')], keysPending: false })).toEqual(
      new Map(),
    );
  });

  it('genuine failures with complete keys are reported, readable letters are not', () => {
    const result = reportableFailures({
      letters: [unread('signature'), unread(undefined, 'Hallo'), unread('no_keys')],
      keysPending: false,
    });
    expect(result).toEqual(
      new Map([
        ['signature', ['signature']],
        ['no_keys', ['no_keys']],
      ]),
    );
  });
});
