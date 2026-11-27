/**
 * Version 1.4.2 (shared rules and texts): the second look of owls (SPEC 9.2.6), no boredom
 * without a contact to people (9.2.9), short picture descriptions (14) and the texts of a
 * Tor-only instance without notifications (16.6).
 */
import { describe, expect, it } from 'vitest';
import { idleCounts } from '../src/game/boredom.ts';
import { lookFor } from '../src/game/look.ts';
import { imageKindsOf, SPECIES } from '../src/species.ts';
import { de, type Texts } from '../src/texts/de.ts';
import { en } from '../src/texts/en.ts';
import { helpAsText, helpOf } from '../src/texts/help.ts';
import { TOR_ONLY_REPLACEMENTS, withoutNotifications } from '../src/texts/help-tor-only.ts';
import { legalOf } from '../src/texts/legal.ts';
import { botLetters, NOTIFICATION_SENTENCES } from '../src/texts/bots.ts';
import { ABOUT_DE, ABOUT_EN } from '../src/texts/about.ts';

describe('the second look (SPEC 9.2.6)', () => {
  it('takes the rarer look among the other owls of the species, the standard one on a tie', () => {
    expect(lookFor({ standard: 0, second: 0, mythical: false })).toBe(0);
    expect(lookFor({ standard: 1, second: 0, mythical: false })).toBe(1);
    expect(lookFor({ standard: 1, second: 1, mythical: false })).toBe(0);
    expect(lookFor({ standard: 2, second: 1, mythical: false })).toBe(1);
    expect(lookFor({ standard: 0, second: 1, mythical: false })).toBe(0);
    expect(lookFor({ standard: 3, second: 0, mythical: true })).toBe(0);
  });

  it('has second pictures by day and by night for every species but the phoenix', () => {
    for (const species of SPECIES) {
      const kinds = imageKindsOf(species).map((entry) => entry.kind);
      expect(kinds.includes('second')).toBe(!species.mythical);
      expect(kinds.includes('secondNight')).toBe(!species.mythical);
    }
  });
});

describe('boredom only after a contact to people (SPEC 9.2.9)', () => {
  it('does not count while the player knows nobody', () => {
    expect(idleCounts('home', false, false)).toBe(false);
    expect(idleCounts('flying', false, false)).toBe(false);
    expect(idleCounts('home', false, true)).toBe(true);
    expect(idleCounts('home', false)).toBe(true);
  });
});

describe('short picture descriptions (SPEC 14)', () => {
  /** Keys of picture descriptions: at most four words, a placeholder counts as one. */
  const pictureTexts = (texts: Texts): string[] => [
    texts.start.groupAlt,
    texts.start.groupAltNight,
    texts.start.groupAltChristmasDay,
    texts.start.groupAltChristmasNight,
    ...Object.entries(texts.letters)
      .filter(([key]) => key.startsWith('desk_'))
      .map(([, value]) => value as string),
    texts.letters.burnAlt,
    texts.system['letters_purged_alt'] as string,
    texts.bots.pictureAlt,
    ...Object.entries(texts.owls)
      .filter(([key]) => key.endsWith('Alt'))
      .map(([, value]) => value as string),
    texts.rescue.sickAlt,
    texts.rescue.pictureDay,
    texts.rescue.pictureNight,
    texts.rescue.insideDay,
    texts.rescue.insideNight,
    texts.menagerie.pictureDay,
    texts.menagerie.pictureNight,
    texts.menagerie.pictureChristmasDay,
    texts.menagerie.pictureChristmasNight,
    texts.menagerie.insideDay,
    texts.menagerie.insideNight,
    texts.menagerie.insideChristmasDay,
    texts.menagerie.insideChristmasNight,
    texts.post.pictureDay,
    texts.post.pictureNight,
    texts.post.pictureChristmasDay,
    texts.post.pictureChristmasNight,
    texts.post.insideDay,
    texts.post.insideNight,
    texts.post.insideChristmasDay,
    texts.post.insideChristmasNight,
    texts.images.placeholderAlt,
  ];

  it.each([
    ['de', de],
    ['en', en],
  ] as const)('keeps every description at four words or fewer (%s)', (_language, texts) => {
    const list = pictureTexts(texts);
    expect(list.length).toBeGreaterThan(40);
    for (const text of list) {
      const words = text
        .replace(/\{\w+\}/g, 'X')
        .split(/\s+/)
        .filter(Boolean);
      expect(words.length, text).toBeLessThanOrEqual(4);
    }
  });
});

describe('a Tor-only instance has no notifications (SPEC 16.6)', () => {
  it('finds the text of every replacement in the regular help', () => {
    const texts = [
      helpAsText('de'),
      helpAsText('en'),
      ...de.welcome.iosSteps,
      ...en.welcome.iosSteps,
      ABOUT_DE,
      ABOUT_EN,
    ];
    for (const [from] of TOR_ONLY_REPLACEMENTS) {
      expect(
        texts.some((text) => text.includes(from)),
        from,
      ).toBe(true);
    }
  });

  it.each(['de', 'en'] as const)(
    'leaves notifications and the normal address out (%s)',
    (language) => {
      const text = helpAsText(language, true);
      expect(text).not.toMatch(/benachrichtig|notification|push/i);
      expect(text).not.toMatch(/normale(n)? Adresse|normal address/);
      expect(helpOf(language, true).sections.map((section) => section.id)).not.toContain(
        'benachrichtigungen',
      );
      // Everything else stays.
      expect(helpOf(language, true).sections).toHaveLength(helpOf(language).sections.length - 1);
      expect(helpOf(language, true).faq).toHaveLength(helpOf(language).faq.length - 1);
    },
  );

  it('leaves the push services out of the privacy policy', () => {
    for (const language of ['de', 'en'] as const) {
      const privacy = JSON.stringify(legalOf(language, true).privacy);
      expect(privacy).not.toMatch(/push/i);
      expect(legalOf(language, true).privacy).toHaveLength(legalOf(language).privacy.length - 1);
      expect(JSON.stringify(legalOf(language).privacy)).toMatch(/push/i);
    }
  });

  it('writes the letters of the Erklärbär without notifications', () => {
    for (const language of ['de', 'en'] as const) {
      expect(JSON.stringify(botLetters(language).explainer)).toMatch(/benachrichtig|notification/i);
      expect(JSON.stringify(botLetters(language, true).explainer)).not.toMatch(
        /benachrichtig|notification/i,
      );
    }
    expect(NOTIFICATION_SENTENCES).toHaveLength(2);
  });

  it('leaves notifications out of the start page text', () => {
    expect(withoutNotifications(ABOUT_DE)).not.toMatch(/Benachrichtig/);
    expect(withoutNotifications(ABOUT_EN)).not.toMatch(/notification/);
  });

  it('drops the remark on notifications from the last step on the iPhone', () => {
    expect(withoutNotifications(de.welcome.iosSteps.at(-1)!)).not.toMatch(/Benachrichtig/);
    expect(withoutNotifications(en.welcome.iosSteps.at(-1)!)).not.toMatch(/notification/);
  });
});
