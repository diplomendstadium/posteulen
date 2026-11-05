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

export function setGold(name: string, tenths: number, instance: 'main' | 'admin' = 'main'): void {
  const db = new DatabaseSync(databaseOf(instance));
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    const result = db.prepare('UPDATE users SET gold = ? WHERE name_display = ?').run(tenths, name);
    if (result.changes !== 1) throw new Error(`no account ${name}`);
  } finally {
    db.close();
  }
}
