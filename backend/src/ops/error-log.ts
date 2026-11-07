/**
 * Readable error log for the admin panel (SPEC 13 item 7): time, component, severity, what
 * happened, likely cause, what to do – never personal data. Kept for 30 days after the last
 * occurrence.
 *
 * v0.6.1: the same message (component, severity, what, cause) within an hour of its last
 * occurrence counts up the existing entry instead of adding a new one, so a recurring problem
 * (e.g. a push service that keeps refusing) cannot fill the database. A recurrence marks the
 * entry as unread again.
 */
import { OPERATIONS, SECURITY, TIME } from '@posteulen/shared/constants.ts';
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
  const merged = db.run(
    `UPDATE error_log SET count = count + 1, last_at = ?, read = 0, action = ?
      WHERE id = (SELECT id FROM error_log
                   WHERE component = ? AND severity = ? AND what = ? AND cause = ? AND last_at >= ?
                   ORDER BY last_at DESC LIMIT 1)`,
    now,
    entry.action,
    entry.component,
    entry.severity,
    entry.what,
    entry.cause,
    now - SECURITY.ERROR_LOG_MERGE_MINUTES * TIME.MINUTE,
  );
  if (merged.changes === 0) {
    db.run(
      'INSERT INTO error_log (at, last_at, component, severity, what, cause, action) VALUES (?, ?, ?, ?, ?, ?, ?)',
      now,
      now,
      entry.component,
      entry.severity,
      entry.what,
      entry.cause,
      entry.action,
    );
  }
  pruneErrorLog(db, now);
}

/** Entries whose last occurrence is older than the retention period go (SPEC 13 item 7). */
export function pruneErrorLog(db: Database, now: number): void {
  db.run(
    'DELETE FROM error_log WHERE COALESCE(last_at, at) < ?',
    now - OPERATIONS.ERROR_LOG_RETENTION_DAYS * TIME.DAY,
  );
}
