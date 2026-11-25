/**
 * Holiday mode (SPEC 8.10, 9.12): up to three holidays a year of up to six weeks, planned ahead
 * or starting at once. While a holiday runs, the player's own owls – chicks included – stay at the
 * owl care station on the island of Inchlonaig in Loch Lomond: they fly there straight away (an
 * owl that is away, sick, brooding or still waiting for its gift decision joins as soon as it is
 * home and free), and they set off back in time to be home exactly when the holiday ends. Ended
 * early, they fly home at once. Meanwhile the player counts as active, the owls neither fall ill
 * nor get bored nor lose motivation.
 */
import { TIME, VACATION } from '@posteulen/shared/constants.ts';
import { speciesById } from '@posteulen/shared/game/owls.ts';
import {
  endTripEarly,
  inactivityReference,
  islandArrival,
  planTrip,
  tripAfterMove,
  tripPosition,
  vacationProblem,
  vacationSpeedKmh,
  vacationsUsed,
  vacationYear,
  type TripPhase,
  type VacationState,
  type VacationTrip,
} from '@posteulen/shared/game/vacation.ts';
import { isDay } from '@posteulen/shared/game/sun.ts';
import type { Context } from '../context.ts';
import { HttpError } from '../http/errors.ts';
import { randomId, utcDay } from '../security/ids.ts';
import { addSystemMessage } from '../messages/system.ts';
import { homeOf } from '../flights/service.ts';
import { owlLabel } from './globe.ts';
import { backHome, leftHome } from './care.ts';

type After = (work: () => void) => void;

export interface VacationRow {
  readonly id: string;
  readonly user_id: string;
  readonly starts_at: number;
  readonly ends_at: number;
  readonly state: VacationState;
  readonly ended_at: number | null;
  readonly active_ref: string | null;
  readonly created_at: number;
}

interface TripRow {
  readonly owl_id: string;
  readonly user_id: string;
  readonly from_lat: number;
  readonly from_lon: number;
  readonly out_at: number;
  readonly speed_kmh: number;
  readonly back_lat: number;
  readonly back_lon: number;
  readonly back_at: number;
  readonly home_lat: number;
  readonly home_lon: number;
  readonly home_at: number;
}

function tripOf(row: TripRow): VacationTrip {
  return {
    from: { lat: row.from_lat, lon: row.from_lon },
    outAt: row.out_at,
    speedKmh: row.speed_kmh,
    backFrom: { lat: row.back_lat, lon: row.back_lon },
    backAt: row.back_at,
    home: { lat: row.home_lat, lon: row.home_lon },
    homeAt: row.home_at,
  };
}

function saveTrip(ctx: Context, owlId: string, userId: string, trip: VacationTrip): void {
  ctx.db.run(
    `INSERT INTO owl_vacations (owl_id, user_id, from_lat, from_lon, out_at, speed_kmh, back_lat, back_lon,
                                back_at, home_lat, home_lon, home_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (owl_id) DO UPDATE SET from_lat = excluded.from_lat, from_lon = excluded.from_lon,
       out_at = excluded.out_at, speed_kmh = excluded.speed_kmh, back_lat = excluded.back_lat,
       back_lon = excluded.back_lon, back_at = excluded.back_at, home_lat = excluded.home_lat,
       home_lon = excluded.home_lon, home_at = excluded.home_at`,
    owlId,
    userId,
    trip.from.lat,
    trip.from.lon,
    trip.outAt,
    trip.speedKmh,
    trip.backFrom.lat,
    trip.backFrom.lon,
    trip.backAt,
    trip.home.lat,
    trip.home.lon,
    trip.homeAt,
  );
  ctx.queue.cancel('vacation_owl_home', owlId);
  ctx.queue.schedule('vacation_owl_home', owlId, trip.homeAt);
}

export function vacationsOf(ctx: Context, userId: string): VacationRow[] {
  return ctx.db.all<VacationRow>(
    'SELECT * FROM vacations WHERE user_id = ? ORDER BY starts_at, id',
    userId,
  );
}

