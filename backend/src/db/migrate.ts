import fs from 'node:fs';
import path from 'node:path';
import type { Database } from './database.ts';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../migrations');

/** Loads `NNNN_name.sql` files in order. Gaps or duplicates are a programming error. */
export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const migrations = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => {
      const match = /^(\d{4})_([a-z0-9_]+)\.sql$/.exec(file);
      if (!match?.[1] || !match[2]) throw new Error(`invalid migration file name: ${file}`);
      return {
        version: Number(match[1]),
        name: match[2],
        sql: fs.readFileSync(path.join(dir, file), 'utf8'),
      };
    })
    .sort((a, b) => a.version - b.version);
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(`migrations must be numbered 1..n without gaps (at ${migration.name})`);
    }
  });
  return migrations;
}

export function schemaVersion(db: Database): number {
  const row = db.get<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export type SchemaState =
  | { readonly kind: 'current'; readonly version: number }
  | { readonly kind: 'pending'; readonly version: number; readonly latest: number }
  | { readonly kind: 'too_new'; readonly version: number; readonly latest: number };

export function schemaState(db: Database, migrations: readonly Migration[]): SchemaState {
  const version = schemaVersion(db);
  const latest = migrations.length;
  if (version === latest) return { kind: 'current', version };
  if (version < latest) return { kind: 'pending', version, latest };
  return { kind: 'too_new', version, latest };
}

/**
 * Applies pending migrations in order, forward only, each in its own transaction together
 * with the new user_version (SPEC 16.3). Refuses a database newer than this code.
 */
export function migrate(
  db: Database,
  migrations: readonly Migration[] = loadMigrations(),
): number[] {
  const state = schemaState(db, migrations);
  if (state.kind === 'too_new') {
    throw new Error(
      `Die Datenbank (Schema ${state.version}) ist neuer als diese Programmversion (Schema ${state.latest}).`,
    );
  }
  const applied: number[] = [];
  for (const migration of migrations) {
    if (migration.version <= state.version) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
    });
    applied.push(migration.version);
  }
  return applied;
}
