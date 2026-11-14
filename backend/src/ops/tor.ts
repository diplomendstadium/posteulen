/**
 * v0.9: the onion service (SPEC 16.5). The same player app answers on the clearnet domain and,
 * once the server scripts have set up Tor, on an onion address – same accounts, letters and game
 * states, and still one active session per account for the whole instance.
 *
 * - The admin panel switches Tor on and off (`tor_enabled`, default on). The backend mirrors the
 *   switch into a small file; a root helper (systemd path unit, deploy/tor.sh apply) then starts
 *   or stops the Tor service and adds or removes the onion site and the Onion-Location header.
 * - The server scripts report the state of Tor (`tor_status`: ok, error, off) through
 *   `posteulen-cli tor-status`; errors also land in the error log of the admin panel.
 * - The footer link „Tor-Netz“ appears only when Tor is set up, switched on and not failed.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Context } from '../context.ts';
import type { Database } from '../db/database.ts';
import { logError } from './error-log.ts';

export type TorState = 'ok' | 'error' | 'off';
const STATES: readonly TorState[] = ['ok', 'error', 'off'];

export interface TorStatus {
  readonly state: TorState;
  readonly at: number;
  readonly message: string | null;
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

/** Tor is on unless the admin switched it off (SPEC 16.5: on by default). */
export function torEnabled(db: Database): boolean {
  return setting(db, 'tor_enabled') !== '0';
}

export function torStatus(db: Database): TorStatus | null {
  const raw = setting(db, 'tor_status');
  if (raw === undefined) return null;
  try {
    const value = JSON.parse(raw) as Partial<TorStatus>;
    if (!STATES.includes(value.state as TorState) || typeof value.at !== 'number') return null;
    return {
      state: value.state as TorState,
      at: value.at,
      message: typeof value.message === 'string' ? value.message : null,
    };
  } catch {
    return null;
  }
}

export function setTorStatus(
  db: Database,
  state: TorState,
  now: number,
  message: string | null = null,
): void {
  store(db, 'tor_status', JSON.stringify({ state, at: now, message }));
}

/**
 * Reports a failure of Tor (server scripts, systemd OnFailure): status „error“ and an entry in the
 * error log. The regular site keeps running (SPEC 16.5).
 */
export function reportTorError(
  db: Database,
  now: number,
  entry: { what: string; cause: string; action: string },
): void {
  setTorStatus(db, 'error', now, entry.what);
  logError(db, { component: 'Tor', severity: 'error', ...entry }, now);
}

/** The content of the switch file the root helper reads: exactly „on“ or „off“. */
function switchContent(enabled: boolean): string {
  return enabled ? 'on\n' : 'off\n';
}

/**
 * Writes the switch file if its content differs (also at every start, e.g. after restoring a
 * backup with Tor switched off). Written atomically; a failure is logged and never breaks the
 * app – Tor then simply keeps its previous state.
 */
export function syncTorSwitch(ctx: Context): void {
  const file = ctx.config.torSwitchFile;
  const wanted = switchContent(torEnabled(ctx.db));
  try {
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === wanted) return;
    const temporary = path.join(path.dirname(file), `.tor-switch.${process.pid}`);
    fs.writeFileSync(temporary, wanted, { mode: 0o644 });
    fs.renameSync(temporary, file);
  } catch (error) {
    logError(
      ctx.db,
      {
        component: 'Tor',
        severity: 'error',
        what: 'Der Tor-Schalter konnte nicht an den Server weitergegeben werden.',
        cause: error instanceof Error ? error.message : 'Unbekannter Fehler.',
        action: `Rechte von ${path.dirname(file)} prüfen und den Schalter erneut setzen.`,
      },
      ctx.now(),
    );
  }
}

export function setTorEnabled(ctx: Context, enabled: boolean): void {
  store(ctx.db, 'tor_enabled', enabled ? '1' : '0');
  syncTorSwitch(ctx);
}

/** The onion address of this instance (from the server configuration), if Tor is set up. */
export function onionAddress(ctx: Context): string | null {
  return ctx.config.torOrigin ?? null;
}

/**
 * Target of the footer link „Tor-Netz“ (SPEC 8.1): only when Tor is set up, switched on and has
 * not failed – and not on the onion site itself.
 */
export function footerOnionLink(ctx: Context, viaTor: boolean): string | null {
  const origin = onionAddress(ctx);
  if (origin === null || viaTor || !torEnabled(ctx.db)) return null;
  return torStatus(ctx.db)?.state === 'ok' ? `${origin}/` : null;
}

/** Overview for the admin panel (SPEC 13 item 9). */
export function torOverview(ctx: Context) {
  const status = torStatus(ctx.db);
  return {
    onion: onionAddress(ctx),
    enabled: torEnabled(ctx.db),
    status: status?.state ?? null,
    statusAt: status?.at ?? null,
    message: status?.message ?? null,
  };
}
