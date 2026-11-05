/**
 * Owl flights on the server (SPEC 9.4, 9.5): the complete plan is simulated at departure
 * (shared/game/flight.ts), stored as a segment list and executed through the event queue –
 * one event per stop. Re-planning happens only on a move (9.4.6) and when turning back (9.5).
 */
import { FLIGHT, OWL, TIME } from '@posteulen/shared/constants.ts';
import {
  owlSpeedKmh,
  positionAt,
  replan,
  simulate,
  type FlightEnvironment,
  type FlightProfile,
  type Segment,
  type Simulation,
} from '@posteulen/shared/game/flight.ts';
import type { Point } from '@posteulen/shared/game/geo.ts';
import { speciesById } from '@posteulen/shared/game/owls.ts';
import { isDay } from '@posteulen/shared/game/sun.ts';
import { isLand } from '@posteulen/shared/map/landmask.ts';
import type { Context } from '../context.ts';
import { randomId, utcDay } from '../security/ids.ts';
import { credit } from '../gold/ledger.ts';
import { addSystemMessage } from '../messages/system.ts';
import { displayName } from '../contacts/model.ts';
import type { NotificationType } from '../push/service.ts';
import { afterReturnHome, scheduleAdult } from '../owls/lifecycle.ts';

export type OwlKind = 'own' | 'loan' | 'stand_in' | 'bot';
export type Purpose = 'letter' | 'gold' | 'gift';

export interface RouteStop {
  readonly userId: string;
  readonly lat: number;
  readonly lon: number;
  readonly type: 'deliver' | 'home';
  status: 'pending' | 'done' | 'skipped';
  arrivesAt: number;
  energy: number;
}

export interface FlightRow {
  readonly id: string;
  readonly holder_id: string;
  readonly owl_id: string | null;
  readonly owl_kind: OwlKind;
  readonly owl_name: string;
  readonly owl_species: string;
  readonly purpose: Purpose;
  readonly gold: number;
  readonly gold_state: 'none' | 'carried' | 'delivered' | 'returning' | 'refunded';
  readonly profile: string;
  readonly route: string;
  readonly plan: string;
  readonly started_at: number;
  readonly ends_at: number;
  readonly state: 'active' | 'done';
}

export function flightEnvironment(ctx: Context): FlightEnvironment {
  return {
    isLand: (lat, lon) => isLand(ctx.landMask, lat, lon),
    isDay,
  };
}

export function homeOf(ctx: Context, userId: string): Point {
  const row = ctx.db.get<{ home_lat: number; home_lon: number }>(
    'SELECT home_lat, home_lon FROM users WHERE id = ?',
    userId,
  );
  if (!row) throw new Error('unknown user');
  return { lat: row.home_lat / 100, lon: row.home_lon / 100 };
}

export function profileFor(ctx: Context, speciesId: string, chick = false): FlightProfile {
  const species = speciesById(speciesId);
  if (!species) throw new Error(`unknown species ${speciesId}`);
  return {
    // Chicks: 10 km/h, 1 hour of flight and 1 hour of rest, independent of energy (9.9).
    speedKmh: chick ? FLIGHT.CHICK_SPEED_KMH : owlSpeedKmh(species.speedFactor),
    maxEnergy: species.maxEnergy,
    mode: chick ? 'chick' : 'adult',
    ...(ctx.flightTimeScale !== 1 ? { timeScale: ctx.flightTimeScale } : {}),
  };
}

function isChickFlight(flight: FlightRow): boolean {
  return (JSON.parse(flight.profile) as FlightProfile).mode === 'chick';
}

export interface FlightOwl {
  readonly id: string | null;
  readonly kind: OwlKind;
  readonly name: string;
  readonly species: string;
  readonly energy: number;
}

export interface PlanRequest {
  readonly holderId: string;
  readonly owl: FlightOwl;
  readonly recipients: readonly string[];
  /** Own owls fly home after the last recipient; loan, stand-in and gifted owls do not. */
  readonly returnsHome: boolean;
  readonly now: number;
  /** A chick on its gift flight (9.9). */
  readonly chick?: boolean;
}

export interface PlannedFlight {
  readonly route: RouteStop[];
  readonly simulation: Simulation;
  readonly profile: FlightProfile;
}

