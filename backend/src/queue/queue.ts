/**
 * Event queue (SPEC 4.5, SPEC Anhang L.5): one worker in the server process sleeps until the
 * next due event (at most one hour), processes due events in time order, each in its own
 * transaction together with deleting the event – idempotent handlers make duplicates harmless.
 * The due time is the logical time ("now") for the handler, also when catching up.
 */
import { OPERATIONS, TIME } from '@posteulen/shared/constants.ts';
import type { Database } from '../db/database.ts';
import { logError } from '../ops/error-log.ts';
import { utcDay } from '../security/ids.ts';

export interface QueuedEvent {
  readonly id: number;
  readonly type: string;
  readonly ref: string;
  readonly logicalAt: number;
}

/** Runs inside the transaction; may schedule follow-ups and register after-commit work. */
export type Handler = (event: QueuedEvent, tools: { after(work: () => void): void }) => void;

export interface DailyJob {
  readonly name: string;
  readonly hourUtc: number;
  /** true: run once per missed day (daily gold); false: only once, for today. */
  readonly catchUpEveryDay: boolean;
  readonly run: (day: string, logicalAt: number, tools: { after(work: () => void): void }) => void;
}

const MAX_ATTEMPTS = 10;

export class EventQueue {
  private readonly handlers = new Map<string, Handler>();
  private readonly daily = new Map<string, DailyJob>();
  private timer: NodeJS.Timeout | undefined;
  private nextWake = Number.POSITIVE_INFINITY;
  private running = false;
  private stopped = true;
  private readonly db: Database;
  private readonly now: () => number;

  constructor(db: Database, now: () => number) {
    this.db = db;
    this.now = now;
  }

  on(type: string, handler: Handler): void {
    this.handlers.set(type, handler);
  }

  registerDaily(job: DailyJob): void {
    this.daily.set(job.name, job);
    this.on(`daily:${job.name}`, (event, tools) => this.runDaily(job, event, tools));
  }

  /** Schedules an event; call inside the caller's transaction. */
  schedule(type: string, ref: string, dueAt: number): void {
    this.db.run(
      'INSERT INTO scheduled_events (due_at, logical_at, type, ref) VALUES (?, ?, ?, ?)',
      dueAt,
      dueAt,
      type,
      ref,
    );
    if (dueAt < this.nextWake) queueMicrotask(() => this.wake());
  }

  cancel(type: string, ref: string): void {
    this.db.run('DELETE FROM scheduled_events WHERE type = ? AND ref = ?', type, ref);
  }

  /** Makes sure every daily job has its next run scheduled (start-up). */
  ensureDailyJobs(): void {
    const now = this.now();
    for (const job of this.daily.values()) {
      const exists = this.db.get<{ id: number; logical_at: number }>(
        'SELECT id, logical_at FROM scheduled_events WHERE type = ?',
        `daily:${job.name}`,
      );
      if (exists) {
        // v0.7: a job whose hour changed (daily gold 15:00 → 03:00) moves to the new hour of
        // the same day – if that is already past, it runs now and nothing is skipped or paid
        // twice (daily_job_runs).
        const at = dayStart(utcDay(exists.logical_at)) + job.hourUtc * TIME.HOUR;
        if (at !== exists.logical_at) {
          this.db.run(
            'UPDATE scheduled_events SET due_at = ?, logical_at = ? WHERE id = ?',
            at,
            at,
            exists.id,
          );
        }
        continue;
      }
      this.db.run(
        'INSERT INTO scheduled_events (due_at, logical_at, type, ref) VALUES (?, ?, ?, ?)',
        nextRun(job.hourUtc, now),
        nextRun(job.hourUtc, now),
        `daily:${job.name}`,
        job.name,
      );
    }
  }

