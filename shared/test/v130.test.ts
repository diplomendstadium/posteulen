/**
 * Version 1.3.0: order of the owl overview, the rescue centre, the rule on giving gold and owls,
 * the 🌍 badge and the season of the rescue centre pictures.
 */
import { describe, expect, it } from 'vitest';
import { BADGES, GIFTS, RESCUE } from '../src/constants.ts';
import { giftBlock, giftWindow } from '../src/game/gifts.ts';
import { owlBadge, owlDisplayName } from '../src/game/badges.ts';
import { overviewOrder, canCare, regenerates, type OverviewOwl } from '../src/game/owls.ts';
import {
  ownCareNeeded,
  pickWildSpecies,
  rescueActionAllowed,
  rescueActionCounts,
  rescueProgress,
  wildCareNeeded,
  wildOwlStays,
  wildSpecies,
} from '../src/game/rescue.ts';
import { rescueSeason, rescueSeasonOfDate } from '../src/game/season.ts';
import { imageKindsOf, SCENE_IMAGES, SPECIES } from '../src/species.ts';

describe('order of the owl overview (SPEC 8.5)', () => {
  const owl = (name: string, values: Partial<OverviewOwl> = {}): OverviewOwl => ({
    name,
    ready: true,
    ownedSince: '2026-01-01',
    createdAt: 0,
    awaySince: null,
    ...values,
  });
  const names = (list: readonly OverviewOwl[]) => list.map((entry) => entry.name);
  const compare = (a: string, b: string) => a.localeCompare(b, 'de');

  it('ready owls: the one the player has had longest first', () => {
    const { ready, busy } = overviewOrder(
      [
        owl('Neu', { ownedSince: '2026-11-20', createdAt: 5 }),
        owl('Alt', { ownedSince: '2025-03-01', createdAt: 900 }),
        owl('Mitte später', { ownedSince: '2026-06-01', createdAt: 20 }),
        owl('Mitte früher', { ownedSince: '2026-06-01', createdAt: 10 }),
        owl('Gleich B', { ownedSince: '2026-07-01', createdAt: 1 }),
        owl('Gleich A', { ownedSince: '2026-07-01', createdAt: 1 }),
      ],
      compare,
    );
    expect(names(ready)).toEqual([
      'Alt',
      'Mitte früher',
      'Mitte später',
      'Gleich A',
      'Gleich B',
      'Neu',
    ]);
    expect(busy).toEqual([]);
  });

  it('out and about: away longest first, unknown last', () => {
    const { ready, busy } = overviewOrder(
      [
        owl('Flieger', { ready: false, awaySince: 5000 }),
        owl('Station', { ready: false, awaySince: 3000 }),
        owl('Küken', { ready: false, awaySince: 9000 }),
        owl('Rätsel', { ready: false }),
        owl('Anderes Rätsel', { ready: false }),
        owl('Daheim'),
      ],
      compare,
    );
    expect(names(ready)).toEqual(['Daheim']);
    expect(names(busy)).toEqual(['Station', 'Flieger', 'Küken', 'Anderes Rätsel', 'Rätsel']);
  });
});

