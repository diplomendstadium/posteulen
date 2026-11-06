import { describe, expect, it } from 'vitest';
import { ACCOUNT, GOLD, LETTER, OPERATIONS } from '../src/constants.ts';
import { formatGold } from '../src/game/gold.ts';
import { SPECIES } from '../src/species.ts';
import { sanitizeLetterText } from '../src/text-rules.ts';
import { de } from '../src/texts/de.ts';
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
      'briefe',
      'eulen',
      'energie',
      'flug',
      'karte',
      'gold',
      'menagerie',
      'papeterie',
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
    expect(text).toContain(`- ${de.welcome.android}`);
  });

  it('die Datenschutzerklärung ist vollständig und als Entwurf gekennzeichnet', () => {
    const text = `${PRIVACY_INTRO}\n${allText(PRIVACY_SECTIONS)}`;
    expect(PRIVACY_INTRO).toContain('Entwurf');
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
      '[Name und Anschrift des Verantwortlichen]',
      '[Name und Anschrift des Hosters]',
    ])
      expect(text).toContain(required);
  });

  it('das Impressum nennt Mastodon, schließt die Haftung aus und ist ein Entwurf', () => {
    const text = `${IMPRINT_INTRO}\n${allText(IMPRINT_SECTIONS)}`;
    expect(text).toContain('technisches Experiment für den Eigengebrauch');
    expect(text).toContain('@iak@23.social');
    expect(text).toContain('https://23.social/@iak');
    expect(text).toContain('keinerlei Haftung');
    expect(text).toContain('Entwurf');
  });

  it('keine Begriffe aus bekannten geschützten Werken (SPEC 14)', () => {
    const text = [helpAsText(), allText(PRIVACY_SECTIONS), allText(IMPRINT_SECTIONS)]
      .join('\n')
      .toLowerCase();
    for (const term of ['hogwarts', 'harry potter', 'muggel', 'quidditch', 'hedwig'])
      expect(text).not.toContain(term);
  });
});
