/**
 * Version 1.5.0 (shared rules and texts): the looks of chicks and their pictures (SPEC 9.2.6),
 * the milestones of letters between people (11.1) and the texts of both languages.
 */
import { describe, expect, it } from 'vitest';
import { asChickLook, chickLookFor } from '../src/game/look.ts';
import { nextMilestone, reachedMilestone } from '../src/game/milestones.ts';
import { imageKindsOf, SPECIES } from '../src/species.ts';
import { milestoneText, updateNote } from '../src/texts/messages.ts';
import { de } from '../src/texts/de.ts';
import { en } from '../src/texts/en.ts';

describe('the looks of chicks (SPEC 9.2.6)', () => {
  it('takes the rarest of the three chick looks, on a tie the lower one', () => {
    expect(chickLookFor([0, 0, 0])).toBe(0);
    expect(chickLookFor([1, 0, 0])).toBe(1);
    expect(chickLookFor([1, 1, 0])).toBe(2);
    expect(chickLookFor([1, 1, 1])).toBe(0);
    expect(chickLookFor([2, 1, 1])).toBe(1);
    expect(chickLookFor([0, 3, 1])).toBe(0);
  });

  it('reads a chick look safely', () => {
    expect(asChickLook(1)).toBe(1);
    expect(asChickLook(2)).toBe(2);
    expect(asChickLook(3)).toBe(0);
    expect(asChickLook('2')).toBe(0);
    expect(asChickLook(undefined)).toBe(0);
  });

  it('has three chick pictures by day and night and the care pictures for every species but the phoenix', () => {
    const chickKinds = [
      'chick2',
      'chick3',
      'chickNight',
      'chick2Night',
      'chick3Night',
      'chickFeeding',
      'chickPetting',
    ];
    for (const species of SPECIES) {
      const kinds = imageKindsOf(species).map((entry) => entry.kind as string);
      for (const kind of chickKinds) expect(kinds.includes(kind)).toBe(!species.mythical);
    }
  });
});

describe('milestones of letters between people (SPEC 11.1)', () => {
  it('1,000, 5,000, 10,000, 50,000, 100,000, 1,000,000, then every 500,000', () => {
    const marks: number[] = [];
    for (let mark = nextMilestone(0); marks.length < 9; mark = nextMilestone(mark))
      marks.push(mark);
    expect(marks).toEqual([
      1_000, 5_000, 10_000, 50_000, 100_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000,
    ]);
    expect(nextMilestone(1_234_567)).toBe(1_500_000);
    expect(nextMilestone(999)).toBe(1_000);
  });

  it('the highest milestone reached', () => {
    expect(reachedMilestone(0)).toBeNull();
    expect(reachedMilestone(999)).toBeNull();
    expect(reachedMilestone(1_000)).toBe(1_000);
    expect(reachedMilestone(99_999)).toBe(50_000);
    expect(reachedMilestone(2_100_000)).toBe(2_000_000);
  });

  it('the festive message names the number in the language and links donation and feedback', () => {
    const german = milestoneText(10_000, 'de');
    const english = milestoneText(10_000, 'en');
    expect(german.title).toContain('10.000');
    expect(english.title).toContain('10,000');
    for (const text of [german, english]) {
      const all = text.paragraphs.join(' ');
      expect(all).toContain('{link}');
      expect(all).toContain('{feedback}');
      expect(all).not.toContain('{count}');
    }
  });
});

describe('texts of version 1.5.0', () => {
  it('has the notes of the update in both languages', () => {
    expect(updateNote('1.5.0', 'de')?.paragraphs.length).toBeGreaterThan(2);
    expect(updateNote('1.5.0', 'en')?.paragraphs.length).toBe(
      updateNote('1.5.0', 'de')?.paragraphs.length,
    );
  });

  it('has the same keys for the chick notice in German and English', () => {
    expect(Object.keys(en.clutchNotice).sort()).toEqual(Object.keys(de.clutchNotice).sort());
    expect(de.system.clutch_reminder_days).toContain('{days}');
    expect(en.system.clutch_reminder_all_days).toContain('{days}');
  });
});