describe('rescue centre (SPEC 8.13, 9.8)', () => {
  it('own owls need 6–25 interactions, equally likely (v1.3.1)', () => {
    expect(ownCareNeeded(0)).toBe(6);
    expect(ownCareNeeded(0.9999999)).toBe(25);
    const seen = new Set(Array.from({ length: 20 }, (_, i) => ownCareNeeded((i + 0.5) / 20)));
    expect(seen.size).toBe(20);
  });

  it('wild owls need price × 4 × 0.7–1.3 (v1.3.1)', () => {
    expect(wildCareNeeded(10, 0)).toBe(28);
    expect(wildCareNeeded(10, 1)).toBe(52);
    expect(wildCareNeeded(10, 0.5)).toBe(40);
    expect(wildCareNeeded(6, 0.25)).toBe(20);
    expect(wildCareNeeded(0, 0)).toBe(1);
  });

  it('never the phoenix or the Great Horned Owl as a wild owl', () => {
    const ids = wildSpecies().map((species) => species.id);
    expect(ids).not.toContain('phoenix');
    expect(ids).not.toContain('virginiauhu');
    expect(ids).toHaveLength(SPECIES.length - 2);
    expect(pickWildSpecies(0).id).toBe(ids[0]);
    expect(pickWildSpecies(0.9999999).id).toBe(ids.at(-1));
    // v1.4.3: two wild owls per account.
    expect(RESCUE.WILD_SLOTS).toBe(2);
  });

  it('progress in whole per cent, 100 only when done', () => {
    expect(rescueProgress(0, 7)).toBe(0);
    expect(rescueProgress(1, 7)).toBe(14);
    expect(rescueProgress(6, 7)).toBe(85);
    expect(rescueProgress(199, 200)).toBe(99);
    expect(rescueProgress(7, 7)).toBe(100);
    expect(rescueProgress(0, 0)).toBe(100);
  });

  it('each interaction once a day, petting as often as one likes; each counts once a day', () => {
    const today = '2026-11-20';
    for (const action of ['medicine', 'feed', 'snack', 'water'] as const) {
      expect(rescueActionAllowed(action, null, today)).toBe(true);
      expect(rescueActionAllowed(action, '2026-11-19', today)).toBe(true);
      expect(rescueActionAllowed(action, today, today)).toBe(false);
    }
    expect(rescueActionAllowed('pet', today, today)).toBe(true);
    expect(rescueActionCounts(today, today)).toBe(false);
    expect(rescueActionCounts('2026-11-19', today)).toBe(true);
  });

  it('a healed wild owl stays half of the time', () => {
    expect(wildOwlStays(0.49)).toBe(true);
    expect(wildOwlStays(0.5)).toBe(false);
  });

  it('sick owls are cared for in the rescue centre only, and still recover energy', () => {
    expect(canCare({ state: 'sick', kind: 'own', isChick: false })).toBe(false);
    expect(canCare({ state: 'home', kind: 'own', isChick: false })).toBe(true);
    expect(regenerates('sick')).toBe(true);
  });

  it('has the pictures of the rescue centre (the phoenix has none, it never falls ill)', () => {
    const kinds = (id: string) =>
      imageKindsOf(SPECIES.find((species) => species.id === id)!).map((kind) => kind.kind);
    expect(kinds('waldkauz')).toEqual(
      expect.arrayContaining(['sick', 'sickNight', 'medicine', 'healthy']),
    );
    expect(kinds('phoenix')).not.toContain('sick');
    const files = SCENE_IMAGES.map((scene) => scene.file);
    expect(files).toContain('Rettungsstation-Vorfruehling-Tag.png');
    expect(files).toContain('Rettungsstation-Innen-Weihnachten-Nacht.png');
  });
});

describe('season of the rescue centre pictures (SPEC 9.11)', () => {
  const at = (month: number, day: number) => rescueSeasonOfDate({ year: 2027, month, day });
  it('early spring from 15 February to 15 March, otherwise as the desk', () => {
    expect(at(2, 14)).toBe('winter');
    expect(at(2, 15)).toBe('earlySpring');
    expect(at(3, 15)).toBe('earlySpring');
    expect(at(3, 16)).toBe('spring');
    expect(at(7, 1)).toBe('summer');
    expect(at(12, 24)).toBe('christmas');
    expect(rescueSeason(Date.UTC(2027, 1, 20, 12), 52.5, 13.4)).toBe('earlySpring');
  });
});

