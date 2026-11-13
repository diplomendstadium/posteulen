import { describe, expect, it } from 'vitest';
import { ACCOUNT, GOLD, LETTER, OPERATIONS } from '../src/constants.ts';
import { formatGold } from '../src/game/gold.ts';
import { SPECIES } from '../src/species.ts';
import { sanitizeLetterText } from '../src/text-rules.ts';
import { de } from '../src/texts/de.ts';
import { botLetters, EXPLAINER_LETTERS } from '../src/texts/bots.ts';
import {
  HELP_FAQ,
  HELP_INTRO,
  HELP_SECTIONS,
  helpAsText,
  type HelpSection,
} from '../src/texts/help.ts';
import {
  IMPRINT_INTRO,
  IMPRINT_SECTIONS,
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
} from '../src/texts/legal.ts';

function allText(sections: readonly HelpSection[]): string {
  return sections.flatMap((section) => [section.title, ...section.blocks.flat()]).join('\n');
}

const PAGES = [
  { name: 'Hilfe', intro: HELP_INTRO, sections: HELP_SECTIONS },
  { name: 'Datenschutz', intro: PRIVACY_INTRO, sections: PRIVACY_SECTIONS },
  { name: 'Impressum', intro: IMPRINT_INTRO, sections: IMPRINT_SECTIONS },
];

