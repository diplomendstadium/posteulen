/**
 * Version 0.10.0: what owls can carry (letters, gold, loan owls, replies to bots), loan prices by
 * capacity, feeding again while not full (also visiting owls), new prices, the Virginiauhu for
 * sale and in the Menagerie.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GOLD, TIME } from '@posteulen/shared/constants.ts';
import { cargoOf, loanPrice } from '@posteulen/shared/game/owls.ts';
import type { OwlView } from '../src/owls/model.ts';
import {
  borrowOwl,
  buyOwl,
  couple,
  HAMBURG,
  person,
  setGold,
  testApp,
  withoutBots,
  type Person,
  type SentPush,
  type TestApp,
} from './auth-helpers.ts';

let app: TestApp & { pushes: SentPush[] };
let anna: Person;
let ben: Person;

beforeEach(async () => {
  app = await testApp();
  anna = await person(app, 'Anna');
  ben = await person(app, 'Ben', HAMBURG);
  withoutBots(app);
  await couple(anna, ben);
});
afterEach(async () => {
  await app.close();
});

const gold = (who: Person) =>
  app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', who.id)?.gold ?? 0;

const prepareLetter = (owlId: string, parchment: 'small' | 'large') =>
  anna.agent.json<{ code?: string }>('POST', '/api/letters/prepare', {
    recipients: [ben.id],
    parchment,
    owlId,
  });

const prepareGold = (owlId: string) =>
  anna.agent.json<{ code?: string }>('POST', '/api/gold/prepare', {
    recipient: ben.id,
    amount: 5,
    owlId,
    withCover: false,
  });

describe('carrying capacity (v0.10, SPEC 9.2.1)', () => {
  it('short parchment only, short and long, or everything including gold', async () => {
    setGold(app, anna, 2000);
    const elf = await buyOwl(app, anna, 'elfenkauz', 'Elfi');
    const tawny = await buyOwl(app, anna, 'waldkauz', 'Waldi');
    const grey = await buyOwl(app, anna, 'bartkauz', 'Bruno');
    app.db.run('UPDATE owls SET energy = 100');

    expect((await prepareLetter(elf, 'small')).status).toBe(200);
    expect((await prepareLetter(elf, 'large')).body).toMatchObject({ code: 'owl_cannot_carry' });
    expect((await prepareLetter(tawny, 'large')).status).toBe(200);
    expect((await prepareGold(tawny)).body).toMatchObject({ code: 'owl_cannot_carry' });
    expect((await prepareGold(elf)).body).toMatchObject({ code: 'owl_cannot_carry' });
    expect((await prepareGold(grey)).status).toBe(200);

    // The owl list and the preview say what each owl carries.
    const list = await anna.agent.json<{ owls: OwlView[] }>('GET', '/api/owls');
    expect(Object.fromEntries(list.body.owls.map((owl) => [owl.name, owl.cargo]))).toEqual({
      Elfi: 'short',
      Waldi: 'long',
      Bruno: 'gold',
    });
    const preview = await anna.agent.json<{
      owls: { id: string; cargo: string; offer?: boolean; species: string; price?: number }[];
    }>('POST', '/api/flights/preview', { recipients: [ben.id] });
    expect(preview.body.owls.find((owl) => owl.id === elf)?.cargo).toBe('short');
    for (const offer of preview.body.owls.filter((owl) => owl.offer)) {
      expect(offer.cargo).toBe(cargoOf(offer.species));
      expect(offer.price).toBe(loanPrice(offer.species));
    }
  });

  it('applies to loan owls and to letters to bots, also when sending', async () => {
    setGold(app, anna, 500);
    const loan = await borrowOwl(anna);
    app.db.run("UPDATE owls SET species = 'kanincheneule' WHERE id = ?", loan);
    expect((await prepareLetter(loan, 'large')).body).toMatchObject({ code: 'owl_cannot_carry' });
    expect((await prepareGold(loan)).body).toMatchObject({ code: 'owl_cannot_carry' });
    // A letter to the Erklärbär on long parchment with an owl that only carries short ones
    // (Clara keeps her Erklärbär; Anna's bots were removed for this file).
    const clara = await person(app, 'Clara', HAMBURG);
    setGold(app, clara, 500);
    const elf = await buyOwl(app, clara, 'elfenkauz', 'Elfi');
    const explainer = app.db.get<{ id: string }>(
      "SELECT id FROM bots WHERE owner_id = ? AND type = 'explainer'",
      clara.id,
    )!;
    const sent = await clara.agent.json<{ code?: string }>('POST', '/api/bot-letters/send', {
      botId: explainer.id,
      owlId: elf,
      parchment: 'large',
      text: 'Hallo Bär!',
    });
    expect(sent.body).toMatchObject({ code: 'owl_cannot_carry' });
  });
});

describe('loan owls (v0.10, SPEC 9.6)', () => {
  it('0.2 gold for species that carry gold, 0.1 for the others; price and capacity in the offer', async () => {
    const offer = await anna.agent.json<{
      offer: { species: string; price: number; cargo: string }[];
    }>('GET', '/api/menagerie');
    for (const item of offer.body.offer) {
      expect(item.price).toBe(cargoOf(item.species) === 'gold' ? 2 : 1);
      expect(item.cargo).toBe(cargoOf(item.species));
    }
    setGold(app, anna, 100);
    const first = offer.body.offer[0]!;
    await anna.agent.json('POST', '/api/menagerie/loan', { species: first.species });
    expect(gold(anna)).toBe(100 - first.price);
  });
});

describe('feeding while not full (v0.10, SPEC 9.3)', () => {
  it('own owls: once a day in any case, then again while the energy is not full', async () => {
    setGold(app, anna, 200);
    const id = await buyOwl(app, anna, 'waldkauz', 'Waldi');
    app.db.run('UPDATE owls SET energy = 540, energy_at = ? WHERE id = ?', app.clock.now, id);
    const first = await anna.agent.json<{ owl: OwlView }>('POST', `/api/owls/${id}/feed`, {});
    expect(first.status).toBe(200);
    expect(first.body.owl).toMatchObject({ fedToday: true, feedable: false, energy: 540 });
    expect(gold(anna)).toBe(200 - 60 - GOLD.FEED_PRICE);
    expect((await anna.agent.json('POST', `/api/owls/${id}/feed`, {})).body).toMatchObject({
      code: 'owl_fed_today',
    });
    app.db.run('UPDATE owls SET energy = 300, energy_at = ? WHERE id = ?', app.clock.now, id);
    const again = await anna.agent.json<{ owl: OwlView }>('POST', `/api/owls/${id}/feed`, {});
    expect(again.status).toBe(200);
    expect(gold(anna)).toBe(200 - 60 - 2 * GOLD.FEED_PRICE);
    // The snack works the same way.
    const snack = await anna.agent.json<{ owl: OwlView }>('POST', `/api/owls/${id}/snack`, {});
    expect(snack.body.owl.snackable).toBe(true);
    // Next day: once more even when full.
    app.clock.now += TIME.DAY;
    app.db.run('UPDATE owls SET energy = 540, energy_at = ? WHERE id = ?', app.clock.now, id);
    const list = await anna.agent.json<{ owls: OwlView[] }>('GET', '/api/owls');
    expect(list.body.owls[0]).toMatchObject({ feedable: true, snackable: true });
  });
});

describe('prices and the Virginiauhu (v0.10)', () => {
  it('the phoenix costs 150 gold, the Virginiauhu 60 and helps in the Menagerie', async () => {
    setGold(app, anna, 3000);
    expect((await anna.agent.json('POST', '/api/owls/buy', { species: 'phoenix' })).status).toBe(
      200,
    );
    expect(gold(anna)).toBe(3000 - 1500);
    const id = await buyOwl(app, anna, 'virginiauhu', 'Ahoi');
    expect(gold(anna)).toBe(3000 - 1500 - 600);
    const list = await anna.agent.json<{ owls: OwlView[] }>('GET', '/api/owls');
    expect(list.body.owls.find((owl) => owl.id === id)?.actions.menagerie).toBe(true);
    expect((await anna.agent.json('POST', `/api/owls/${id}/menagerie`, {})).status).toBe(200);
  });
});