/** The running holiday of a player, if any. */
export function activeVacation(ctx: Context, userId: string): VacationRow | undefined {
  return ctx.db.get<VacationRow>(
    "SELECT * FROM vacations WHERE user_id = ? AND state = 'active'",
    userId,
  );
}

/** Players on holiday right now (daily jobs: no sickness, no boredom, motivation stays). */
export function usersOnVacation(ctx: Context): Set<string> {
  return new Set(
    ctx.db
      .all<{ user_id: string }>("SELECT user_id FROM vacations WHERE state = 'active'")
      .map((row) => row.user_id),
  );
}

/** For the settings, the banner and the profile (SPEC 8.10). */
export function vacationView(ctx: Context, userId: string, now: number) {
  const all = vacationsOf(ctx, userId);
  const current = all.find((row) => row.state === 'planned' || row.state === 'active');
  const records = all.map((row) => ({
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    state: row.state,
  }));
  const year = vacationYear(now);
  return {
    current: current
      ? { startsAt: current.starts_at, endsAt: current.ends_at, active: current.state === 'active' }
      : null,
    perYear: VACATION.PER_YEAR,
    usedThisYear: vacationsUsed(year, records),
    usedNextYear: vacationsUsed(year + 1, records),
  };
}

/** Plans a holiday (inside a transaction); it begins at once if its start is now. */
export function planVacation(
  ctx: Context,
  userId: string,
  input: { startsAt: number | null; endsAt: number },
  now: number,
  after: After,
): void {
  const startsAt = input.startsAt === null ? now : Math.max(input.startsAt, now);
  const existing = vacationsOf(ctx, userId).map((row) => ({
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    state: row.state,
  }));
  const problem = vacationProblem({
    startsAt: input.startsAt ?? now,
    endsAt: input.endsAt,
    now,
    existing,
  });
  if (problem) throw new HttpError(400, problem);
  const id = randomId();
  ctx.db.run(
    "INSERT INTO vacations (id, user_id, starts_at, ends_at, state, created_at) VALUES (?, ?, ?, ?, 'planned', ?)",
    id,
    userId,
    startsAt,
    input.endsAt,
    now,
  );
  if (startsAt <= now) startVacation(ctx, id, now, after);
  else ctx.queue.schedule('vacation_start', id, startsAt);
  after(() => ctx.hub.notify(userId, 'profile'));
}

/** A planned holiday is called off before it began – it does not count. */
export function cancelVacation(ctx: Context, userId: string, after: After): void {
  const row = ctx.db.get<VacationRow>(
    "SELECT * FROM vacations WHERE user_id = ? AND state = 'planned'",
    userId,
  );
  if (!row) throw new HttpError(400, 'vacation_none');
  ctx.db.run("UPDATE vacations SET state = 'cancelled' WHERE id = ?", row.id);
  ctx.queue.cancel('vacation_start', row.id);
  after(() => ctx.hub.notify(userId, 'profile'));
}

/** The holiday begins: the owls set off for the island (SPEC 9.12). */
function startVacation(ctx: Context, id: string, at: number, after: After): void {
  const row = ctx.db.get<VacationRow>('SELECT * FROM vacations WHERE id = ?', id);
  if (!row || row.state !== 'planned') return;
  const user = ctx.db.get<{ last_active_date: string; idle_ref: string | null; state: string }>(
    'SELECT last_active_date, idle_ref, state FROM users WHERE id = ?',
    row.user_id,
  );
  if (!user || user.state === 'deleting') return;
  // Inactivity counted from here on before the holiday (the later of the two days).
  const before =
    user.idle_ref !== null && user.idle_ref > user.last_active_date
      ? user.idle_ref
      : user.last_active_date;
  ctx.db.run(
    "UPDATE vacations SET state = 'active', starts_at = ?, active_ref = ? WHERE id = ?",
    at,
    before,
    id,
  );
  // While the holiday runs the player counts as active (9.10).
  ctx.db.run('UPDATE users SET idle_ref = ? WHERE id = ?', utcDay(row.ends_at), row.user_id);
  ctx.queue.cancel('vacation_end', id);
  ctx.queue.schedule('vacation_end', id, row.ends_at);
  addSystemMessage(ctx, row.user_id, 'vacation_started', { until: row.ends_at }, at, after);
  sendOwlsOnVacation(ctx, row.user_id, at, after);
  after(() => ctx.hub.notify(row.user_id, 'profile', 'owls', 'map'));
}

