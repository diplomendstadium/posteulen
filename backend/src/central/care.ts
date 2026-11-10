/**
 * v0.8.3: care of a visiting owl of a control-centre bot (SPEC 10.7). It has no owl row: the
 * daily care is remembered per flight (`bot_owl_care`), energy and motivation live in the flight.
 * All four kinds are free for the host. Each kind counts once a day: it raises the motivation by
 * 0.1, but never above 1.2 – an owl of a bot that is already more motivated keeps its motivation.
 * Biscuit and snack add energy as with every owl; the rest of the flight is planned anew.
 */
import { MOTIVATION } from '@posteulen/shared/constants.ts';
import { energyAfterFeeding, energyAfterSnack } from '@posteulen/shared/game/energy.ts';
import type { Interaction } from '@posteulen/shared/game/motivation.ts';
import { speciesById } from '@posteulen/shared/game/owls.ts';
import type { Context } from '../context.ts';
import { HttpError } from '../http/errors.ts';
import {
  flightPosition,
  profileFor,
  replanFlight,
  routeOf,
  type FlightRow,
} from '../flights/service.ts';

/** Kinds of care given to this bot owl today. */
export function botCareToday(ctx: Context, flightId: string, today: string): Set<Interaction> {
  return new Set(
    ctx.db
      .all<{ kind: Interaction }>(
        'SELECT kind FROM bot_owl_care WHERE flight_id = ? AND day = ?',
        flightId,
        today,
      )
      .map((row) => row.kind),
  );
}

/** Motivation in tenths after one kind of care (once a day; never lowered, at most 1.2). */
export function botMotivationAfter(tenths: number, alreadyToday: boolean): number {
  if (alreadyToday || tenths >= MOTIVATION.MAX) return tenths;
  return Math.min(MOTIVATION.MAX, tenths + MOTIVATION.STEP);
}

/** Inside the caller's transaction. */
export function careForBotOwl(
  ctx: Context,
  flight: FlightRow,
  kind: Interaction,
  today: string,
  now: number,
): void {
  const species = speciesById(flight.owl_species);
  if (!species) throw new HttpError(404, 'not_found');
  const done = botCareToday(ctx, flight.id, today);
  // Like every owl: water, biscuit and snack once a day, petting as often as one likes.
  if (kind === 'feed' && done.has('feed')) throw new HttpError(400, 'owl_fed_today');
  if (kind === 'water' && done.has('water')) throw new HttpError(400, 'owl_watered_today');
  if (kind === 'snack' && done.has('snack')) throw new HttpError(400, 'owl_snacked_today');
  ctx.db.run(
    `INSERT INTO bot_owl_care (flight_id, kind, day) VALUES (?, ?, ?)
     ON CONFLICT (flight_id, kind) DO UPDATE SET day = excluded.day`,
    flight.id,
    kind,
    today,
  );
  const stored = JSON.parse(flight.profile) as { motivation?: number };
  const tenths = Math.round((stored.motivation ?? 1) * 10);
  const motivation = botMotivationAfter(tenths, done.has(kind));
  const current = flightPosition(flight, now)?.energy ?? 0;
  const energy =
    kind === 'feed'
      ? energyAfterFeeding(current, species)
      : kind === 'snack'
        ? energyAfterSnack(current, species)
        : undefined;
  if (motivation === tenths && energy === undefined) return;
  replanFlight(ctx, flight, routeOf(flight), now, {
    ...(motivation !== tenths
      ? { profile: profileFor(ctx, flight.owl_species, false, motivation) }
      : {}),
    adjust: (state) => (energy === undefined ? state : { ...state, energy }),
  });
}
