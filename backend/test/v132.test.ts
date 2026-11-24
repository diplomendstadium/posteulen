/**
 * Version 1.3.2 (server side): the moon and the crown after owl names (SPEC 9.2.1), the names of
 * the daily loan offer keep their language (9.6), long conversations send only their latest
 * letters (8.4), "Über diese Instanz" (8.1) and migration 0025.
 */
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INSTANCE_STATS_CACHE_MS, TIME } from '@posteulen/shared/constants.ts';
import { owlNames } from '@posteulen/shared/names-data.ts';
import { openDatabase } from '../src/db/database.ts';
import { loadMigrations, migrate } from '../src/db/migrate.ts';
import { announceAllBadges, announceBadges } from '../src/owls/globe.ts';
import { addSystemMessage } from '../src/messages/system.ts';
import { tempDir } from './helpers.ts';
import {
  Agent,
  buyOwl,
  couple,
  HAMBURG,
  person,
  setGold,
  testApp,
  USER_ORIGIN,
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
});
afterEach(async () => {
  await app.close();
});

const systemTypes = (who: Person) =>
  app.db
    .all<{ type: string }>(
      'SELECT type FROM system_messages WHERE user_id = ? ORDER BY created_at, rowid',
      who.id,
    )
    .map((row) => row.type);

describe('moon and crown (SPEC 9.2.1)', () => {
  it('the moon from 384 400 km, announced once and instead of the globe', async () => {
    setGold(app, anna, 500);
    const id = await buyOwl(app, anna, 'waldkauz');
    app.db.run('UPDATE owls SET km_flown = 384399 WHERE id = ?', id);
    expect(announceAllBadges(app.ctx, app.clock.now)).toBe(1);
    expect(systemTypes(anna).filter((type) => type.startsWith('owl_g'))).toEqual(['owl_globe']);
    app.db.run('UPDATE owls SET km_flown = 384400 WHERE id = ?', id);
    expect(announceAllBadges(app.ctx, app.clock.now)).toBe(1);
    expect(announceAllBadges(app.ctx, app.clock.now)).toBe(0);
    expect(systemTypes(anna).filter((type) => type === 'owl_moon')).toHaveLength(1);
    const list = await anna.agent.json<{ owls: { id: string; name: string; badge: string }[] }>(
      'GET',
      '/api/owls',
    );
    expect(list.body.owls.find((owl) => owl.id === id)).toMatchObject({
      name: 'Waldi',
      badge: 'moon',
    });
  });

  it('the crown from 1 000 000 km; several at once celebrate only the highest', async () => {
    setGold(app, anna, 500);
    const id = await buyOwl(app, anna, 'waldkauz');
    app.db.run('UPDATE owls SET km_flown = 1000000 WHERE id = ?', id);
    app.db.transaction(() => announceBadges(app.ctx, id, app.clock.now));
    const badges = systemTypes(anna).filter((type) => /^owl_(globe|moon|crown)$/.test(type));
    expect(badges).toEqual(['owl_crown']);
    expect(
      app.db.get(
        'SELECT globe_announced, moon_announced, crown_announced FROM owls WHERE id = ?',
        id,
      ),
    ).toEqual({ globe_announced: 1, moon_announced: 1, crown_announced: 1 });
    const message = app.db.get<{ params: string }>(
      "SELECT params FROM system_messages WHERE user_id = ? AND type = 'owl_crown'",
      anna.id,
    );
    expect(JSON.parse(message?.params ?? '{}')).toEqual({ owl: 'Waldi', km: 1_000_000 });
  });
});