describe('Hilfe, Datenschutz, Impressum (SPEC 8.11)', () => {
  it.each(PAGES)('$name: eindeutige, URL-taugliche Abschnitts-IDs', ({ sections }) => {
    const ids = sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
    expect(ids).not.toContain('top');
    expect(ids).not.toContain('fragen');
  });

  it.each(PAGES)(
    '$name: Texte halten die Textregeln ein (keine Emojis, keine Steuerzeichen)',
    ({ intro, sections }) => {
      for (const text of [intro, allText(sections)]) {
        expect(sanitizeLetterText(text).text).toBe(text);
      }
    },
  );

  it('die Hilfe erklärt jede Funktion, FAQ und Google-freies Android', () => {
    const titles = HELP_SECTIONS.map((section) => section.id);
    for (const id of [
      'konto',
      'adressbuch',
      'verschluesselung',
      'sicher',
      'briefe',
      'aufbewahrung',
      'eulen',
      'energie',
      'flug',
      'karte',
      'gold',
      'menagerie',
      'verleih',
      'krankheit',
      'kueken',
      'bots',
      'benachrichtigungen',
      'einstellungen',
      'inaktiv',
    ])
      expect(titles).toContain(id);
    expect(HELP_FAQ.length).toBeGreaterThanOrEqual(5);
    const text = allText(HELP_SECTIONS);
    expect(text).toContain('IronFox');
    expect(text).toContain('UnifiedPush');
    expect(text).toContain('Sandboxed Google Play');
    // Crisis help is visible in the help too (SPEC 10.5).
    expect(text).toContain('0800 111 0 111');
    // Honest about the unlocked device (SPEC 5.5).
    expect(text).toContain('entsperrtes Gerät');
  });

  it('Zahlen in der Hilfe stammen aus den Konstanten', () => {
    const text = allText(HELP_SECTIONS);
    expect(text).toContain(`${formatGold(GOLD.START)} Gold`);
    expect(text).toContain(`bis ${LETTER.LARGE_MAX_CHARS} Zeichen`);
    expect(text).toContain(`mindestens ${ACCOUNT.PASSWORD_MIN_CHARS} Zeichen`);
    for (const species of SPECIES) expect(text).toContain(`${species.name}: ${species.price} Gold`);
  });

  it('der Text für den Erklärbären enthält alle Abschnitte und Fragen', () => {
    const text = helpAsText();
    expect(text.startsWith(HELP_INTRO)).toBe(true);
    for (const section of HELP_SECTIONS) expect(text).toContain(section.title);
    for (const item of HELP_FAQ) {
      expect(text).toContain(`Frage: ${item.question}`);
      expect(text).toContain(`Antwort: ${item.answer}`);
    }
    // Lists become dashes, nothing is lost.
    expect(text).toContain(`- ${de.welcome.androidSteps[0]}`);
  });

  it('nennt beim Schreiben die aktuellen Höchstlängen (v0.3)', () => {
    const spaced = (n: number): string => n.toLocaleString('de-DE').replace('.', ' ');
    expect(de.letters.smallOption).toContain(spaced(LETTER.SMALL_MAX_CHARS));
    expect(de.letters.largeOption).toContain(spaced(LETTER.LARGE_MAX_CHARS));
  });

  it('erklärt Laien den Weg aufs Handy; Sonderfälle nur in der Hilfe (v0.3)', () => {
    const ids = HELP_SECTIONS.map((section) => section.id);
    // Right after the introduction, before anything else.
    expect(ids.slice(0, 2)).toEqual(['idee', 'installieren']);
    const install = allText(HELP_SECTIONS.filter((section) => section.id === 'installieren'));
    for (const word of ['App-Store', 'Chrome', 'Safari', 'Firefox', 'Lesezeichen', 'Briefkasten'])
      expect(install).toContain(word);
    const help = allText(HELP_SECTIONS);
    expect(help).toContain('UnifiedPush');
    // Onboarding and the Erklärbär's letters leave out phones without Google and UnifiedPush.
    const onboarding = JSON.stringify(de.welcome) + JSON.stringify(EXPLAINER_LETTERS);
    expect(onboarding).not.toMatch(/UnifiedPush|IronFox|Fennec|GrapheneOS|Google-Dienste/);
    for (const letter of Object.values(EXPLAINER_LETTERS))
      expect([...letter].length).toBeLessThanOrEqual(LETTER.SMALL_MAX_CHARS);
    // v0.4: the English letters fit on small parchment as well.
    const english = botLetters('en');
    for (const letter of Object.values(english.explainer))
      expect([...letter].length).toBeLessThanOrEqual(LETTER.SMALL_MAX_CHARS);
  });

  it('die Datenschutzerklärung ist vollständig, ohne Entwurfshinweis und Platzhalter (v0.2)', () => {
    const text = `${PRIVACY_INTRO}\n${allText(PRIVACY_SECTIONS)}`;
    expect(text).not.toMatch(/Entwurf|\[/);
    expect(PRIVACY_SECTIONS.map((section) => section.id)).not.toContain('verantwortlich');
    expect(PRIVACY_SECTIONS.map((section) => section.id)).not.toContain('rechte');
    for (const required of [
      'Ende-zu-Ende',
      'Metadaten',
      'entsperrtes Gerät',
      'OpenAI',
      de.bots.notice,
      'Apple',
      'Google',
      'Mozilla',
      'UnifiedPush',
      'genau ein Cookie',
      'IP-Adresse wird nicht gespeichert',
      `nach ${OPERATIONS.BACKUP_RETENTION_DAYS} Tagen`,
      'Automatische Löschung',
      // v0.8.5: deleted at the weekly run after the period.
      `${LETTER.RETENTION_MAX_DAYS} Tage nach ihrer Zustellung`,
      'einmal pro Woche',
    ])
      expect(text).toContain(required);
  });

  it('das Impressum nennt Mastodon und schließt die Haftung aus', () => {
    const text = `${IMPRINT_INTRO}\n${allText(IMPRINT_SECTIONS)}`;
    expect(text).toContain('technisches Experiment für den Eigengebrauch');
    expect(text).toContain('@iak@23.social');
    expect(text).toContain('https://23.social/@iak');
    expect(text).toContain('keinerlei Haftung');
    expect(IMPRINT_SECTIONS.map((section) => section.id)).toEqual(['kontakt', 'haftung']);
  });

  it('keine Begriffe aus bekannten geschützten Werken (SPEC 14)', () => {
    const text = [helpAsText(), allText(PRIVACY_SECTIONS), allText(IMPRINT_SECTIONS)]
      .join('\n')
      .toLowerCase();
    for (const term of ['hogwarts', 'harry potter', 'muggel', 'quidditch', 'hedwig'])
      expect(text).not.toContain(term);
  });
});

describe('Hilfe zu Version 0.2', () => {
  it('weist deutlich auf die Löschung alter Briefe hin und erklärt die neuen Regeln', () => {
    const text = helpAsText();
    // v0.8.5: deleted 365 days after delivery, at the weekly clean-up (Mondays).
    expect(text).toContain('365 Tage – also ein Jahr – nach ihrer Zustellung');
    expect(text).toContain('einmal in der Woche, montags früh');
    expect(text).toContain('30, 90 oder 180 Tagen');
    expect(text).toContain('mindestens 1 Stunde zu Hause');
    expect(text).toContain('3-mal pro Kalendermonat');
    expect(text).toContain('Leiheulen des Tages');
    expect(text).toContain('harte, seriöse Kryptografie');
    expect(text).not.toMatch(/Papeterie/i);
  });
});

describe('English view (v0.4)', () => {
  it('has the same help sections, questions and legal sections as the German one', async () => {
    const { helpOf, helpAsText } = await import('../src/texts/help.ts');
    const { legalOf } = await import('../src/texts/legal.ts');
    const german = helpOf('de');
    const english = helpOf('en');
    expect(english.sections.map((section) => section.id)).toEqual(
      german.sections.map((section) => section.id),
    );
    expect(english.faq.length).toBeGreaterThanOrEqual(german.faq.length);
    for (const part of ['privacy', 'imprint'] as const)
      expect(legalOf('en')[part].map((section) => section.id)).toEqual(
        legalOf('de')[part].map((section) => section.id),
      );
    const text = helpAsText('en');
    expect(text).toContain('Explainer Bear');
    expect(text).toContain(`${formatGold(GOLD.DAILY, '.')} gold`);
    expect(text).not.toMatch(/[äöü]/);
  });

  it('translates species, descriptions, donation requests and update notes', async () => {
    const { SPECIES_DESCRIPTIONS, SPECIES_DESCRIPTIONS_EN } =
      await import('../src/texts/species.ts');
    const messages = await import('../src/texts/messages.ts');
    expect(Object.keys(SPECIES_DESCRIPTIONS_EN).sort()).toEqual(
      Object.keys(SPECIES_DESCRIPTIONS).sort(),
    );
    expect(new Set(SPECIES.map((species) => species.nameEn)).size).toBe(SPECIES.length);
    expect(messages.DONATION_TEXTS_EN).toHaveLength(messages.DONATION_TEXTS.length);
    expect(messages.UPDATE_NOTES_EN.map((note) => note.version)).toEqual(
      messages.UPDATE_NOTES.map((note) => note.version),
    );
    expect(messages.updateNote('0.4.0', 'en')?.title).toMatch(/version 0\.4/);
    expect(messages.donationText(2, 'en')?.paragraphs.join(' ')).toContain('{link}');
  });
});

describe('language helpers (v0.4)', () => {
  it('picks texts, locale and gold format by language', async () => {
    const { isLanguage, localeOf } = await import('../src/i18n.ts');
    const { en, textsOf } = await import('../src/texts/en.ts');
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(localeOf('en')).toBe('en-GB');
    expect(localeOf('de')).toBe('de-DE');
    expect(textsOf('en')).toBe(en);
    expect(textsOf('de')).toBe(de);
    expect(en.units.gold(25)).toBe('2.5 gold');
    expect(de.units.gold(25)).toBe('2,5 Gold');
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  });

  it('names and describes species in both languages', async () => {
    const { speciesName } = await import('../src/species.ts');
    const { speciesDescription } = await import('../src/texts/species.ts');
    expect(speciesName('waldkauz')).toBe('Waldkauz');
    expect(speciesName('waldkauz', 'en')).toBe('Tawny Owl');
    expect(speciesName('unbekannt', 'en')).toBe('unbekannt');
    expect(speciesDescription('waldkauz')).toContain('Waldkauz');
    expect(speciesDescription('waldkauz', 'en')).toContain('Tawny Owl');
    expect(speciesDescription('unbekannt', 'en')).toBeUndefined();
  });
});
