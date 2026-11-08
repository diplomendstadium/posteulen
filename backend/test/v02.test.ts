/**
 * Version 0.2: deletion of old letters (one year, or 30/90/180 days by choice) and the
 * migration 0007 (menagerie, care history, moves).
 */
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIME } from '@posteulen/shared/constants.ts';
import { openDatabase } from '../src/db/database.ts';
import { loadMigrations, migrate } from '../src/db/migrate.ts';
import { utcDay } from '../src/security/ids.ts';
import { tempDir } from './helpers.ts';
import {
  advanceTo,
  couple,
  HAMBURG,
  person,
  testApp,
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
  await couple(anna, ben);
});
afterEach(async () => {
  await app.close();
});

let counter = 0;
/** A delivered letter between two people, `daysAgo` days old. */
function letter(from: Person, to: Person, daysAgo: number, read = 1): string {
  const id = `brief${String(counter++).padStart(17, '0')}`;
  const at = app.clock.now - daysAgo * TIME.DAY;
  app.db.run(
    `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, ciphertext,
                          wrap_recipient, wrap_sender, status, read, owl_name, owl_species)
     VALUES (?, ?, ?, 'letter', 'small', ?, ?, ?, ?, ?, 'delivered', ?, 'Wilma', 'waldkauz')`,
    id,
    from.id,
    to.id,
    at - TIME.HOUR,
    at,
    new Uint8Array([1]),
    new Uint8Array([2]),
    new Uint8Array([3]),
    read,
  );
  return id;
}

function copies(id: string) {
  return app.db.get<{ sender_has: number; recipient_has: number }>(
    'SELECT sender_has, recipient_has FROM letters WHERE id = ?',
    id,
  );
}

function runCleanup(at: number): void {
  app.db.run("DELETE FROM scheduled_events WHERE type = 'daily:inactivity'");
  app.db.run("DELETE FROM daily_job_runs WHERE job = 'inactivity' AND day = ?", utcDay(at));
  app.ctx.queue.schedule('daily:inactivity', 'inactivity', at);
  advanceTo(app, at);
}

const settings = (who: Person, retentionDays: number, print = false) =>
  who.agent.json<{ profile: { letterRetentionDays: number; lettersPrint: boolean } }>(
    'PATCH',
    '/api/account/letters',
    { retentionDays, print },
  );

describe('deletion of old letters (v0.2)', () => {
  it('everything older than one year disappears at 04:00 – also bot letters and system messages', async () => {
    const old = letter(anna, ben, 366);
    const young = letter(anna, ben, 364);
    const botLetters = () =>
      app.db.get<{ n: number }>(
        'SELECT COUNT(*) AS n FROM letters WHERE recipient_id = ? AND plaintext IS NOT NULL AND arrives_at = 0',
        anna.id,
      )?.n ?? 0;
    app.db.run(
      "UPDATE letters SET arrives_at = 0 WHERE plaintext IS NOT NULL AND status = 'delivered'",
    );
    expect(botLetters()).toBeGreaterThan(0);
    app.db.run('UPDATE system_messages SET created_at = 0');
    runCleanup(app.clock.now + 18 * TIME.HOUR);
    expect(copies(old)).toBeUndefined();
    expect(copies(young)).toEqual({ sender_has: 1, recipient_has: 1 });
    expect(botLetters()).toBe(0);
    expect(app.db.get('SELECT 1 FROM system_messages WHERE created_at = 0')).toBeUndefined();
  });

  it('a shorter own period deletes only one’s own copies, at once and then nightly', async () => {
    const sent = letter(anna, ben, 40);
    const received = letter(ben, anna, 40, 0);
    const recent = letter(ben, anna, 10, 0);
    const chat = () =>
      app.db.get<{ unread: number }>(
        'SELECT unread FROM chats WHERE owner_id = ? AND peer_id = ?',
        anna.id,
        ben.id,
      );
    app.db.run(
      `INSERT INTO chats (owner_id, peer_id, peer_kind, last_activity_at, unread)
       VALUES (?, ?, 'user', ?, 2)`,
      anna.id,
      ben.id,
      app.clock.now,
    );
    const changed = await settings(anna, 30, true);
    expect(changed.body.profile).toMatchObject({ letterRetentionDays: 30, lettersPrint: true });
    expect(copies(sent)).toEqual({ sender_has: 0, recipient_has: 1 });
    expect(copies(received)).toEqual({ sender_has: 1, recipient_has: 0 });
    expect(copies(recent)).toEqual({ sender_has: 1, recipient_has: 1 });
    // The deleted unread letter no longer counts.
    expect(chat()?.unread).toBe(1);
    // Ben's copies follow his own period: gone after one year at the latest.
    runCleanup(app.clock.now + 21 * TIME.DAY);
    expect(copies(recent)).toEqual({ sender_has: 1, recipient_has: 0 });
    runCleanup(app.clock.now + 340 * TIME.DAY);
    expect(copies(sent)).toBeUndefined();
  });

  it('a letter on the way is never deleted; only the four periods are accepted', async () => {
    const flying = letter(anna, ben, 400);
    app.db.run("UPDATE letters SET status = 'in_flight' WHERE id = ?", flying);
    await settings(anna, 30);
    runCleanup(app.clock.now + TIME.DAY);
    expect(copies(flying)).toEqual({ sender_has: 1, recipient_has: 1 });
    for (const retentionDays of [0, 7, 60, 400, 365.5])
      expect((await settings(anna, retentionDays)).status).toBe(400);
    expect(
      (
        await anna.agent.json('PATCH', '/api/account/letters', {
          retentionDays: 90,
          print: false,
          extra: 1,
        })
      ).status,
    ).toBe(400);
    expect((await settings(anna, 365)).body.profile.letterRetentionDays).toBe(365);
  });

  it('system messages follow the own period', async () => {
    const messages = () =>
      app.db.get<{ n: number }>(
        'SELECT COUNT(*) AS n FROM system_messages WHERE user_id = ?',
        anna.id,
      )?.n ?? 0;
    app.db.run(
      `INSERT INTO system_messages (id, user_id, type, params, created_at) VALUES (?, ?, 'owl_sick', '{}', ?)`,
      'system000000000000000',
      anna.id,
      app.clock.now - 100 * TIME.DAY,
    );
    const before = messages();
    await settings(ben, 90);
    expect(messages()).toBe(before);
    await settings(anna, 90);
    expect(messages()).toBe(before - 1);
  });
});