/** The holiday is over (on time or early): inactivity counts on from a later day. */
function closeVacation(ctx: Context, row: VacationRow, at: number, after: After): void {
  ctx.db.run("UPDATE vacations SET state = 'done', ended_at = ? WHERE id = ?", at, row.id);
  ctx.queue.cancel('vacation_end', row.id);
  const user = ctx.db.get<{ last_active_date: string }>(
    'SELECT last_active_date FROM users WHERE id = ?',
    row.user_id,
  );
  if (user) {
    const last =
      row.active_ref !== null && row.active_ref > user.last_active_date
        ? row.active_ref
        : user.last_active_date;
    ctx.db.run(
      'UPDATE users SET idle_ref = ? WHERE id = ?',
      inactivityReference(last, row.starts_at, at),
      row.user_id,
    );
  }
  after(() => ctx.hub.notify(row.user_id, 'profile', 'owls', 'map'));
}

function finishVacation(ctx: Context, id: string, at: number, after: After): void {
  const row = ctx.db.get<VacationRow>('SELECT * FROM vacations WHERE id = ?', id);
  if (!row || row.state !== 'active') return;
  closeVacation(ctx, row, at, after);
  addSystemMessage(ctx, row.user_id, 'vacation_ended', {}, at, after);
}

/** Ended early (SPEC 8.10): all owls fly home at once. */
export function endVacation(ctx: Context, userId: string, now: number, after: After): void {
  const row = activeVacation(ctx, userId);
  if (!row) throw new HttpError(400, 'vacation_none');
  closeVacation(ctx, row, now, after);
  for (const trip of ctx.db.all<TripRow>('SELECT * FROM owl_vacations WHERE user_id = ?', userId)) {
    saveTrip(ctx, trip.owl_id, userId, endTripEarly(tripOf(trip), now));
  }
  addSystemMessage(ctx, userId, 'vacation_ended_early', {}, now, after);
}

/**
 * Sends every own owl that is at home and free on holiday – at the start, and later whenever an
 * owl comes home or becomes free (named, healthy, hatched, its gift decided). Not while less than
 * two hours of the holiday are left.
 */
export function sendOwlsOnVacation(ctx: Context, userId: string, now: number, after?: After): void {
  const vacation = activeVacation(ctx, userId);
  if (!vacation || vacation.ends_at - now < VACATION.MIN_TRIP_HOURS * TIME.HOUR) return;
  const owls = ctx.db.all<{
    id: string;
    species: string;
    is_chick: number;
    name: string;
    km_flown: number;
  }>(
    `SELECT o.id, o.species, o.is_chick, o.name, o.km_flown FROM owls o
       LEFT JOIN clutches c ON c.id = o.clutch_id
      WHERE o.owner_id = ? AND o.kind = 'own' AND o.state = 'home' AND o.name IS NOT NULL
        AND NOT (o.is_chick = 1 AND COALESCE(c.gift_state, '') = 'open')`,
    userId,
  );
  if (owls.length === 0) return;
  const home = homeOf(ctx, userId);
  for (const owl of owls) {
    const species = speciesById(owl.species);
    if (!species) continue;
    const trip = planTrip({
      at: home,
      now,
      endsAt: vacation.ends_at,
      home,
      speedKmh: vacationSpeedKmh(species.speedFactor, owl.is_chick === 1),
    });
    // Rested and cared for at the station: full energy on the way and back home.
    ctx.db.run(
      "UPDATE owls SET state = 'vacation', energy = ?, energy_at = ? WHERE id = ? AND state = 'home'",
      species.maxEnergy,
      now,
      owl.id,
    );
    leftHome(ctx, owl.id, now);
    saveTrip(ctx, owl.id, userId, trip);
  }
  after?.(() => ctx.hub.notify(userId, 'owls', 'map'));
}

