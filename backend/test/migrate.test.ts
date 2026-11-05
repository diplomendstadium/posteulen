import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/db/database.ts';
import { loadMigrations, migrate, schemaState, schemaVersion } from '../src/db/migrate.ts';
import { tempDir } from './helpers.ts';

function writeMigrations(files: Record<string, string>): string {
  const dir = tempDir('posteulen-mig-');
  for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
  return dir;
}

describe('migrations (SPEC 16.3)', () => {
  it('migrates a fresh database to the latest schema and enables the pragmas', () => {
    const db = openDatabase(path.join(tempDir(), 'db.sqlite'));
    const applied = migrate(db);
    expect(applied).toEqual(loadMigrations().map((m) => m.version));
    expect(schemaState(db, loadMigrations()).kind).toBe('current');
    expect(db.get<{ secure_delete: number }>('PRAGMA secure_delete')?.secure_delete).toBe(1);
    expect(db.get<{ foreign_keys: number }>('PRAGMA foreign_keys')?.foreign_keys).toBe(1);
    expect(db.get<{ journal_mode: string }>('PRAGMA journal_mode')?.journal_mode).toBe('wal');
    expect(migrate(db)).toEqual([]);
    db.close();
  });

  it('applies only pending migrations, in order', () => {
    const dir = writeMigrations({
      '0001_a.sql': 'CREATE TABLE a (x INTEGER) STRICT;',
      '0002_b.sql': 'CREATE TABLE b (y INTEGER) STRICT;',
    });
    const db = openDatabase(path.join(tempDir(), 'db.sqlite'));
    expect(migrate(db, loadMigrations(dir).slice(0, 1))).toEqual([1]);
    expect(migrate(db, loadMigrations(dir))).toEqual([2]);
    expect(schemaVersion(db)).toBe(2);
    db.close();
  });

  it('rolls back a broken migration completely', () => {
    const dir = writeMigrations({
      '0001_a.sql': 'CREATE TABLE a (x INTEGER) STRICT;',
      '0002_broken.sql': 'CREATE TABLE b (y INTEGER) STRICT; INSERT INTO nope VALUES (1);',
    });
    const db = openDatabase(path.join(tempDir(), 'db.sqlite'));
    expect(() => migrate(db, loadMigrations(dir))).toThrow();
    expect(schemaVersion(db)).toBe(1);
    expect(db.get("SELECT name FROM sqlite_master WHERE name = 'b'")).toBeUndefined();
    db.close();
  });

  it('refuses a database that is newer than the code', () => {
    const db = openDatabase(path.join(tempDir(), 'db.sqlite'));
    db.exec('PRAGMA user_version = 99');
    expect(schemaState(db, loadMigrations()).kind).toBe('too_new');
    expect(() => migrate(db)).toThrow(/neuer als diese Programmversion/);
    db.close();
  });

  it('rejects gaps and bad file names', () => {
    expect(() => loadMigrations(writeMigrations({ '0002_a.sql': '' }))).toThrow(/without gaps/);
    expect(() => loadMigrations(writeMigrations({ '1_a.sql': '' }))).toThrow(/invalid migration/);
  });

  it('rejects nested transactions and rolls back on error', () => {
    const db = openDatabase(path.join(tempDir(), 'db.sqlite'));
    migrate(db);
    expect(() =>
      db.transaction(() => {
        db.run("INSERT INTO settings (key, value) VALUES ('k', 'v')");
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(db.get("SELECT * FROM settings WHERE key = 'k'")).toBeUndefined();
    expect(() => db.transaction(() => db.transaction(() => 1))).toThrow(/nested/);
    expect(db.all('SELECT * FROM settings')).toEqual([]);
    db.close();
  });
});
