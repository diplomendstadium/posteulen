import { DatabaseSync } from 'node:sqlite';

/**
 * Thin wrapper around node:sqlite (D-05). Keeping all access here means a switch of the
 * driver would touch only this file.
 */
export interface Database {
  readonly raw: DatabaseSync;
  exec(sql: string): void;
  get<T>(sql: string, ...params: SqlValue[]): T | undefined;
  all<T>(sql: string, ...params: SqlValue[]): T[];
  run(sql: string, ...params: SqlValue[]): { changes: number };
  /** Runs `fn` inside BEGIN IMMEDIATE … COMMIT; rolls back on any error. */
  transaction<T>(fn: () => T): T;
  close(): void;
}

export type SqlValue = string | number | bigint | Uint8Array | null;

export function openDatabase(file: string): Database {
  const raw = new DatabaseSync(file, { enableForeignKeyConstraints: true });
  raw.exec('PRAGMA journal_mode = WAL');
  raw.exec('PRAGMA synchronous = NORMAL');
  raw.exec('PRAGMA secure_delete = ON');
  raw.exec('PRAGMA foreign_keys = ON');
  raw.exec('PRAGMA busy_timeout = 5000');
  let depth = 0;

  return {
    raw,
    exec: (sql) => raw.exec(sql),
    get: <T>(sql: string, ...params: SqlValue[]) =>
      raw.prepare(sql).get(...params) as T | undefined,
    all: <T>(sql: string, ...params: SqlValue[]) => raw.prepare(sql).all(...params) as T[],
    run: (sql, ...params) => {
      const result = raw.prepare(sql).run(...params);
      return { changes: Number(result.changes) };
    },
    transaction<T>(fn: () => T): T {
      if (depth > 0) throw new Error('nested transactions are not supported');
      depth++;
      raw.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        raw.exec('COMMIT');
        return result;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      } finally {
        depth--;
      }
    },
    close: () => {
      try {
        raw.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      } finally {
        raw.close();
      }
    },
  };
}