describe('the names of the daily offer keep their language (SPEC 9.6)', () => {
  type Offer = { offer: { species: string; name: string; sex: 'f' | 'm' }[] };
  it('changing the language does not rename the owls on offer; the next day follows it', async () => {
    const before = (await anna.agent.json<Offer>('GET', '/api/menagerie')).body.offer;
    const changed = await anna.agent.json('PATCH', '/api/account/language', { language: 'en' });
    expect(changed.status).toBe(200);
    const after = (await anna.agent.json<Offer>('GET', '/api/menagerie')).body.offer;
    expect(after.map((owl) => owl.name)).toEqual(before.map((owl) => owl.name));
    for (const owl of before) expect(owlNames('de', owl.sex)).toContain(owl.name);
    // The loan owl itself keeps the name of the offer.
    const species = before[0]?.species ?? '';
    setGold(app, anna, 50);
    const loan = await anna.agent.json<{ owl: { name: string } }>('POST', '/api/menagerie/loan', {
      species,
    });
    expect(loan.body.owl.name).toBe(before[0]?.name);
    // A new day rolls new names in the language of the account.
    app.clock.now += TIME.DAY;
    const next = (await anna.agent.json<Offer>('GET', '/api/menagerie')).body.offer;
    for (const owl of next) expect(owlNames('en', owl.sex)).toContain(owl.name);
  });

  it('an offer from before the update takes the language once', async () => {
    const before = (await anna.agent.json<Offer>('GET', '/api/menagerie')).body.offer;
    app.db.run('UPDATE menagerie_user_offers SET language = NULL WHERE user_id = ?', anna.id);
    await anna.agent.json('PATCH', '/api/account/language', { language: 'en' });
    const english = (await anna.agent.json<Offer>('GET', '/api/menagerie')).body.offer;
    await anna.agent.json('PATCH', '/api/account/language', { language: 'de' });
    const again = (await anna.agent.json<Offer>('GET', '/api/menagerie')).body.offer;
    expect(again.map((owl) => owl.name)).toEqual(english.map((owl) => owl.name));
    expect(before.length).toBe(english.length);
  });
});

describe('long conversations (SPEC 8.4)', () => {
  type Letters = { older: number; letters: { id: string }[] };
  const letter = (index: number, from: Person, to: Person, read = 1): string => {
    const id = `L${String(index).padStart(21, '0')}`;
    app.db.run(
      `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, status, owl_name,
                            owl_species, plaintext, read)
       VALUES (?, ?, ?, 'letter', 'small', ?, ?, 'delivered', 'Waldi', 'waldkauz', 'x', ?)`,
      id,
      from.id,
      to.id,
      index * 1000,
      index * 1000 + 500,
      read,
    );
    return id;
  };

  it('fewer than 30 letters: everything; from 30: the latest 25 until all are asked for', async () => {
    await couple(anna, ben);
    const ids = Array.from({ length: 29 }, (_, i) =>
      letter(i + 1, i % 2 ? anna : ben, i % 2 ? ben : anna),
    );
    let chat = await anna.agent.json<Letters>('GET', `/api/chats/${ben.id}/letters`);
    expect(chat.body).toMatchObject({ older: 0 });
    expect(chat.body.letters).toHaveLength(29);
    ids.push(letter(30, ben, anna));
    chat = await anna.agent.json<Letters>('GET', `/api/chats/${ben.id}/letters`);
    expect(chat.body.older).toBe(5);
    expect(chat.body.letters.map((l) => l.id)).toEqual(ids.slice(5));
    chat = await anna.agent.json<Letters>('GET', `/api/chats/${ben.id}/letters?all=1`);
    expect(chat.body.older).toBe(0);
    expect(chat.body.letters.map((l) => l.id)).toEqual(ids);
  });

  it('unread letters are always sent, so the chat can start at the oldest one', async () => {
    await couple(anna, ben);
    const ids = Array.from({ length: 40 }, (_, i) => letter(i + 1, ben, anna, i >= 9 ? 0 : 1));
    const chat = await anna.agent.json<Letters>('GET', `/api/chats/${ben.id}/letters`);
    expect(chat.body.older).toBe(9);
    expect(chat.body.letters[0]?.id).toBe(ids[9]);
    // Ben's own view of the same letters: nothing unread for him.
    const his = await ben.agent.json<Letters>('GET', `/api/chats/${anna.id}/letters`);
    expect(his.body.older).toBe(15);
  });

  it('the system chat works the same way', async () => {
    const existing = systemTypes(anna).length;
    app.db.run('UPDATE system_messages SET seen = 1, arrival_shown = 1 WHERE user_id = ?', anna.id);
    app.db.transaction(() => {
      for (let i = existing; i < 30; i += 1) {
        addSystemMessage(app.ctx, anna.id, 'broadcast', { text: `n${i}` }, app.clock.now + i);
      }
    });
    app.db.run('UPDATE system_messages SET seen = 1 WHERE user_id = ?', anna.id);
    type System = { older: number; messages: { id: string }[] };
    const shown = await anna.agent.json<System>('GET', '/api/system-messages');
    expect(shown.body.older).toBe(5);
    expect(shown.body.messages).toHaveLength(25);
    const all = await anna.agent.json<System>('GET', '/api/system-messages?all=1');
    expect(all.body.older).toBe(0);
    expect(all.body.messages).toHaveLength(30);
    // An unseen message further back is included.
    const oldest = all.body.messages[2]?.id ?? '';
    app.db.run('UPDATE system_messages SET seen = 0 WHERE id = ?', oldest);
    const again = await anna.agent.json<System>('GET', '/api/system-messages');
    expect(again.body.older).toBe(2);
  });
});