/** Plans a flight without storing anything (preview, SPEC 8.4 step 4 and 9.4.3). */
export function planFlight(ctx: Context, request: PlanRequest): PlannedFlight {
  const profile = profileFor(ctx, request.owl.species, request.chick === true);
  const home = homeOf(ctx, request.holderId);
  const route: RouteStop[] = request.recipients.map((userId) => ({
    userId,
    ...homeOf(ctx, userId),
    type: 'deliver',
    status: 'pending',
    arrivesAt: 0,
    energy: 0,
  }));
  if (request.returnsHome) {
    route.push({
      userId: request.holderId,
      ...home,
      type: 'home',
      status: 'pending',
      arrivesAt: 0,
      energy: 0,
    });
  }
  const simulation = simulate(
    profile,
    { at: request.now, position: home, energy: request.owl.energy },
    route.map((stop, index) => ({ index, point: { lat: stop.lat, lon: stop.lon } })),
    flightEnvironment(ctx),
  );
  applyArrivals(route, simulation);
  return { route, simulation, profile };
}

function applyArrivals(route: RouteStop[], simulation: Simulation): void {
  for (const arrival of simulation.arrivals) {
    const stop = route[arrival.index];
    if (!stop) continue;
    stop.arrivesAt = arrival.at;
    stop.energy = arrival.energy;
  }
}

function eventRef(flightId: string, index: number): string {
  return `${flightId}:${index}`;
}

function scheduleStops(ctx: Context, flightId: string, route: readonly RouteStop[]): void {
  ctx.db.run(
    "DELETE FROM scheduled_events WHERE type = 'flight_stop' AND substr(ref, 1, 23) = ?",
    `${flightId}:`,
  );
  route.forEach((stop, index) => {
    if (stop.status === 'pending')
      ctx.queue.schedule('flight_stop', eventRef(flightId, index), stop.arrivesAt);
  });
}

function endOf(route: readonly RouteStop[], simulation: Simulation): number {
  return Math.max(simulation.end.at, ...route.map((stop) => stop.arrivesAt));
}