/** An owl is back from its holiday: at home with full energy, shown like every homecoming. */
function owlHome(ctx: Context, owlId: string, at: number, after: After): void {
  const owl = ctx.db.get<{
    owner_id: string;
    species: string;
    name: string | null;
    km_flown: number;
    state: string;
  }>('SELECT owner_id, species, name, km_flown, state FROM owls WHERE id = ?', owlId);
  ctx.db.run('DELETE FROM owl_vacations WHERE owl_id = ?', owlId);
  if (!owl || owl.state !== 'vacation') return;
  ctx.db.run(
    "UPDATE owls SET state = 'home', energy = ?, energy_at = ? WHERE id = ?",
    speciesById(owl.species)?.maxEnergy ?? 0,
    at,
    owlId,
  );
  backHome(ctx, owlId, at);
  ctx.db.run(
    "INSERT INTO homecomings (id, user_id, owl_name, species, letters, created_at, kind) VALUES (?, ?, ?, ?, 0, ?, 'home')",
    randomId(),
    owl.owner_id,
    owlLabel(owl),
    owl.species,
    at,
  );
  after(() => ctx.hub.notify(owl.owner_id, 'owls', 'map', 'homecomings'));
  // Home before the end (a short trip turned round, or the holiday ended): off again if it fits.
  sendOwlsOnVacation(ctx, owl.owner_id, at, after);
}

/** The holder moved (9.4.6): the owls on holiday fly back to the new home. */
export function vacationAfterMove(ctx: Context, userId: string, now: number): void {
  const trips = ctx.db.all<TripRow>('SELECT * FROM owl_vacations WHERE user_id = ?', userId);
  if (trips.length === 0) return;
  const home = homeOf(ctx, userId);
  const vacation = activeVacation(ctx, userId);
  for (const row of trips) {
    const trip = tripOf(row);
    saveTrip(ctx, row.owl_id, userId, tripAfterMove(trip, now, home, vacation?.ends_at ?? now));
  }
}

/** v1.4: the trips of all owls of a player on holiday – the map computes where they are. */
export function vacationTripsOf(ctx: Context, userId: string) {
  return ctx.db
    .all<TripRow & { name: string | null; species: string; km_flown: number }>(
      `SELECT v.*, o.name, o.species, o.km_flown FROM owl_vacations v JOIN owls o ON o.id = v.owl_id
        WHERE v.user_id = ? ORDER BY v.out_at, v.owl_id`,
      userId,
    )
    .map((row) => ({
      id: row.owl_id,
      owl: { name: owlLabel(row), species: row.species },
      trip: tripOf(row),
    }));
}

export interface VacationTripView {
  readonly phase: Exclude<TripPhase, 'home'>;
  readonly lat: number;
  readonly lon: number;
  /** Arrival at the island (null: it turns round before), departure from there, home again. */
  readonly islandAt: number | null;
  readonly backAt: number;
  readonly returnsAt: number;
  /** Daylight where the owl is right now (flight picture by day or night). */
  readonly daylight: boolean;
}

/** Where an owl on holiday is and when it is back (owl cards, map). */
export function vacationTrip(ctx: Context, owlId: string, now: number): VacationTripView | null {
  const row = ctx.db.get<TripRow>('SELECT * FROM owl_vacations WHERE owl_id = ?', owlId);
  if (!row) return null;
  const trip = tripOf(row);
  const position = tripPosition(trip, now);
  return {
    phase: position.phase === 'home' ? 'back' : position.phase,
    lat: Math.round(position.point.lat * 1e4) / 1e4,
    lon: Math.round(position.point.lon * 1e4) / 1e4,
    islandAt: islandArrival(trip),
    backAt: trip.backAt,
    returnsAt: trip.homeAt,
    daylight: isDay(now, position.point.lat, position.point.lon),
  };
}

export function registerVacationHandlers(ctx: Context): void {
  ctx.queue.on('vacation_start', (event, tools) =>
    startVacation(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('vacation_end', (event, tools) =>
    finishVacation(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('vacation_owl_home', (event, tools) =>
    owlHome(ctx, event.ref, event.logicalAt, tools.after),
  );
}