describe('Über diese Instanz (SPEC 8.1)', () => {
  type Instance = {
    host: string;
    stats: {
      accountsCreated: number;
      accountsCurrent: number;
      active30: number;
      letters: { total: number; last7: number };
      owls: number;
    };
  };

  it('public figures without login, counted at most every ten minutes', async () => {
    const guest = new Agent(app.userApi, USER_ORIGIN);
    setGold(app, anna, 500);
    await buyOwl(app, anna, 'waldkauz');
    const first = await guest.json<Instance>('GET', '/api/instance');
    expect(first.status).toBe(200);
    expect(first.body.host).toBe(new URL(USER_ORIGIN).host);
    expect(first.body.stats).toMatchObject({ accountsCreated: 2, accountsCurrent: 2, owls: 1 });
    expect(first.body.stats.letters).toEqual({
      total: expect.any(Number) as number,
      last7: expect.any(Number) as number,
    });
    // Only counters: no names anywhere in the answer.
    expect(JSON.stringify(first.body)).not.toMatch(/Anna|Ben|Waldi/);
    await person(app, 'Carla');
    expect((await guest.json<Instance>('GET', '/api/instance')).body.stats.accountsCreated).toBe(2);
    app.clock.now += INSTANCE_STATS_CACHE_MS;
    expect((await guest.json<Instance>('GET', '/api/instance')).body.stats.accountsCreated).toBe(3);
  });
});

describe('migration 0025 (v1.3.2)', () => {
  it('adds the moon and crown flags and the language of the offer', () => {
    const db = openDatabase(path.join(tempDir(), 'db.sqlite'));
    const migrations = loadMigrations();
    migrate(db, migrations.slice(0, 24));
    db.run(
      `INSERT INTO users (id, name_display, name_key, created_on, opaque_record, ed25519_pub, x25519_pub,
                          key_format, wrapped_master_key, private_keys, home_lat, home_lon, home_changed_on,
                          gold, last_active_date)
       VALUES ('u', 'Anna', 'anna', '2026-01-01', 'x', ?, ?, 1, ?, ?, 5252, 1340, '2026-01-01', 30, '2026-11-01')`,
      new Uint8Array(32),
      new Uint8Array(32),
      new Uint8Array(1),
      new Uint8Array(1),
    );
    db.run(
      `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at,
                         km_flown, globe_announced)
       VALUES ('o', 'u', 'own', 'waldkauz', 'f', 'Momo', 10, 1, '2026-01-01', 1, 50000, 1)`,
    );
    db.run(
      `INSERT INTO menagerie_user_offers (user_id, day, species, team) VALUES ('u', '2026-11-24', '[]', 'A')`,
    );
    expect(migrate(db, migrations)).toEqual([25]);
    expect(db.get('SELECT globe_announced, moon_announced, crown_announced FROM owls')).toEqual({
      globe_announced: 1,
      moon_announced: 0,
      crown_announced: 0,
    });
    expect(db.get('SELECT language FROM menagerie_user_offers')).toEqual({ language: null });
    db.close();
  });
});
