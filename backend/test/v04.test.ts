/**
 * Version 0.4: language of the account (German default, English from the English view or
 * the settings) – bot letters, bot names, loan owl names, AI prompts and push texts follow it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIME } from '@posteulen/shared/constants.ts';
import { owlNames } from '@posteulen/shared/names-data.ts';
import { systemPrompt } from '../src/bots/prompts.ts';
import { languageOf } from '../src/accounts/language.ts';
import { person, testApp, type Person, type SentPush, type TestApp } from './auth-helpers.ts';

let app: TestApp & { pushes: SentPush[] };
let anna: Person;

beforeEach(async () => {
  app = await testApp();
  anna = await person(app, 'Anna');
});
afterEach(async () => {
  await app.close();
});

const botLetters = (who: Person) =>
  app.db
    .all<{ plaintext: string }>(
      'SELECT plaintext FROM letters WHERE recipient_id = ? AND plaintext IS NOT NULL',
      who.id,
    )
    .map((row) => row.plaintext);

describe('language of the account (v0.4)', () => {
  it('is German by default and English for an account created in the English view', async () => {
    expect(languageOf(app.ctx, anna.id)).toBe('de');
    const sam = await person(app, 'Sam', undefined, 'en');
    expect(languageOf(app.ctx, sam.id)).toBe('en');
    const profile = await sam.agent.json<{ profile: { language: string } }>('GET', '/api/sync');
    expect(profile.body.profile.language).toBe('en');
    // The Explainer Bear's first letter is already in the box – in English.
    expect(botLetters(sam).some((text) => text.startsWith('Hello and welcome'))).toBe(true);
    expect(botLetters(anna).some((text) => text.startsWith('Hallo und willkommen'))).toBe(true);
    const contacts = await sam.agent.json<{ bots: { name: string }[] }>('GET', '/api/contacts');
    expect(contacts.body.bots.map((bot) => bot.name)).toContain('Explainer Bear');
  });

  it('can be changed in the settings; bot names follow, today’s loan owls keep their names', async () => {
    type Offer = { offer: { name: string; sex: 'f' | 'm' }[] };
    const before = await anna.agent.json<Offer>('GET', '/api/menagerie');
    expect(before.body.offer.every((owl) => owlNames('de', owl.sex).includes(owl.name))).toBe(true);
    const changed = await anna.agent.json<{ profile: { language: string } }>(
      'PATCH',
      '/api/account/language',
      { language: 'en' },
    );
    expect(changed.status).toBe(200);
    expect(changed.body.profile.language).toBe('en');
    // v1.3.2: the names of today's offer keep the language they were rolled in (SPEC 9.6) …
    const after = await anna.agent.json<Offer>('GET', '/api/menagerie');
    expect(after.body.offer).toEqual(before.body.offer);
    // … the next day's offer comes from the English lists.
    app.clock.now += TIME.DAY;
    const next = await anna.agent.json<Offer>('GET', '/api/menagerie');
    expect(next.body.offer.every((owl) => owlNames('en', owl.sex).includes(owl.name))).toBe(true);
    const contacts = await anna.agent.json<{ bots: { name: string }[] }>('GET', '/api/contacts');
    expect(contacts.body.bots.map((bot) => bot.name)).toContain('Explainer Bear');
    expect(
      (await anna.agent.json('PATCH', '/api/account/language', { language: 'fr' })).status,
    ).toBe(400);
  });

  it('makes the bots reply in English and know the English help', () => {
    expect(systemPrompt('explainer', 'en')).toContain('Antworte auf Englisch');
    expect(systemPrompt('explainer', 'en')).toContain('Explainer Bear');
    expect(systemPrompt('explainer', 'de')).toContain('Antworte auf Deutsch');
    expect(systemPrompt('explainer', 'en')).toContain('Samaritans');
  });
});
