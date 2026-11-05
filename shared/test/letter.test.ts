import { beforeAll, describe, expect, it } from 'vitest';
import { generateIdentity, type IdentityKeys } from '../src/crypto/keypackage.ts';
import {
  ciphertextBytes,
  openLetter,
  sealLetter,
  sealUnchecked,
  type LetterMeta,
} from '../src/crypto/letter.ts';
import { toBase64Url } from '../src/crypto/encoding.ts';
import { bindKeys, openVaultEntry, safetyNumber, sealVaultEntry } from '../src/crypto/vault.ts';
import { letterTextError, sanitizeLetterText } from '../src/text-rules.ts';

let alice: IdentityKeys;
let bob: IdentityKeys;
let carol: IdentityKeys;
const A = 'AAAAAAAAAAAAAAAAAAAAAA';
const B = 'BBBBBBBBBBBBBBBBBBBBBB';
const C = 'CCCCCCCCCCCCCCCCCCCCCC';

beforeAll(async () => {
  [alice, bob, carol] = await Promise.all([
    generateIdentity(),
    generateIdentity(),
    generateIdentity(),
  ]);
});

const meta = (over: Partial<LetterMeta> = {}): LetterMeta => ({
  letterId: 'LLLLLLLLLLLLLLLLLLLLLL',
  senderId: A,
  recipientId: B,
  sentAt: 1_793_880_000_000,
  kind: 'letter',
  parchment: 'small',
  ...over,
});

async function seal(m: LetterMeta, text: string, to: IdentityKeys = bob) {
  return sealLetter(m, text, {
    senderEd25519Secret: alice.ed25519Secret,
    senderX25519Public: alice.x25519Public,
    recipientX25519Public: to.x25519Public,
  });
}

function openAsBob(
  m: Pick<LetterMeta, 'letterId' | 'senderId' | 'recipientId' | 'kind' | 'parchment'>,
  ciphertext: Uint8Array,
  wrap: Uint8Array,
  signer = alice,
) {
  return openLetter({
    server: m,
    role: 'recipient',
    ownUserId: B,
    ownX25519Secret: bob.x25519Secret,
    ownX25519Public: bob.x25519Public,
    senderEd25519Publics: [signer.ed25519Public],
    ciphertext,
    wrap,
  });
}

