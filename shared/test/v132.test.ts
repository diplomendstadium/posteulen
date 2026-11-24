/**
 * Version 1.3.2 (pure rules): badges after owl names (SPEC 9.2.1), the window of long
 * conversations (8.4), the automatic focus only without a touchscreen (8.1) and the new names
 * of the Northern Hawk Owl's treat.
 */
import { describe, expect, it } from 'vitest';
import { BADGES, CHAT } from '../src/constants.ts';
import { hasBadge, owlBadge, owlDisplayName } from '../src/game/badges.ts';
import { windowStart } from '../src/chat-window.ts';
import { autofocus, hasTouchscreen } from '../src/autofocus.ts';
import { speciesDescription, speciesSnack } from '../src/texts/species.ts';
import { de } from '../src/texts/de.ts';
import { en } from '../src/texts/en.ts';

describe('badges (SPEC 9.2.1)', () => {
  it('globe, moon and crown by kilometres, the highest replaces the lower ones', () => {
    expect(BADGES.moon.KM).toBe(384_400);
    expect(BADGES.crown.KM).toBe(1_000_000);
    expect(owlBadge(0)).toBeNull();
    expect(owlBadge(40_031)).toBe('globe');
    expect(owlBadge(384_399.9)).toBe('globe');
    expect(owlBadge(384_400)).toBe('moon');
    expect(owlBadge(999_999)).toBe('moon');
    expect(owlBadge(1_000_000)).toBe('crown');
    expect(hasBadge(1_000_000, 'globe')).toBe(true);
    expect(owlDisplayName('Momo', 'moon')).toBe('Momo 🌙');
    expect(owlDisplayName('Momo', 'crown')).toBe('Momo 👑');
    expect(owlDisplayName('Momo', undefined)).toBe('Momo');
  });

  it('the festive messages name the owl, the kilometres and the new symbol', () => {
    for (const texts of [de, en]) {
      expect(texts.system.owl_moon).toContain('{owl} 🌙');
      expect(texts.system.owl_crown).toContain('{owl} 👑');
      expect(texts.system.owl_moon).toContain('{km}');
    }
    expect(de.system.owl_moon).toContain('von der Erde bis zum Mond');
    expect(de.system.owl_crown).toContain(
      'Selbst die alten Eulen im Postamt rücken jetzt auf der Stange ehrfürchtig zur Seite, wenn {owl} landet.',
    );
  });
});

describe('long conversations (SPEC 8.4)', () => {
  it('fewer than 30: everything, otherwise the latest 25 and everything not seen yet', () => {
    expect(CHAT).toEqual({ WINDOW_FROM: 30, RECENT: 25 });
    expect(windowStart(29, null)).toBe(0);
    expect(windowStart(30, null)).toBe(5);
    expect(windowStart(100, null)).toBe(75);
    expect(windowStart(100, 80)).toBe(75);
    expect(windowStart(100, 10)).toBe(10);
    expect(windowStart(100, null, true)).toBe(0);
  });
});

describe('automatic focus (SPEC 8.1)', () => {
  const view = (coarse: boolean) => ({ matchMedia: () => ({ matches: coarse }) });
  it('only on devices without a touchscreen', () => {
    let focused = 0;
    const field = { focus: () => (focused += 1) };
    autofocus(field, view(true));
    expect(focused).toBe(0);
    autofocus(field, view(false));
    expect(focused).toBe(1);
    expect(hasTouchscreen(undefined)).toBe(true);
  });
});

describe('the Northern Hawk Owl likes frosted cranberries', () => {
  it('in both languages, also in the description of the menagerie', () => {
    expect(speciesSnack('sperbereule', 'de')).toBe('Moosbeeren');
    expect(speciesSnack('sperbereule', 'en')).toBe('frosted cranberries');
    expect(speciesSnack('sumpfohreule', 'de')).toBe('Cranberrys');
    expect(speciesDescription('sperbereule', 'de')).toContain('Moosbeeren');
    expect(speciesDescription('sperbereule', 'en')).toContain('frosted cranberries');
    expect(speciesDescription('sperbereule', 'de')).not.toMatch(/Wachtel/);
  });
});
