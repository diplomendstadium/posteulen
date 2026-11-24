/**
 * v1.3.2: "Über diese Instanz" on the start page (SPEC 8.1) – a few figures of the admin's
 * statistics (SPEC 13 item 1), public and without login: accounts created in all, accounts
 * existing, active in the last 30 days, letters between people (in all and in the last 7 days)
 * and the owls owned by players (own owls including chicks, as one sum). Only counters, never
 * names; counted at most every ten minutes. Also the address of the app on the web, so the
 * start page opened through the onion address can name it (installation on a phone).
 */
import { INSTANCE_STATS_CACHE_MS } from '@posteulen/shared/constants.ts';
import { adminStats } from '../admin/operations.ts';
import type { Context } from '../context.ts';

export interface InstanceStats {
  readonly accountsCreated: number;
  readonly accountsCurrent: number;
  readonly active30: number;
  readonly letters: { readonly total: number; readonly last7: number };
  readonly owls: number;
}

export function instanceStats(ctx: Context, now: number): InstanceStats {
  const stats = adminStats(ctx, now);
  return {
    accountsCreated: stats.accounts.created,
    accountsCurrent: stats.accounts.current,
    active30: stats.accounts.active30,
    letters: stats.letters,
    owls: stats.owls.reduce((sum, row) => sum + row.count, 0),
  };
}

/** The figures, counted again only after INSTANCE_STATS_CACHE_MS. */
export function cachedInstanceStats(ctx: Context): (now: number) => InstanceStats {
  let cached: { at: number; stats: InstanceStats } | null = null;
  return (now) => {
    if (!cached || now - cached.at >= INSTANCE_STATS_CACHE_MS || now < cached.at) {
      cached = { at: now, stats: instanceStats(ctx, now) };
    }
    return cached.stats;
  };
}

/** Host of the app on the web (e.g. posteulen.de), also when the page is opened through Tor. */
export function webHost(ctx: Context): string {
  return new URL(ctx.config.userOrigin).host;
}
