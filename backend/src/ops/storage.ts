/**
 * v1.4.2: free space for the database (SPEC 13 item 14). The database must never fill the whole
 * partition: at or below the barrier (3 GB by default) players cannot write letters, open
 * registration takes invite codes only, and every player sees a banner. Only when more than the
 * warning value (4 GB by default) is free again does all return to how it was (hysteresis).
 * At or below the warning value the admin gets a note in the error log.
 *
 * The server measures with `statfs` on the data directory when it needs to know (sending a
 * letter, registering, loading the banners, the admin panel) – at most once a minute, no timer
 * of its own. The state is kept in `settings`, so it survives a restart.
 */
import fs from 'node:fs';
import { STORAGE, TIME } from '@posteulen/shared/constants.ts';
import type { Context } from '../context.ts';
import type { Database } from '../db/database.ts';
import { HttpError } from '../http/errors.ts';
import { logError } from './error-log.ts';

const GB = 1024 ** 3;

export interface StorageLimits {
  /** At or below this many free gigabytes letters and open registration stop. */
  readonly blockGb: number;
  /** At or below this many the admin is warned; above it everything works again. */
  readonly warnGb: number;
}

export interface StorageFlags {
  readonly full: boolean;
  readonly low: boolean;
}

export type StorageChange = 'low' | 'full' | 'recovered';

/** The next state for the free bytes (pure; `null` = unknown, nothing changes). */
export function nextStorage(
  flags: StorageFlags,
  free: number | null,
  limits: StorageLimits,
): { flags: StorageFlags; changes: StorageChange[] } {
  if (free === null) return { flags, changes: [] };
  const low = free <= limits.warnGb * GB;
  const full = free <= limits.blockGb * GB || (flags.full && low);
  const changes: StorageChange[] = [];
  if (low && !flags.low) changes.push('low');
  if (full && !flags.full) changes.push('full');
  if (!full && flags.full) changes.push('recovered');
  return { flags: { full, low }, changes };
}

/** Whole or half gigabytes within the bounds, the warning above the barrier. */
export function validLimits(limits: StorageLimits): boolean {
  const ok = (value: number) =>
    Number.isFinite(value) &&
    value >= STORAGE.MIN_GB &&
    value <= STORAGE.MAX_GB &&
    Number.isInteger(value * 2);
  return ok(limits.blockGb) && ok(limits.warnGb) && limits.warnGb > limits.blockGb;
}

function setting(db: Database, key: string): string | undefined {
  return db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)?.value;
}

function store(db: Database, key: string, value: string): void {
  db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export function storageLimits(db: Database): StorageLimits {
  const read = (key: string, fallback: number): number => {
    const value = Number(setting(db, key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  const limits = {
    blockGb: read('storage_block_gb', STORAGE.BLOCK_GB),
    warnGb: read('storage_warn_gb', STORAGE.WARN_GB),
  };
  return validLimits(limits) ? limits : { blockGb: STORAGE.BLOCK_GB, warnGb: STORAGE.WARN_GB };
}

/** Free bytes for normal users on the partition of the data directory (like `df`). */
export function measureFree(dataDir: string): number | null {
  try {
    const stats = fs.statfsSync(dataDir);
    return stats.bavail * stats.bsize;
  } catch {
    return null;
  }
}

export interface StorageStatus extends StorageFlags {
  readonly freeBytes: number | null;
  readonly limits: StorageLimits;
}

/** Remembers the last measurement for a minute. */
export class StorageWatch {
  private checkedAt = Number.NEGATIVE_INFINITY;
  private freeBytes: number | null = null;

  private readonly measure: () => number | null;

  constructor(measure: () => number | null) {
    this.measure = measure;
  }

  /** Measures again (at most once a minute, `force` for the admin panel) and applies the rule. */
  status(ctx: Context, now: number, force = false): StorageStatus {
    if (
      force ||
      now - this.checkedAt >= STORAGE.CHECK_SECONDS * (TIME.MINUTE / 60) ||
      now < this.checkedAt
    ) {
      this.checkedAt = now;
      this.freeBytes = this.measure();
      this.apply(ctx, now);
    }
    const limits = storageLimits(ctx.db);
    return {
      full: setting(ctx.db, 'storage_full') === '1',
      low: setting(ctx.db, 'storage_low') === '1',
      freeBytes: this.freeBytes,
      limits,
    };
  }

  private apply(ctx: Context, now: number): void {
    const before = {
      full: setting(ctx.db, 'storage_full') === '1',
      low: setting(ctx.db, 'storage_low') === '1',
    };
    const limits = storageLimits(ctx.db);
    const { flags, changes } = nextStorage(before, this.freeBytes, limits);
    if (changes.length === 0 && flags.low === before.low) return;
    store(ctx.db, 'storage_full', flags.full ? '1' : '0');
    store(ctx.db, 'storage_low', flags.low ? '1' : '0');
    const free = this.freeBytes === null ? '?' : (this.freeBytes / GB).toFixed(1).replace('.', ',');
    for (const change of changes) {
      if (change === 'low')
        logError(
          ctx.db,
          {
            component: 'Speicherplatz',
            severity: 'warning',
            what: `Auf der Partition der Datenbank sind nur noch ${free} GB frei.`,
            cause: `Die Warnschwelle liegt bei ${String(limits.warnGb).replace('.', ',')} GB. Bei ${String(limits.blockGb).replace('.', ',')} GB können Spieler keine Briefe mehr schreiben.`,
            action:
              'Platz schaffen: alte Dateien, Protokolle oder Backups außerhalb von PostEulen löschen oder die Festplatte vergrößern.',
          },
          now,
        );
      if (change === 'full')
        logError(
          ctx.db,
          {
            component: 'Speicherplatz',
            severity: 'error',
            what: `Nur noch ${free} GB frei: Briefe und offene Registrierung sind gesperrt.`,
            cause: `Die Schranke liegt bei ${String(limits.blockGb).replace('.', ',')} GB. Alle Spieler sehen einen Hinweis, dass im Eulenturm Platz geschaffen werden muss.`,
            action: `Platz schaffen, bis mehr als ${String(limits.warnGb).replace('.', ',')} GB frei sind – dann läuft alles von selbst wieder wie vorher.`,
          },
          now,
        );
      if (change === 'recovered')
        logError(
          ctx.db,
          {
            component: 'Speicherplatz',
            severity: 'info',
            what: `Wieder ${free} GB frei: Briefe und Registrierung funktionieren wie vorher.`,
            cause: 'Es ist wieder mehr Platz frei als die Warnschwelle.',
            action: 'Nichts zu tun.',
          },
          now,
        );
    }
    if (changes.includes('full') || changes.includes('recovered'))
      ctx.hub.notifyAll('banners', 'profile');
  }
}

export function storageFull(ctx: Context, now: number): boolean {
  return ctx.storage.status(ctx, now).full;
}

/** Letters and feedback of players stop while the barrier is reached. */
export function requireStorage(ctx: Context, now: number): void {
  if (storageFull(ctx, now)) throw new HttpError(503, 'storage_full');
}

export function setStorageLimits(ctx: Context, limits: StorageLimits, now: number): void {
  store(ctx.db, 'storage_block_gb', String(limits.blockGb));
  store(ctx.db, 'storage_warn_gb', String(limits.warnGb));
  // Measured again right away, so the new values apply at once.
  ctx.storage.status(ctx, now, true);
}