/** Stores a planned flight and schedules its stops (inside the caller's transaction). */
export function startFlight(
  ctx: Context,
  request: PlanRequest & { readonly purpose: Purpose; readonly gold?: number },
  planned: PlannedFlight = planFlight(ctx, request),
): { id: string; route: RouteStop[] } {
  const id = randomId();
  ctx.db.run(
    `INSERT INTO flights (id, holder_id, owl_id, owl_kind, owl_name, owl_species, purpose, gold, gold_state,
                          profile, route, plan, started_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    request.holderId,
    request.owl.id,
    request.owl.kind,
    request.owl.name,
    request.owl.species,
    request.purpose,
    request.gold ?? 0,
    (request.gold ?? 0) > 0 ? 'carried' : 'none',
    JSON.stringify(planned.profile),
    JSON.stringify(planned.route),
    JSON.stringify(planned.simulation.segments),
    request.now,
    endOf(planned.route, planned.simulation),
  );
  scheduleStops(ctx, id, planned.route);
  return { id, route: planned.route };
}

export function loadFlight(ctx: Context, id: string): FlightRow | undefined {
  return ctx.db.get<FlightRow>('SELECT * FROM flights WHERE id = ?', id);
}

export function routeOf(flight: FlightRow): RouteStop[] {
  return JSON.parse(flight.route) as RouteStop[];
}

export function planOf(flight: FlightRow): Segment[] {
  return JSON.parse(flight.plan) as Segment[];
}

/** Current position and energy of a flying owl. */
export function flightPosition(flight: FlightRow, now: number): ReturnType<typeof positionAt> {
  return positionAt(planOf(flight), now);
}

function saveRoute(
  ctx: Context,
  flight: FlightRow,
  route: RouteStop[],
  simulation?: Simulation,
): void {
  if (simulation) {
    ctx.db.run(
      'UPDATE flights SET route = ?, plan = ?, ends_at = ? WHERE id = ?',
      JSON.stringify(route),
      JSON.stringify(simulation.segments),
      endOf(route, simulation),
      flight.id,
    );
  } else {
    ctx.db.run('UPDATE flights SET route = ? WHERE id = ?', JSON.stringify(route), flight.id);
  }
}

/** Re-plans the pending stops from the state at `now` and replaces the events (9.4.6, 9.5). */
export function replanFlight(
  ctx: Context,
  flight: FlightRow,
  route: RouteStop[],
  now: number,
): void {
  const pending = route
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => stop.status === 'pending');
  const simulation = replan(
    JSON.parse(flight.profile) as FlightProfile,
    planOf(flight),
    now,
    pending.map(({ stop, index }) => ({ index, point: { lat: stop.lat, lon: stop.lon } })),
    flightEnvironment(ctx),
  );
  applyArrivals(route, simulation);
  saveRoute(ctx, flight, route, simulation);
  scheduleStops(ctx, flight.id, route);
  for (const stop of route) {
    if (stop.status !== 'pending' || stop.type !== 'deliver') continue;
    ctx.db.run(
      "UPDATE letters SET arrives_at = ? WHERE flight_id = ? AND recipient_id = ? AND status = 'in_flight'",
      stop.arrivesAt,
      flight.id,
      stop.userId,
    );
  }
}

export function finishFlight(ctx: Context, flightId: string): void {
  ctx.db.run("UPDATE flights SET state = 'done' WHERE id = ?", flightId);
  ctx.db.run(
    "DELETE FROM scheduled_events WHERE type = 'flight_stop' AND substr(ref, 1, 23) = ?",
    `${flightId}:`,
  );
}

type After = (work: () => void) => void;

/** Owl at home again: energy from the plan, gold of a returned transfer, system message. */
function arriveHome(
  ctx: Context,
  flight: FlightRow,
  stop: RouteStop,
  at: number,
  after: After,
): void {
  if (flight.owl_id) {
    ctx.db.run(
      "UPDATE owls SET state = 'home', energy = ?, energy_at = ?, owner_id = ? WHERE id = ?",
      stop.energy,
      at,
      flight.holder_id,
      flight.owl_id,
    );
  }
  if (flight.gold_state === 'returning') {
    credit(ctx.db, flight.holder_id, 'transfer_refund', flight.gold, at);
    ctx.db.run("UPDATE flights SET gold_state = 'refunded' WHERE id = ?", flight.id);
  }
  addSystemMessage(ctx, flight.holder_id, 'owl_home', { owl: flight.owl_name }, at, after);
  if (flight.owl_id) {
    const owl = ctx.db.get<{ is_chick: number; hatched_at: number | null }>(
      'SELECT is_chick, hatched_at FROM owls WHERE id = ?',
      flight.owl_id,
    );
    if (owl?.is_chick === 1) {
      // A returned chick grows up at home, not before day 14 after hatching (9.9).
      const adultAt = (owl.hatched_at ?? at) + OWL.CHICK_ADULT_AT_MOTHER_DAYS * TIME.DAY;
      scheduleAdult(ctx, flight.owl_id, Math.max(at, adultAt));
    } else {
      // Eggs or a sickness rolled during the flight (9.8, 9.9).
      afterReturnHome(ctx, flight.owl_id, at, after);
    }
  }
  after(() => ctx.hub.notify(flight.holder_id, 'owls', 'profile', 'map'));
}

/** Delivery at a recipient: letters, gold, gifted owl – exactly one push (SPEC 11.2). */
function deliver(ctx: Context, flight: FlightRow, stop: RouteStop, at: number, after: After): void {
  const recipient = stop.userId;
  const letters = ctx.db.all<{ id: string; kind: string }>(
    "SELECT id, kind FROM letters WHERE flight_id = ? AND recipient_id = ? AND status = 'in_flight'",
    flight.id,
    recipient,
  );
  for (const letter of letters) {
    ctx.db.run(
      "UPDATE letters SET status = 'delivered', arrives_at = ? WHERE id = ?",
      at,
      letter.id,
    );
  }
  if (letters.length > 0) {
    ctx.db.run(
      `INSERT INTO chats (owner_id, peer_id, peer_kind, last_activity_at, unread) VALUES (?, ?, 'user', ?, ?)
       ON CONFLICT (owner_id, peer_id) DO UPDATE SET last_activity_at = excluded.last_activity_at,
                                                     unread = unread + excluded.unread`,
      recipient,
      flight.holder_id,
      at,
      letters.length,
    );
    // Admin statistics: only a daily counter of letters between people (SPEC 13).
    ctx.db.run(
      `INSERT INTO stats_daily (day, human_letters) VALUES (?, ?)
       ON CONFLICT (day) DO UPDATE SET human_letters = human_letters + excluded.human_letters`,
      utcDay(at),
      letters.length,
    );
  }
  const hasCover = letters.some((letter) => letter.kind !== 'letter');
  const senderName = displayName(ctx.db, flight.holder_id) ?? '';
  // Arrival image for deliveries without a letter: shown with the system message (9.2.6).
  const image = hasCover ? null : flight.owl_species;
  let push: NotificationType = 'letter_arrived';
  if (flight.purpose === 'gold' && flight.gold_state === 'carried') {
    credit(ctx.db, recipient, 'transfer_in', flight.gold, at, flight.holder_id);
    ctx.db.run("UPDATE flights SET gold_state = 'delivered' WHERE id = ?", flight.id);
    addSystemMessage(
      ctx,
      recipient,
      'gold_arrived',
      { name: senderName, amount: flight.gold, owl: flight.owl_name },
      at,
      after,
      image,
    );
    push = 'gold_arrived';
    after(() => ctx.hub.notify(recipient, 'profile', 'finance'));
  }
  if (flight.purpose === 'gift' && flight.owl_id) {
    ctx.db.run(
      "UPDATE owls SET owner_id = ?, state = 'home', energy = ?, energy_at = ?, owned_since = ? WHERE id = ?",
      recipient,
      stop.energy,
      at,
      utcDay(at),
      flight.owl_id,
    );
    const chick = isChickFlight(flight);
    if (chick) {
      // At the recipient a chick grows up 7 days after its arrival (9.9).
      ctx.db.run('UPDATE owls SET clutch_id = NULL WHERE id = ?', flight.owl_id);
      scheduleAdult(ctx, flight.owl_id, at + OWL.CHICK_ADULT_AT_RECIPIENT_DAYS * TIME.DAY);
    }
    addSystemMessage(
      ctx,
      recipient,
      chick ? 'chick_gift_received' : 'owl_gift_received',
      { name: senderName, owl: flight.owl_name, species: flight.owl_species },
      at,
      after,
      chick && image ? `${image}:chick` : image,
    );
    push = chick ? 'chick_gift' : 'owl_gift';
    after(() => ctx.hub.notify(recipient, 'owls'));
  }
  ctx.push.notify(recipient, push, letters[0]?.id ?? flight.id, at, after);
  after(() => {
    ctx.hub.notify(recipient, 'chats');
    ctx.hub.notify(flight.holder_id, 'chats', 'map', 'owls');
  });
}

export function registerFlightHandlers(ctx: Context): void {
  ctx.queue.on('flight_stop', (event, tools) => {
    const [flightId, indexText] = event.ref.split(':');
    const flight = flightId ? loadFlight(ctx, flightId) : undefined;
    if (!flight || flight.state !== 'active') return;
    const route = routeOf(flight);
    const index = Number(indexText);
    const stop = route[index];
    // Idempotent: every stop is handled once (SPEC 4.5).
    if (!stop || stop.status !== 'pending') return;
    stop.status = 'done';
    stop.arrivesAt = event.logicalAt;
    saveRoute(ctx, flight, route);
    if (stop.type === 'deliver') deliver(ctx, flight, stop, event.logicalAt, tools.after);
    else arriveHome(ctx, flight, stop, event.logicalAt, tools.after);
    if (!route.some((other) => other.status === 'pending')) {
      finishFlight(ctx, flight.id);
      // Loan owls vanish after the delivery (9.6).
      if (flight.owl_kind === 'loan' && flight.owl_id) {
        ctx.db.run('DELETE FROM owls WHERE id = ?', flight.owl_id);
      }
      const holder = ctx.db.get<{ state: string }>(
        'SELECT state FROM users WHERE id = ?',
        flight.holder_id,
      );
      if (holder?.state === 'deleting') {
        // Owls of a deleted account vanish after their last delivery (7.7 item 3).
        if (flight.owl_id) {
          ctx.db.run(
            'DELETE FROM owls WHERE id = ? AND owner_id = ?',
            flight.owl_id,
            flight.holder_id,
          );
        }
        ctx.queue.schedule('account_purge', flight.holder_id, event.logicalAt);
      }
    }
  });
}

/**
 * Turns back all deliveries of a flight to `userId` (SPEC 9.5): that recipient is skipped,
 * letters to them are not delivered (their copy is deleted), gold goes back to the sender
 * once the owl is home (loan and stand-in owls: at once), a gifted owl returns to the giver.
 */
export function turnBack(
  ctx: Context,
  flight: FlightRow,
  userId: string,
  now: number,
  after: After,
): boolean {
  if (flight.state !== 'active') return false;
  const route = routeOf(flight);
  const affected = route.filter(
    (stop) => stop.type === 'deliver' && stop.userId === userId && stop.status === 'pending',
  );
  if (affected.length === 0) return false;
  for (const stop of affected) stop.status = 'skipped';
  const letters = ctx.db.all<{ id: string }>(
    "SELECT id FROM letters WHERE flight_id = ? AND recipient_id = ? AND status = 'in_flight'",
    flight.id,
    userId,
  );
  for (const letter of letters) {
    ctx.db.run("UPDATE letters SET status = 'returned', recipient_has = 0 WHERE id = ?", letter.id);
  }
  const hasHome = flight.owl_kind === 'own' || flight.owl_kind === 'bot';
  if (flight.purpose === 'gold' && flight.gold_state === 'carried') {
    if (hasHome) {
      ctx.db.run("UPDATE flights SET gold_state = 'returning' WHERE id = ?", flight.id);
    } else {
      credit(ctx.db, flight.holder_id, 'transfer_refund', flight.gold, now);
      ctx.db.run("UPDATE flights SET gold_state = 'refunded' WHERE id = ?", flight.id);
    }
  }
  if (flight.purpose === 'gift') {
    // The gifted owl flies back to the giver and belongs to them again.
    route.push({
      userId: flight.holder_id,
      ...homeOf(ctx, flight.holder_id),
      type: 'home',
      status: 'pending',
      arrivesAt: 0,
      energy: 0,
    });
  }
  addSystemMessage(
    ctx,
    flight.holder_id,
    'letter_returned',
    {
      name: displayName(ctx.db, userId) ?? '',
      cargo: flight.purpose === 'gift' && isChickFlight(flight) ? 'chick' : flight.purpose,
    },
    now,
    after,
  );
  const fresh = {
    ...flight,
    gold_state: loadFlight(ctx, flight.id)?.gold_state ?? flight.gold_state,
  };
  if (!hasHome) {
    // Loan and stand-in owls have no home: they vanish at once (9.5).
    saveRoute(ctx, fresh, route);
    finishFlight(ctx, flight.id);
    if (flight.owl_kind === 'loan' && flight.owl_id) {
      ctx.db.run('DELETE FROM owls WHERE id = ?', flight.owl_id);
    }
  } else if (route.some((stop) => stop.status === 'pending')) {
    replanFlight(ctx, fresh, route, now);
  } else {
    saveRoute(ctx, fresh, route);
    finishFlight(ctx, flight.id);
  }
  after(() => ctx.hub.notify(flight.holder_id, 'chats', 'map', 'owls', 'profile'));
  return true;
}

/** All flights between two people turn back, in both directions (contact removed, 9.5). */
export function turnBackBetween(
  ctx: Context,
  a: string,
  b: string,
  now: number,
  after: After,
): void {
  const flights = ctx.db.all<FlightRow>(
    "SELECT * FROM flights WHERE state = 'active' AND holder_id IN (?, ?)",
    a,
    b,
  );
  for (const flight of flights) {
    turnBack(ctx, flight, flight.holder_id === a ? b : a, now, after);
  }
}

/**
 * A user moved (9.4.6): every flight that still has to visit them – as recipient or as the
 * holder waiting for the owl – adjusts its course at once from its current state.
 */
export function rerouteForMove(ctx: Context, userId: string, now: number, after: After): number {
  const home = homeOf(ctx, userId);
  const flights = ctx.db.all<FlightRow>("SELECT * FROM flights WHERE state = 'active'");
  let changed = 0;
  for (const flight of flights) {
    const route = routeOf(flight);
    let touched = false;
    for (const stop of route) {
      if (stop.status === 'pending' && stop.userId === userId) {
        Object.assign(stop, { lat: home.lat, lon: home.lon });
        touched = true;
      }
    }
    if (!touched) continue;
    replanFlight(ctx, flight, route, now);
    changed++;
    after(() => ctx.hub.notify(flight.holder_id, 'map', 'owls', 'chats'));
  }
  return changed;
}

/** Hours until a time, for texts like "zurück in 5 Std." (rounded up, at least 1). */
export function hoursUntil(at: number, now: number): number {
  return Math.max(1, Math.ceil((at - now) / TIME.HOUR));
}