describe('letters (SPEC 5.8, 17.1)', () => {
  it('can be read by recipient and sender, with exact padded lengths', async () => {
    for (const parchment of ['small', 'large'] as const) {
      const m = meta({ parchment });
      const sealed = await seal(m, 'Hallo Bob!\nGrüße 0123 #* ©®™ https://example.org');
      expect(sealed.ciphertext).toHaveLength(ciphertextBytes(parchment));
      expect(ciphertextBytes(parchment)).toBe(parchment === 'small' ? 4136 : 16424);
      expect(await openAsBob(m, sealed.ciphertext, sealed.wrapRecipient)).toEqual({
        ok: true,
        text: 'Hallo Bob!\nGrüße 0123 #* ©®™ https://example.org',
        sentAt: m.sentAt,
      });
      const own = await openLetter({
        server: m,
        role: 'sender',
        ownUserId: A,
        ownX25519Secret: alice.x25519Secret,
        ownX25519Public: alice.x25519Public,
        senderEd25519Publics: [alice.ed25519Public],
        ciphertext: sealed.ciphertext,
        wrap: sealed.wrapSender,
      });
      expect(own.ok).toBe(true);
    }
  });

  it('fits the maximum text into the padding (4-byte characters)', async () => {
    const small = '𝔄'.repeat(500);
    const large = '𝔄'.repeat(3000);
    const sealedSmall = await seal(meta(), small);
    expect((await openAsBob(meta(), sealedSmall.ciphertext, sealedSmall.wrapRecipient)).ok).toBe(
      true,
    );
    const sealedLarge = await seal(meta({ parchment: 'large' }), large);
    expect(
      (
        await openAsBob(
          meta({ parchment: 'large' }),
          sealedLarge.ciphertext,
          sealedLarge.wrapRecipient,
        )
      ).ok,
    ).toBe(true);
    await expect(seal(meta(), 'a'.repeat(501))).rejects.toThrow('too long');
  });

  it('detects tampering with ciphertext, associated data and metadata', async () => {
    const m = meta();
    const sealed = await seal(m, 'geheim');
    const flipped = sealed.ciphertext.slice();
    flipped[100]! ^= 1;
    expect(await openAsBob(m, flipped, sealed.wrapRecipient)).toEqual({
      ok: false,
      reason: 'decrypt',
    });
    expect(
      (
        await openAsBob(
          { ...m, letterId: 'XXXXXXXXXXXXXXXXXXXXXX' },
          sealed.ciphertext,
          sealed.wrapRecipient,
        )
      ).ok,
    ).toBe(false);
    expect(
      (await openAsBob({ ...m, senderId: C }, sealed.ciphertext, sealed.wrapRecipient)).ok,
    ).toBe(false);
    expect(
      await openAsBob({ ...m, parchment: 'large' }, sealed.ciphertext, sealed.wrapRecipient),
    ).toEqual({ ok: false, reason: 'length' });
    const wrongWrap = sealed.wrapRecipient.slice();
    wrongWrap[40]! ^= 1;
    expect(await openAsBob(m, sealed.ciphertext, wrongWrap)).toEqual({ ok: false, reason: 'key' });
    expect(await openAsBob(m, sealed.ciphertext, sealed.wrapRecipient, carol)).toEqual({
      ok: false,
      reason: 'signature',
    });
  });

  it('detects a swapped letter kind (cover letter shown as plain letter and back)', async () => {
    const cover = meta({ kind: 'cover_gold' });
    const sealed = await seal(cover, 'zum Gold');
    expect(
      (await openAsBob({ ...cover, kind: 'letter' }, sealed.ciphertext, sealed.wrapRecipient)).ok,
    ).toBe(false);
    const plain = await seal(meta(), 'normal');
    expect(
      (await openAsBob({ ...meta(), kind: 'cover_owl' }, plain.ciphertext, plain.wrapRecipient)).ok,
    ).toBe(false);
    await expect(seal(meta({ kind: 'cover_owl', parchment: 'large' }), 'x')).rejects.toThrow(
      'small',
    );
  });

  it('recognises a letter forwarded to a third person as not addressed to them', async () => {
    const m = meta();
    const sealed = await seal(m, 'nur für Bob');
    // Bob would need his own letter key re-wrapped for Carol; even then the signed recipient is Bob.
    const forwarded = await sealUnchecked(m, 'nur für Bob', {
      senderEd25519Secret: alice.ed25519Secret,
      senderX25519Public: alice.x25519Public,
      recipientX25519Public: carol.x25519Public,
    });
    const asCarol = await openLetter({
      server: { ...m, recipientId: C },
      role: 'recipient',
      ownUserId: C,
      ownX25519Secret: carol.x25519Secret,
      ownX25519Public: carol.x25519Public,
      senderEd25519Publics: [alice.ed25519Public],
      ciphertext: forwarded.ciphertext,
      wrap: forwarded.wrapRecipient,
    });
    expect(asCarol.ok).toBe(false);
    const asCarolClaimingBob = await openLetter({
      server: m,
      role: 'recipient',
      ownUserId: C,
      ownX25519Secret: carol.x25519Secret,
      ownX25519Public: carol.x25519Public,
      senderEd25519Publics: [alice.ed25519Public],
      ciphertext: sealed.ciphertext,
      wrap: sealed.wrapRecipient,
    });
    expect(asCarolClaimingBob).toEqual({ ok: false, reason: 'not_for_me' });
  });

  it('re-applies the text rules on receipt (manipulated client)', async () => {
    const m = meta();
    const sealed = await sealUnchecked(m, 'Hallo ‮txt.exe 🦉', {
      senderEd25519Secret: alice.ed25519Secret,
      senderX25519Public: alice.x25519Public,
      recipientX25519Public: bob.x25519Public,
    });
    expect(await openAsBob(m, sealed.ciphertext, sealed.wrapRecipient)).toMatchObject({
      ok: true,
      text: 'Hallo txt.exe ',
    });
    const tooLong = await sealUnchecked(m, 'a'.repeat(600), {
      senderEd25519Secret: alice.ed25519Secret,
      senderX25519Public: alice.x25519Public,
      recipientX25519Public: bob.x25519Public,
    });
    expect(await openAsBob(m, tooLong.ciphertext, tooLong.wrapRecipient)).toEqual({
      ok: false,
      reason: 'too_long',
    });
  });
});