describe('migration 0007 (v0.2)', () => {
  it('renames the menagerie state, converts the care mask and keeps flights linked', () => {
    const db = openDatabase(path.join(tempDir(), 'db.sqlite'));
    const migrations = loadMigrations();
    migrate(db, migrations.slice(0, 6));
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
    const owl = (id: string, state: string, mask: number) =>
      db.run(
        `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, state, owned_since,
                           care_mask, care_mask_day, created_at)
         VALUES (?, 'u', 'own', 'waldkauz', 'f', 'Wilma', 10, 1000, ?, '2026-01-01', ?, '2026-11-05', 0)`,
        id,
        state,
        mask,
      );
    owl('o1', 'papeterie', 0b101);
    owl('o2', 'flying', 0);
    db.run(
      `INSERT INTO flights (id, holder_id, owl_id, owl_kind, owl_name, owl_species, purpose, profile, route,
                            plan, started_at, ends_at)
       VALUES ('f', 'u', 'o2', 'own', 'Wilma', 'waldkauz', 'letter', '{}', '[]', '{}', 1000, 2000)`,
    );
    db.run(
      "INSERT INTO transactions (user_id, at, type, amount) VALUES ('u', 1, 'papeterie_wage', 6)",
    );
    db.run(
      "INSERT INTO scheduled_events (type, ref, due_at, logical_at) VALUES ('papeterie_end', 'o1', 5000, 5000)",
    );

    expect(migrate(db, migrations)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(db.all('SELECT id, state FROM owls ORDER BY id')).toEqual([
      { id: 'o1', state: 'menagerie' },
      { id: 'o2', state: 'flying' },
    ]);
    expect(db.get('SELECT owl_id FROM flights')).toEqual({ owl_id: 'o2' });
    expect(db.all('SELECT owl_id, day FROM owl_care_days ORDER BY day')).toEqual([
      { owl_id: 'o1', day: '2026-11-03' },
      { owl_id: 'o1', day: '2026-11-05' },
    ]);
    expect(db.all('SELECT owl_id, since_at, until_at FROM owl_away ORDER BY owl_id')).toEqual([
      { owl_id: 'o1', since_at: 1000, until_at: null },
      { owl_id: 'o2', since_at: 1000, until_at: null },
    ]);
    expect(db.get('SELECT type FROM transactions')).toEqual({ type: 'menagerie_wage' });
    expect(db.get('SELECT type FROM scheduled_events')).toEqual({ type: 'menagerie_end' });
    expect(
      db.get('SELECT letter_retention_days, letters_print, home_moves_count FROM users'),
    ).toEqual({ letter_retention_days: 365, letters_print: 0, home_moves_count: 0 });
    expect(db.all('PRAGMA foreign_key_check')).toEqual([]);
    db.close();
  });
});
