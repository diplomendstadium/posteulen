/**
 * Test set-up directly in the database of the local preview instance (never on servers):
 * gives a test account gold, because new accounts start with 3.0 and owls cost 6.0 or more.
 */
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function databaseOf(instance: 'main' | 'admin'): string {
  const dir = process.env['POSTEULEN_E2E_DIR'];
  if (!dir) throw new Error('POSTEULEN_E2E_DIR is not set');
  return path.join(dir, instance, 'posteulen.sqlite');
}

function withDb<T>(work: (db: DatabaseSync) => T, instance: 'main' | 'admin' = 'main'): T {
  const db = new DatabaseSync(databaseOf(instance));
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    return work(db);
  } finally {
    db.close();
  }
}

export function setGold(name: string, tenths: number, instance: 'main' | 'admin' = 'main'): void {
  withDb((db) => {
    const result = db.prepare('UPDATE users SET gold = ? WHERE name_display = ?').run(tenths, name);
    if (result.changes !== 1) throw new Error(`no account ${name}`);
  }, instance);
}

/** Makes all own owls of an account sick (the daily roll is random, SPEC 9.8). */
export function makeSick(name: string): void {
  withDb((db) => {
    db.prepare(
      "UPDATE owls SET state = 'sick' WHERE kind = 'own' AND owner_id = (SELECT id FROM users WHERE name_display = ?)",
    ).run(name);
  });
}

/** Lets the home be changed again this month (normally three times, SPEC 7.3). */
export function allowHomeChange(name: string): void {
  withDb((db) => {
    db.prepare('UPDATE users SET home_moves_count = 0 WHERE name_display = ?').run(name);
  });
}

/** A freshly hatched clutch of `count` unnamed chicks (eggs are rare, SPEC 9.9). */
export function hatchChicks(name: string, species: string, count: number): void {
  withDb((db) => {
    const owner = db.prepare('SELECT id FROM users WHERE name_display = ?').get(name) as
      { id: string } | undefined;
    if (!owner) throw new Error(`no account ${name}`);
    const now = Date.now();
    const id = () => crypto.randomUUID().replace(/-/g, '').slice(0, 22);
    const clutch = id();
    db.prepare(
      'INSERT INTO clutches (id, owner_id, species, hatched_at, gift_state) VALUES (?, ?, ?, ?, ?)',
    ).run(clutch, owner.id, species, now, count >= 2 ? 'open' : 'none');
    for (let i = 0; i < count; i++) {
      db.prepare(
        `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, is_chick, adult_at,
                           owned_since, created_at, clutch_id, hatched_at)
         VALUES (?, ?, 'own', ?, 'f', NULL, 100, ?, 1, ?, ?, ?, ?, ?)`,
      ).run(
        id(),
        owner.id,
        species,
        now,
        now + 14 * 86_400_000,
        new Date(now).toISOString().slice(0, 10),
        now,
        clutch,
        now,
      );
    }
  });
}

/** v0.8.5: named adult owls at home, e.g. to pass the 20 needed for releasing one (9.2.8). */
export function addOwls(name: string, species: string, count: number): void {
  withDb((db) => {
    const owner = db.prepare('SELECT id FROM users WHERE name_display = ?').get(name) as
      { id: string } | undefined;
    if (!owner) throw new Error(`no account ${name}`);
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      db.prepare(
        `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at)
         VALUES (?, ?, 'own', ?, 'm', ?, 100, ?, ?, ?)`,
      ).run(
        crypto.randomUUID().replace(/-/g, '').slice(0, 22),
        owner.id,
        species,
        `Helfer ${i + 1}`,
        now,
        new Date(now).toISOString().slice(0, 10),
        now,
      );
    }
  });
}
