/**
 * v1.2.4: the kilometres an own owl has flown in all (SPEC 9.2). Every finished flight adds
 * the distance of its plan; the flights from before the update are counted once.
 */
import { flownKm, type Segment } from '@posteulen/shared/game/flight.ts';
import type { Context } from '../context.ts';
import { announceGlobe } from './globe.ts';

/** Adds the flown distance of a finished flight to its owl (own owls only). */
export function addFlownKm(ctx: Context, flight: { owl_id: string | null; plan: string }): void {
  if (!flight.owl_id) return;
  const km = flownKm(JSON.parse(flight.plan) as Segment[]);
  if (!(km > 0)) return;
  ctx.db.run(
    "UPDATE owls SET km_flown = km_flown + ? WHERE id = ? AND kind = 'own'",
    km,
    flight.owl_id,
  );
}

/**
 * v1.3: after the kilometres of a finished flight – the 🌍 badge is announced once when the
 * owl has passed the Earth's circumference (SPEC 9.2.1).
 */
export function afterFlownKm(ctx: Context, flight: { owl_id: string | null }, now: number): void {
  if (flight.owl_id) announceGlobe(ctx, flight.owl_id, now);
}

/**
 * Once after the update to v1.2.4: all finished flights of own owls that are still stored
 * (flights of deleted accounts are gone). Returns the number of flights counted.
 */
export function backfillFlownKm(ctx: Context): number {
  if (ctx.db.get("SELECT 1 FROM meta WHERE key = 'km_backfill'")) return 0;
  return ctx.db.transaction(() => {
    const flights = ctx.db.all<{ owl_id: string; plan: string }>(
      `SELECT f.owl_id, f.plan FROM flights f JOIN owls o ON o.id = f.owl_id
        WHERE f.state = 'done' AND o.kind = 'own'`,
    );
    for (const flight of flights) addFlownKm(ctx, flight);
    ctx.db.run("INSERT INTO meta (key, value) VALUES ('km_backfill', '1')");
    return flights.length;
  });
}