  private runDaily(
    job: DailyJob,
    event: QueuedEvent,
    tools: { after(work: () => void): void },
  ): void {
    const now = Math.max(this.now(), event.logicalAt);
    const today = utcDay(now);
    // Days from the scheduled one up to today (catch-up after downtime, SPEC 4.5).
    const days: string[] = [];
    for (let at = event.logicalAt; utcDay(at) <= today; at += TIME.DAY) days.push(utcDay(at));
    const toRun = job.catchUpEveryDay ? days : [today];
    for (const day of days) {
      const inserted = this.db.run(
        'INSERT OR IGNORE INTO daily_job_runs (job, day) VALUES (?, ?)',
        job.name,
        day,
      );
      if (inserted.changes === 1 && toRun.includes(day)) {
        job.run(
          day,
          day === utcDay(event.logicalAt)
            ? event.logicalAt
            : dayStart(day) + job.hourUtc * TIME.HOUR,
          tools,
        );
      }
    }
    const next = nextRun(job.hourUtc, dayStart(today) + job.hourUtc * TIME.HOUR + 1);
    this.db.run(
      'INSERT INTO scheduled_events (due_at, logical_at, type, ref) VALUES (?, ?, ?, ?)',
      next,
      next,
      `daily:${job.name}`,
      job.name,
    );
  }

  /** Processes all events due at `until` (default: now), oldest first. Returns their count. */
  runDue(until: number = this.now()): number {
    let processed = 0;
    for (;;) {
      const row = this.db.get<{
        id: number;
        type: string;
        ref: string;
        logical_at: number;
        attempts: number;
      }>(
        'SELECT id, type, ref, logical_at, attempts FROM scheduled_events WHERE due_at <= ? ORDER BY due_at, id LIMIT 1',
        until,
      );
      if (!row) return processed;
      const handler = this.handlers.get(row.type);
      const after: (() => void)[] = [];
      try {
        this.db.transaction(() => {
          this.db.run('DELETE FROM scheduled_events WHERE id = ?', row.id);
          if (!handler) throw new Error(`no handler for ${row.type}`);
          handler(
            { id: row.id, type: row.type, ref: row.ref, logicalAt: row.logical_at },
            { after: (work) => after.push(work) },
          );
        });
        for (const work of after) {
          try {
            work();
          } catch {
            // After-commit work (SSE, push) must not break the queue.
          }
        }
      } catch {
        // Retry later with back-off; the logical time stays (SPEC 4.5).
        const attempts = row.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          this.db.run('DELETE FROM scheduled_events WHERE id = ?', row.id);
        } else {
          this.db.run(
            'UPDATE scheduled_events SET attempts = ?, due_at = ? WHERE id = ?',
            attempts,
            this.now() + Math.min(TIME.HOUR, 2 ** attempts * TIME.MINUTE),
            row.id,
          );
        }
        logError(
          this.db,
          {
            component: 'Ereignis-Warteschlange',
            severity: attempts >= MAX_ATTEMPTS ? 'error' : 'warning',
            what: `Ereignis „${row.type}“ konnte nicht verarbeitet werden (Versuch ${attempts}).`,
            cause: 'Unerwarteter Zustand oder Programmfehler.',
            action:
              attempts >= MAX_ATTEMPTS
                ? 'Das Ereignis wurde verworfen. Bitte melden.'
                : 'Wird automatisch erneut versucht.',
          },
          this.now(),
        );
      }
      processed++;
    }
  }

  start(): void {
    this.stopped = false;
    this.ensureDailyJobs();
    this.wake();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Re-plans the timer (called after scheduling). */
  wake(): void {
    if (this.stopped || this.running) return;
    this.running = true;
    try {
      this.runDue();
    } finally {
      this.running = false;
    }
    const next = this.db.get<{ due_at: number }>(
      'SELECT MIN(due_at) AS due_at FROM scheduled_events',
    );
    const due = next?.due_at ?? Number.POSITIVE_INFINITY;
    if (this.timer) clearTimeout(this.timer);
    this.nextWake = due;
    const delay = Math.max(0, Math.min(OPERATIONS.WORKER_MAX_SLEEP_MS, due - this.now()));
    this.timer = setTimeout(() => this.wake(), delay);
    this.timer.unref?.();
  }
}

function dayStart(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

export function nextRun(hourUtc: number, after: number): number {
  const start = dayStart(utcDay(after)) + hourUtc * TIME.HOUR;
  return start >= after ? start : start + TIME.DAY;
}