describe('text rules (SPEC 5.9)', () => {
  it('removes emojis, control and direction characters but keeps digits, #, *, ©, ®, ™', () => {
    const result = sanitizeLetterText('Hi 👋🏽 🇩🇪 1️⃣ ❤️ © ® ™ 0-9 # * ​‏‪⁦\u0007 ok\r\nZeile');
    expect(result.text).toBe('Hi   1  © ® ™ 0-9 # *  ok\nZeile');
    expect(result.removedEmoji).toBe(true);
    expect(result.removedOther).toBe(true);
    expect(sanitizeLetterText('Ganz normal: äöü ß 12345').removedEmoji).toBe(false);
  });

  it('validates text length per parchment in code points', () => {
    expect(letterTextError('a'.repeat(500), 'small')).toBeNull();
    expect(letterTextError('a'.repeat(501), 'small')).toBe('too_long');
    expect(letterTextError('a'.repeat(3000), 'large')).toBeNull();
    expect(letterTextError('   ', 'small')).toBe('empty');
    expect(letterTextError('a​b', 'small')).toBe('invalid');
  });
});

describe('contact vault and safety number (SPEC 5.7, 17.1)', () => {
  const keysOf = (k: IdentityKeys) => ({
    ed25519: toBase64Url(k.ed25519Public),
    x25519: toBase64Url(k.x25519Public),
  });
  const vaultKey = new Uint8Array(32).fill(9);

  it('detects swapped or foreign entries', async () => {
    const { entry } = bindKeys(null, B, keysOf(bob), 1);
    const blob = await sealVaultEntry(vaultKey, A, 1, entry);
    expect(await openVaultEntry(vaultKey, A, B, 1, blob)).toEqual(entry);
    await expect(openVaultEntry(vaultKey, A, C, 1, blob)).rejects.toThrow();
    await expect(openVaultEntry(vaultKey, C, B, 1, blob)).rejects.toThrow();
    await expect(openVaultEntry(vaultKey, A, B, 2, blob)).rejects.toThrow();
    await expect(openVaultEntry(new Uint8Array(32), A, B, 1, blob)).rejects.toThrow();
  });

  it('keeps "compared" for unchanged keys on re-coupling and resets it for new ones', () => {
    const first = bindKeys(null, B, keysOf(bob), 1);
    const compared = { ...first.entry, compared: true, separated: true };
    const same = bindKeys(compared, B, keysOf(bob), 2);
    expect(same).toEqual({ entry: { ...compared, separated: false }, changed: false });
    const other = bindKeys(compared, B, keysOf(carol), 3);
    expect(other.changed).toBe(true);
    expect(other.entry.compared).toBe(false);
    expect(other.entry.keySets).toHaveLength(2);
  });

  it('gives both sides the same 60-digit number', async () => {
    const ab = await safetyNumber({ userId: A, ...keysOf(alice) }, { userId: B, ...keysOf(bob) });
    const ba = await safetyNumber({ userId: B, ...keysOf(bob) }, { userId: A, ...keysOf(alice) });
    expect(ab).toBe(ba);
    expect(ab).toMatch(/^(\d{5} ){11}\d{5}$/);
    expect(
      await safetyNumber({ userId: A, ...keysOf(alice) }, { userId: B, ...keysOf(carol) }),
    ).not.toBe(ab);
  });

  it('verifies old letters with old keys after a key change', async () => {
    const m = meta();
    const sealed = await seal(m, 'vor dem Wechsel');
    const opened = await openLetter({
      server: m,
      role: 'recipient',
      ownUserId: B,
      ownX25519Secret: bob.x25519Secret,
      ownX25519Public: bob.x25519Public,
      senderEd25519Publics: [carol.ed25519Public, alice.ed25519Public],
      ciphertext: sealed.ciphertext,
      wrap: sealed.wrapRecipient,
    });
    expect(opened.ok).toBe(true);
  });
});
