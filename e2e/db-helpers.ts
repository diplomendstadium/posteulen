/**
 * Test set-up directly in the database of the local preview instance (never on servers):
 * gives a test account gold, because new accounts start with 3.0 and owls cost 6.0 or more.
 */
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Page } from '@playwright/test';
import { SPECIES } from '@posteulen/shared/species.ts';

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

/**
 * Makes all own owls of an account sick (the daily roll is random, SPEC 9.8) – v1.3: they are
 * in the rescue centre and need ten interactions.
 */
export function makeSick(name: string): void {
  withDb((db) => {
    db.prepare(
      "UPDATE owls SET state = 'sick' WHERE kind = 'own' AND owner_id = (SELECT id FROM users WHERE name_display = ?)",
    ).run(name);
    db.prepare(
      `INSERT OR IGNORE INTO rescue_cases (owl_id, needed, admitted_at)
       SELECT id, 10, ? FROM owls WHERE state = 'sick' AND owner_id = (SELECT id FROM users WHERE name_display = ?)`,
    ).run(Date.now(), name);
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
                           owned_since, created_at, clutch_id, hatched_at, chick_look)
         VALUES (?, ?, 'own', ?, 'f', NULL, 100, ?, 1, ?, ?, ?, ?, ?, ?)`,
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
        // v1.5.0: the standard, second and third chick picture in turn (SPEC 9.2.6).
        i % 3,
      );
    }
  });
}

/**
 * v1.5.0: closes the big notice about a chick to give away (once a day, SPEC 9.9) – a modal
 * dialog that would otherwise cover the page.
 */
export async function closeChickNotice(page: Page): Promise<void> {
  const notice = page.getByTestId('clutch-notice');
  await notice.getByRole('button').last().click();
  await notice.waitFor({ state: 'detached' });
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

/**
 * v0.10: sets energy (share of the maximum, 0–1) and motivation (tenths, 8–12) of all own and
 * loan owls of an account – feeding is possible again while the energy is not full (SPEC 9.3).
 */
export function setOwlEnergy(
  name: string,
  share: number,
  motivation?: number,
  instance: 'main' | 'admin' = 'main',
): void {
  withDb((db) => {
    const owls = db
      .prepare(
        "SELECT id, species FROM owls WHERE kind IN ('own', 'loan') AND owner_id = (SELECT id FROM users WHERE name_display = ?)",
      )
      .all(name) as { id: string; species: string }[];
    for (const owl of owls) {
      db.prepare(
        `UPDATE owls SET energy = ?, energy_at = ?, motivation = COALESCE(?, motivation) WHERE id = ?`,
      ).run(
        share * (SPECIES.find((species) => species.id === owl.species)?.maxEnergy ?? 0),
        Date.now(),
        motivation ?? null,
        owl.id,
      );
    }
  }, instance);
}

/** v1.1: marks every letter an account has written as written in the Christmas season. */
export function markChristmas(name: string): void {
  withDb((db) => {
    const result = db
      .prepare(
        'UPDATE letters SET christmas = 1 WHERE sender_id = (SELECT id FROM users WHERE name_display = ?)',
      )
      .run(name);
    if (result.changes === 0) throw new Error(`no letters of ${name}`);
  });
}

/**
 * v1.2.1: energy (share of the maximum) and optionally the state of the owls of an account –
 * all its loan owls or the own owl with the given name – for the order of the owl overview.
 */
export function setOwl(
  account: string,
  which: { loans: true } | { owlName: string },
  values: { share: number; state?: 'home' | 'menagerie'; stateUntil?: number | null },
): void {
  withDb((db) => {
    const owls = db
      .prepare(
        'loans' in which
          ? "SELECT id, species FROM owls WHERE kind = 'loan' AND owner_id = (SELECT id FROM users WHERE name_display = ?)"
          : "SELECT id, species FROM owls WHERE kind = 'own' AND owner_id = (SELECT id FROM users WHERE name_display = ?) AND name = ?",
      )
      .all(...('loans' in which ? [account] : [account, which.owlName])) as {
      id: string;
      species: string;
    }[];
    if (owls.length === 0) throw new Error(`no matching owl of ${account}`);
    for (const owl of owls) {
      db.prepare(
        'UPDATE owls SET energy = ?, energy_at = ?, state = COALESCE(?, state), state_until = ? WHERE id = ?',
      ).run(
        values.share * (SPECIES.find((species) => species.id === owl.species)?.maxEnergy ?? 0),
        Date.now(),
        values.state ?? null,
        values.stateUntil ?? null,
        owl.id,
      );
    }
  });
}

/**
 * v1.2.4: all letters of an account count as read, and one unread system message arrives (the
 * top bar shows "Neue Post!" only for letters).
 */
export function onlySystemUnread(name: string): void {
  withDb((db) => {
    const user = db.prepare('SELECT id FROM users WHERE name_display = ?').get(name) as
      { id: string } | undefined;
    if (!user) throw new Error(`no account ${name}`);
    db.prepare('UPDATE chats SET unread = 0 WHERE owner_id = ?').run(user.id);
    db.prepare(
      `INSERT INTO system_messages (id, user_id, type, params, created_at, arrival_image)
       VALUES (?, ?, 'password_changed', '{}', ?, NULL)`,
    ).run(`e2e${Date.now().toString(36)}`.padEnd(22, 'x').slice(0, 22), user.id, Date.now());
  });
}

/**
 * v1.3: the account looks active – active, with letters to and from people on each of the last
 * 14 days – so that the rule on gifts (SPEC 9.1.5) does not stand in the way of tests of others.
 */
export function looksActive(name: string): void {
  withDb((db) => {
    const user = db.prepare('SELECT id FROM users WHERE name_display = ?').get(name) as
      { id: string } | undefined;
    if (!user) throw new Error(`no account ${name}`);
    for (let day = 0; day < 14; day++) {
      db.prepare(
        `INSERT OR REPLACE INTO activity_days (user_id, day, active, sent_human, received_human)
         VALUES (?, ?, 1, 1, 1)`,
      ).run(user.id, new Date(Date.now() - day * 86_400_000).toISOString().slice(0, 10));
    }
  });
}

/** v1.3: sets the day since when the account has an owl (order of the owl overview). */
export function setOwnedSince(account: string, owlName: string, day: string): void {
  withDb((db) => {
    db.prepare(
      "UPDATE owls SET owned_since = ? WHERE name = ? AND kind = 'own' AND owner_id = (SELECT id FROM users WHERE name_display = ?)",
    ).run(day, owlName, account);
  });
}
