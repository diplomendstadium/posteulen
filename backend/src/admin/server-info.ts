/**
 * v1.4.3: „Server der Instanz“ in the admin panel (SPEC 13 item 13) – below the load rings:
 * uptime, updates waiting for Debian (apt) and for PostEulen, the nightly automatic updates and
 * the daily check of public blocklists. The main service stays hardened and never asks the
 * network or apt itself: root helpers write small files into the data directory –
 *
 * - `server-info` (`deploy/server-check.sh updates`, every hour): boot time, apt updates,
 *   reboot required, newest PostEulen version of the update source;
 * - `auto-update` (`deploy/auto-update.sh`, every night after the backup): the last run;
 * - `blocklists` (`deploy/server-check.sh blocklists`, once a day; not on a Tor-only instance).
 *
 * The switch of the nightly updates lies in the settings (`auto_update`, default on) and is
 * mirrored into `auto-update-switch`, which the night helper reads.
 */
import fs from 'node:fs';
import path from 'node:path';
import { VERSION } from '@posteulen/shared/version.ts';
import type { Context } from '../context.ts';
import type { Database } from '../db/database.ts';
import { logError } from '../ops/error-log.ts';

const MAX_FILE_BYTES = 64 * 1024;

export type BlocklistGroup = 'spam_ip' | 'spam_domain' | 'ads';
export type BlocklistState = 'clean' | 'listed' | 'unknown';

/** The lists the helper asks (its ids), with name and group for the panel. */
export const BLOCKLISTS: Readonly<Record<string, { name: string; group: BlocklistGroup }>> = {
  'zen.spamhaus.org': { name: 'Spamhaus ZEN', group: 'spam_ip' },
  'bl.spamcop.net': { name: 'SpamCop', group: 'spam_ip' },
  'dnsbl-1.uceprotect.net': { name: 'UCEPROTECT Level 1', group: 'spam_ip' },
  'psbl.surriel.com': { name: 'PSBL', group: 'spam_ip' },
  'bl.mailspike.net': { name: 'Mailspike', group: 'spam_ip' },
  'dbl.spamhaus.org': { name: 'Spamhaus DBL', group: 'spam_domain' },
  'multi.surbl.org': { name: 'SURBL', group: 'spam_domain' },
  'multi.uribl.com': { name: 'URIBL', group: 'spam_domain' },
  stevenblack: { name: 'StevenBlack Hosts', group: 'ads' },
  'hagezi-pro': { name: 'HaGeZi Pro', group: 'ads' },
  'oisd-big': { name: 'OISD big', group: 'ads' },
};

export interface BlocklistResult {
  readonly list: string;
  readonly name: string;
  readonly group: BlocklistGroup;
  /** IP address or host name that was checked (or found). */
  readonly target: string;
  readonly state: BlocklistState;
}

export interface ServerInfo {
  /** Installed version of PostEulen. */
  readonly version: string;
  /** Last hourly check (ms), null before the first one. */
  readonly checkedAt: number | null;
  /** Start of the server (ms), for the uptime. */
  readonly bootAt: number | null;
  /** Updates waiting for Debian: a count, or null if apt could not be asked. */
  readonly aptUpdates: number | null;
  readonly rebootRequired: boolean;
  /** Newest version at the update source (without „v“), null if unknown. */
  readonly latest: string | null;
  /** A newer version of PostEulen than the installed one is available. */
  readonly updateAvailable: boolean | null;
  readonly autoUpdate: {
    readonly enabled: boolean;
    readonly lastRunAt: number | null;
    readonly result: 'ok' | 'error' | 'off' | 'skipped' | null;
    readonly aptUpgraded: number | null;
    readonly posteulen: 'current' | 'updated' | 'error' | null;
    readonly rebooted: boolean;
  };
  readonly blocklists:
    | { readonly torOnly: true }
    | {
        readonly torOnly: false;
        readonly checkedAt: number | null;
        readonly results: readonly BlocklistResult[];
      };
}

/** `key=value` lines; anything else is skipped. */
export function parseKeyValues(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split('\n')) {
    const match = /^([a-z_]{1,40})=(.{0,200})$/.exec(line.trim());
    const [, key, value] = match ?? [];
    if (key !== undefined && value !== undefined) values.set(key, value);
  }
  return values;
}

const seconds = (value: string | undefined): number | null =>
  value !== undefined && /^\d{1,12}$/.test(value) ? Number(value) * 1000 : null;
const count = (value: string | undefined): number | null =>
  value !== undefined && /^\d{1,6}$/.test(value) ? Number(value) : null;

