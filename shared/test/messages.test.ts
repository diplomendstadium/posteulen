import { describe, expect, it } from 'vitest';
import { DONATION } from '../src/constants.ts';
import { SPECIES } from '../src/species.ts';
import { DONATION_TEXTS, notesSince, updateNote, UPDATE_NOTES } from '../src/texts/messages.ts';
import { SPECIES_DESCRIPTIONS } from '../src/texts/species.ts';
import { VERSION } from '../src/version.ts';

describe('Texte von v0.3', () => {
  it('drei Spendenbitten, jede mit dem Link, freiwillig formuliert', () => {
    expect(DONATION_TEXTS).toHaveLength(DONATION.TEXTS);
    for (const text of DONATION_TEXTS) {
      const all = text.paragraphs.join(' ');
      expect(all.match(/\{link\}/g)).toHaveLength(1);
      expect(all).toMatch(/kostenlos|Niemand|freiwillig/);
    }
    expect(new Set(DONATION_TEXTS.map((text) => text.title)).size).toBe(3);
  });

  it('die aktuelle Version hat eine Update-Nachricht; Versionen werden numerisch verglichen', () => {
    expect(updateNote(VERSION)?.version).toBe(VERSION.split('-')[0]);
    expect(updateNote('0.3.0-vmtest.2')?.version).toBe('0.3.0');
    expect(updateNote('9.9.9')).toBeUndefined();
    expect(notesSince('', '0.3.0').map((note) => note.version)).toEqual(['0.3.0']);
    expect(notesSince('0.10.0', '0.11.0')).toEqual([]);
    for (const note of UPDATE_NOTES) expect(note.paragraphs.length).toBeGreaterThan(2);
  });

  it('jede Kaufeule hat eine Beschreibung ohne die gelieferten Tippfehler', () => {
    expect(Object.keys(SPECIES_DESCRIPTIONS).sort()).toEqual(SPECIES.map((s) => s.id).sort());
    for (const text of Object.values(SPECIES_DESCRIPTIONS)) {
      expect(text.length).toBeGreaterThan(200);
      expect(text).not.toMatch(/ {2}|hhauch|mit mit|Leckeri\b|wird ist|Ein gerösteten|Blassuhu/);
    }
  });
});
