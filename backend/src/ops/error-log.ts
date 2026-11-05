/**
 * Readable error log for the admin panel (SPEC 13 item 7): time, component, severity, what
 * happened, likely cause, what to do – never personal data. Kept for 30 days.
 */
import { OPERATIONS, TIME } from '@posteulen/shared/constants.ts';
import type { Database } from '../db/database.ts';

export type Severity = 'info' | 'warning' | 'error';

export interface ErrorEntry {
  readonly component: string;
  readonly severity: Severity;
  readonly what: string;
  readonly cause: string;
  readonly action: string;
}

export function logError(db: Database, entry: ErrorEntry, now: number): void {
  db.run(
    'INSERT INTO error_log (at, component, severity, what, cause, action) VALUES (?, ?, ?, ?, ?, ?)',
    now,
    entry.component,
    entry.severity,
    entry.what,
    entry.cause,
    entry.action,
  );
  db.run(
    'DELETE FROM error_log WHERE at < ?',
    now - OPERATIONS.ERROR_LOG_RETENTION_DAYS * TIME.DAY,
  );
}