/** Compares versions like `1.4.3` and `1.4.3-stufe.2` (a pre-release is older). */
export function compareVersions(a: string, b: string): number {
  const split = (version: string) => {
    const [core = '', pre] = version.replace(/^v/, '').split('-', 2);
    return { core: core.split('.').map((part) => Number(part) || 0), pre: pre ?? null };
  };
  const left = split(a);
  const right = split(b);
  for (let i = 0; i < 3; i++) {
    const diff = (left.core[i] ?? 0) - (right.core[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  if (left.pre === right.pre) return 0;
  if (left.pre === null) return 1;
  if (right.pre === null) return -1;
  return left.pre.localeCompare(right.pre, 'en', { numeric: true });
}

/** The blocklist file: a header (`checked_at=…`, `tor_only=1`) and `result <list> <target> <state>`. */
export function parseBlocklists(text: string): {
  checkedAt: number | null;
  torOnly: boolean;
  results: BlocklistResult[];
} {
  const header = parseKeyValues(text);
  const results: BlocklistResult[] = [];
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 4 || parts[0] !== 'result') continue;
    const [, list = '', target = '', state = ''] = parts;
    const known = BLOCKLISTS[list];
    if (!known || !/^[A-Za-z0-9.:-]{1,253}$/.test(target)) continue;
    if (state !== 'clean' && state !== 'listed' && state !== 'unknown') continue;
    results.push({ list, name: known.name, group: known.group, target, state });
  }
  return {
    checkedAt: seconds(header.get('checked_at')),
    torOnly: header.get('tor_only') === '1',
    results,
  };
}

function readSmall(file: string): string {
  try {
    const handle = fs.openSync(file, 'r');
    try {
      const buffer = Buffer.alloc(MAX_FILE_BYTES);
      const length = fs.readSync(handle, buffer, 0, MAX_FILE_BYTES, 0);
      return buffer.subarray(0, length).toString('utf8');
    } finally {
      fs.closeSync(handle);
    }
  } catch {
    // Not written yet (local preview, fresh server, timer not run yet).
    return '';
  }
}

function setting(db: Database, key: string): string | undefined {
  return db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)?.value;
}

/** The nightly updates are on unless the admin switched them off (default on). */
export function autoUpdateEnabled(db: Database): boolean {
  return setting(db, 'auto_update') !== '0';
}

/**
 * Writes the switch file for the night helper if its content differs (also at every start, e.g.
 * after restoring a backup). A failure is logged; the helper then keeps the previous state.
 */
export function syncAutoUpdateSwitch(ctx: Context): void {
  const file = ctx.config.autoUpdateSwitchFile;
  const wanted = autoUpdateEnabled(ctx.db) ? 'on\n' : 'off\n';
  try {
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === wanted) return;
    const temporary = path.join(path.dirname(file), `.auto-update-switch.${process.pid}`);
    fs.writeFileSync(temporary, wanted, { mode: 0o644 });
    fs.renameSync(temporary, file);
  } catch (error) {
    logError(
      ctx.db,
      {
        component: 'Automatische Updates',
        severity: 'error',
        what: 'Der Schalter für die automatischen Updates konnte nicht an den Server weitergegeben werden.',
        cause: error instanceof Error ? error.message : 'Unbekannter Fehler.',
        action: `Rechte von ${path.dirname(file)} prüfen und den Schalter erneut setzen.`,
      },
      ctx.now(),
    );
  }
}

export function setAutoUpdate(ctx: Context, enabled: boolean): void {
  ctx.db.run(
    `INSERT INTO settings (key, value) VALUES ('auto_update', ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    enabled ? '1' : '0',
  );
  syncAutoUpdateSwitch(ctx);
}

export function serverInfo(ctx: Context): ServerInfo {
  const info = parseKeyValues(readSmall(ctx.config.serverInfoFile));
  const run = parseKeyValues(readSmall(ctx.config.autoUpdateFile));
  const latestTag = info.get('posteulen_latest') ?? '';
  const latest = /^v?\d+\.\d+\.\d+(-[A-Za-z0-9.]+)?$/.test(latestTag)
    ? latestTag.replace(/^v/, '')
    : null;
  const result = run.get('result');
  const posteulen = run.get('posteulen');
  const blocklists = parseBlocklists(readSmall(ctx.config.blocklistFile));
  return {
    version: VERSION,
    checkedAt: seconds(info.get('checked_at')),
    bootAt: seconds(info.get('boot_at')),
    aptUpdates: info.get('apt_ok') === '1' ? count(info.get('apt_updates')) : null,
    rebootRequired: info.get('reboot_required') === '1',
    latest,
    updateAvailable: latest === null ? null : compareVersions(latest, VERSION) > 0,
    autoUpdate: {
      enabled: autoUpdateEnabled(ctx.db),
      lastRunAt: seconds(run.get('run_at')),
      result:
        result === 'ok' || result === 'error' || result === 'off' || result === 'skipped'
          ? result
          : null,
      aptUpgraded: count(run.get('apt_upgraded')),
      posteulen:
        posteulen === 'current' || posteulen === 'updated' || posteulen === 'error'
          ? posteulen
          : null,
      rebooted: run.get('reboot') === '1',
    },
    // v1.4.3: a Tor-only instance has no domain and no public address to check (SPEC 16.6).
    blocklists: ctx.config.torOnly
      ? { torOnly: true }
      : { torOnly: false, checkedAt: blocklists.checkedAt, results: blocklists.results },
  };
}
