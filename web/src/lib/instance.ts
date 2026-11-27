/**
 * v1.3.2: the public figures of this instance and the address of the app on the web (SPEC 8.1),
 * fetched once per page load for "Über diese Instanz" and the installation hint of the start
 * page. Opened through the onion address, the hint names the web address (a phone adds the app
 * from there, not through Tor).
 */
import { api } from './api.ts';

export interface InstanceInfo {
  readonly host: string;
  readonly stats: {
    readonly accountsCreated: number;
    readonly accountsCurrent: number;
    readonly active30: number;
    readonly letters: { readonly total: number; readonly last7: number };
    readonly owls: number;
  };
  /**
   * v1.4: the addresses of this instance – start page, admin panel and bots control centre on
   * the web and (while Tor runs and their switch is on) in the Tor network; null: not offered.
   */
  readonly links?: {
    /** v1.4.2: null on a Tor-only instance (SPEC 16.6). */
    readonly web: string | null;
    readonly admin: string | null;
    readonly bots: string | null;
    readonly webOnion: string | null;
    readonly adminOnion: string | null;
    readonly botsOnion: string | null;
  };
}

let pending: Promise<InstanceInfo | null> | null = null;

export function instanceInfo(): Promise<InstanceInfo | null> {
  pending ??= api<InstanceInfo>('GET', '/api/instance', undefined, { context: null }).catch(() => {
    pending = null; // tried again next time (offline, older server)
    return null;
  });
  return pending;
}

/** The host to name in the installation hint: the web address, also on the onion page. */
export function installHost(pageHost: string, webHost: string | null): string | null {
  if (!pageHost.endsWith('.onion')) return pageHost;
  return webHost;
}