describe('giving gold and owls (SPEC 9.1.5)', () => {
  const today = '2026-11-20';
  const window = giftWindow(today);
  const day = (
    index: number,
    values: { active?: boolean; sent?: boolean; received?: boolean },
  ) => ({
    day: window[index]!,
    active: values.active ?? false,
    sentHuman: values.sent ?? false,
    receivedHuman: values.received ?? false,
  });
  /** 7 active days, 4 with letters to and 4 with letters from people. */
  const enough = [
    ...[0, 2, 4, 6, 8, 10, 12].map((index) =>
      day(index, { active: true, sent: index < 7, received: index >= 6 }),
    ),
  ];

  it('looks at the 14 days ending today', () => {
    expect(window).toHaveLength(GIFTS.WINDOW_DAYS);
    expect(window[0]).toBe('2026-11-07');
    expect(window.at(-1)).toBe(today);
  });

  it('allows a gift for an active player who writes and gets letters', () => {
    expect(giftBlock({ today, lastGiftDay: null, days: enough })).toBeNull();
    expect(giftBlock({ today, lastGiftDay: '2026-11-06', days: enough })).toBeNull();
  });

  it('one gift of gold or an owl in 14 days', () => {
    expect(giftBlock({ today, lastGiftDay: '2026-11-07', days: enough })).toBe('recent_gift');
    expect(giftBlock({ today, lastGiftDay: today, days: enough })).toBe('recent_gift');
  });

  it('needs 7 active days, 4 days with letters from and 4 with letters to people', () => {
    expect(giftBlock({ today, lastGiftDay: null, days: enough.slice(1) })).toBe('inactive');
    const fewReceived = enough.map((entry) => ({
      ...entry,
      receivedHuman: entry.day === window[12],
    }));
    expect(giftBlock({ today, lastGiftDay: null, days: fewReceived })).toBe('few_received');
    const fewSent = enough.map((entry) => ({ ...entry, sentHuman: false, receivedHuman: true }));
    expect(giftBlock({ today, lastGiftDay: null, days: fewSent })).toBe('few_sent');
    // Days outside the window do not count.
    const old = enough.map((entry) => ({ ...entry, day: '2026-10-01' }));
    expect(giftBlock({ today, lastGiftDay: null, days: old })).toBe('inactive');
  });
});

describe('🌍 badge (SPEC 9.2.1)', () => {
  it('after more than the Earth’s circumference', () => {
    expect(BADGES.globe.KM).toBe(40_030);
    expect(owlBadge(40_030)).toBeNull();
    expect(owlBadge(40_030.5)).toBe('globe');
    expect(owlDisplayName('Waldi', 'globe')).toBe('Waldi 🌍');
    expect(owlDisplayName('Waldi', null)).toBe('Waldi');
  });
});

describe('monospaced letters for ASCII art (SPEC 8.4, 5.8)', async () => {
  const { generateIdentity } = await import('../src/crypto/keypackage.ts');
  const { openLetter, sealLetter } = await import('../src/crypto/letter.ts');
  const [a, b] = await Promise.all([generateIdentity(), generateIdentity()]);
  const meta = {
    letterId: 'l1',
    senderId: 'A',
    recipientId: 'B',
    sentAt: 1_800_000_000_000,
    kind: 'letter' as const,
    parchment: 'small' as const,
  };
  const art = ' /\\_/\\\n( o.o )\n > ^ <';
  const open = (sealed: { ciphertext: Uint8Array; wrapRecipient: Uint8Array }, signer = a) =>
    openLetter({
      server: meta,
      role: 'recipient',
      ownUserId: 'B',
      ownX25519Secret: b.x25519Secret,
      ownX25519Public: b.x25519Public,
      senderEd25519Publics: [signer.ed25519Public],
      ciphertext: sealed.ciphertext,
      wrap: sealed.wrapRecipient,
    });
  const keys = {
    senderEd25519Secret: a.ed25519Secret,
    senderX25519Public: a.x25519Public,
    recipientX25519Public: b.x25519Public,
  };

  it('keeps the font signed inside the letter, for both sides', async () => {
    const mono = await open(await sealLetter(meta, art, keys, 'mono'));
    expect(mono).toMatchObject({ ok: true, text: art, style: 'mono' });
    const hand = await open(await sealLetter(meta, 'Hallo', keys));
    expect(hand).toMatchObject({ ok: true, style: 'hand' });
  });

  it('a monospaced letter of a forged sender is still rejected', async () => {
    const forged = await open(await sealLetter(meta, art, keys, 'mono'), b);
    expect(forged.ok).toBe(false);
  });

  it('only real letters can be monospaced', async () => {
    await expect(sealLetter({ ...meta, kind: 'cover_gold' }, art, keys, 'mono')).rejects.toThrow();
  });
});
