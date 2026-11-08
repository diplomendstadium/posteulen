/**
 * Owl flights on the server (SPEC 9.4, 9.5): the complete plan is simulated at departure
 * (shared/game/flight.ts), stored as a segment list and executed through the event queue –
 * one event per stop. Re-planning happens on a move (9.4.6), when turning back (9.5) and
 * (v0.7) whenever the owl takes off from a recipient: the motivation counts per leg, and the
 * owl may rest at each recipient, who can give it a reply to the sender (8.4, 9.4.2).
 */
import { FLIGHT, MOTIVATION, OWL, TIME } from '@posteulen/shared/constants.ts';
import {
  owlSpeedKmh,
  positionAt,
  replan,
  simulate,
  type FlightEnvironment,
  type FlightProfile,
  type FlightState,
  type PlannedStop,
  type Segment,
  type Simulation,
} from '@posteulen/shared/game/flight.ts';
import type { Point } from '@posteulen/shared/game/geo.ts';
import { speciesById } from '@posteulen/shared/game/owls.ts';
import { isDay } from '@posteulen/shared/game/sun.ts';
import { isLand } from '@posteulen/shared/map/landmask.ts';
import { backHome } from '../owls/care.ts';
import type { Context } from '../context.ts';
import { randomId, utcDay } from '../security/ids.ts';
import { credit } from '../gold/ledger.ts';
import { addSystemMessage } from '../messages/system.ts';
import { displayName } from '../contacts/model.ts';
import type { NotificationType } from '../push/service.ts';
import { afterReturnHome, scheduleAdult } from '../owls/lifecycle.ts';
import { letterReachedBot } from '../bots/service.ts';

export type OwlKind = 'own' | 'loan' | 'stand_in' | 'bot';
export type Purpose = 'letter' | 'gold' | 'gift';

export interface RouteStop {
  readonly userId: string;
  readonly lat: number;
  readonly lon: number;
  readonly type: 'deliver' | 'home';
  /** v0.7: 'resting' – arrived, delivered, and resting there until `restUntil`. */
  status: 'pending' | 'resting' | 'done' | 'skipped';
  arrivesAt: number;
  energy: number;
  /** v0.7: planned rest at this recipient (ms; 0 or missing: none). */
  rest?: number;
  /** v0.7: end of the running rest. */
  restUntil?: number;
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

/** Home of a person or of a bot (bots live on the map too, SPEC 10.1). */
export function homeOf(ctx: Context, userId: string): Point {
  const row =
    ctx.db.get<{ home_lat: number; home_lon: number }>(
      'SELECT home_lat, home_lon FROM users WHERE id = ?',
      userId,
    ) ??
    ctx.db.get<{ home_lat: number; home_lon: number }>(
      'SELECT home_lat, home_lon FROM bots WHERE id = ?',
      userId,
    );
  if (!row) throw new Error('unknown user');
  return { lat: row.home_lat / 100, lon: row.home_lon / 100 };
}

/**
 * Flight profile of an owl (9.4, v0.5): the motivation at departure (tenths, 8–12) multiplies
 * speed, maximum energy and recovery for the whole trip; the owl recovers 10 % × recovery
 * factor × motivation of this maximum per hour of sleep. Chicks fly without motivation.
 */
export function profileFor(
  ctx: Context,
  speciesId: string,
  chick = false,
  motivation: number = MOTIVATION.START,
): FlightProfile {
  const species = speciesById(speciesId);
  if (!species) throw new Error(`unknown species ${speciesId}`);
  const factor = chick ? 1 : motivation / 10;
  const maxEnergy = species.maxEnergy * factor;
  return {
    // Chicks: 10 km/h, 1 hour of flight and 1 hour of rest, independent of energy (9.9).
    speedKmh: chick ? FLIGHT.CHICK_SPEED_KMH : owlSpeedKmh(species.speedFactor) * factor,
    maxEnergy,
    mode: chick ? 'chick' : 'adult',
    recoveryPerHour: maxEnergy * OWL.REGEN_SHARE_PER_HOUR * species.recoveryFactor * factor,
    // v0.7: resting at a recipient as at home (no motivation on the recovery).
    restRecoveryPerHour: maxEnergy * OWL.REGEN_SHARE_PER_HOUR * species.recoveryFactor,
    motivation: factor,
    // v0.7: the plan holds the owl's own energy, so the motivation can change at each stop.
    ownUnits: true,
    ...(ctx.flightTimeScale !== 1 ? { timeScale: ctx.flightTimeScale } : {}),
  };
}

/**
 * Energy of the plan back to the owl's own energy, capped at its maximum. Plans before v0.7
 * hold motivated units (divided by the motivation of the trip); since v0.7 own energy.
 */
export function ownEnergy(
  flight: Pick<FlightRow, 'profile' | 'owl_species'>,
  energy: number,
): number {
  const profile = JSON.parse(flight.profile) as FlightProfile;
  const factor = profile.ownUnits ? 1 : (profile.motivation ?? 1);
  const max = speciesById(flight.owl_species)?.maxEnergy ?? Infinity;
  return Math.max(0, Math.min(max, energy / factor));
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
  /** v0.5: motivation in tenths (8–12) at departure. */
  readonly motivation: number;
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
  /** v0.7: rest at each recipient (ms; letters between people only). */
  readonly restMs?: number;
}

export interface PlannedFlight {
  readonly route: RouteStop[];
  readonly simulation: Simulation;
  readonly profile: FlightProfile;
}

/** Plans a flight without storing anything (preview, SPEC 8.4 step 4 and 9.4.3). */
export function planFlight(ctx: Context, request: PlanRequest): PlannedFlight {
  const profile = profileFor(
    ctx,
    request.owl.species,
    request.chick === true,
    request.owl.motivation,
  );
  const home = homeOf(ctx, request.holderId);
  const rest = request.chick === true ? 0 : (request.restMs ?? 0);
  const route: RouteStop[] = request.recipients.map((userId) => ({
    userId,
    ...homeOf(ctx, userId),
    type: 'deliver',
    status: 'pending',
    arrivesAt: 0,
    energy: 0,
    ...(rest > 0 ? { rest } : {}),
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
    // v0.7: the owl's own energy (the profile converts it for the motivated trip).
    { at: request.now, position: home, energy: request.owl.energy },
    route.map((stop, index) => plannedStop(stop, index)),
    flightEnvironment(ctx),
  );
  applyArrivals(route, simulation);
  return { route, simulation, profile };
}

/** A stop of the route for the simulation (v0.7: with its rest). */
function plannedStop(stop: RouteStop, index: number): PlannedStop {
  return {
    index,
    point: { lat: stop.lat, lon: stop.lon },
    ...(stop.type === 'deliver' && (stop.rest ?? 0) > 0 ? { restMs: stop.rest } : {}),
  };
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

/** Current position and energy of a flying owl (energy as its own, without motivation). */
export function flightPosition(flight: FlightRow, now: number): ReturnType<typeof positionAt> {
  const info = positionAt(planOf(flight), now);
  return info ? { ...info, energy: ownEnergy(flight, info.energy) } : info;
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

export interface ReplanOptions {
  /**
   * v0.7: the owl takes off from a recipient (or rests there and takes off later): the next
   * leg flies with the motivation it has now. Only for plans with own energy units (v0.7).
   */
  readonly newLeg?: boolean;
  /** v0.7: changes the state first (rest ends now, more energy after feeding). */
  readonly adjust?: (state: FlightState) => FlightState;
}

/** Re-plans the pending stops from the state at `now` and replaces the events (9.4.6, 9.5). */
export function replanFlight(
  ctx: Context,
  flight: FlightRow,
  route: RouteStop[],
  now: number,
  options: ReplanOptions = {},
): void {
  const pending = route
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => stop.status === 'pending');
  const stored = JSON.parse(flight.profile) as FlightProfile;
  const profile = options.newLeg && stored.ownUnits ? legProfile(ctx, flight, stored) : stored;
  const simulation = replan(
    profile,
    planOf(flight),
    now,
    pending.map(({ stop, index }) => plannedStop(stop, index)),
    flightEnvironment(ctx),
    options.adjust,
  );
  applyArrivals(route, simulation);
  saveRoute(ctx, flight, route, simulation);
  if (profile !== stored) {
    ctx.db.run('UPDATE flights SET profile = ? WHERE id = ?', JSON.stringify(profile), flight.id);
  }
  scheduleStops(ctx, flight.id, route);
  for (const stop of route) {
    if (stop.status !== 'pending') continue;
    // v0.7: replies travel to the holder and arrive with the owl at home.
    ctx.db.run(
      "UPDATE letters SET arrives_at = ? WHERE flight_id = ? AND recipient_id = ? AND status = 'in_flight'",
      stop.arrivesAt,
      flight.id,
      stop.type === 'home' ? flight.holder_id : stop.userId,
    );
  }
}

/** v0.7: the profile of the next leg – with the motivation the owl has now. */
function legProfile(ctx: Context, flight: FlightRow, stored: FlightProfile): FlightProfile {
  if (!flight.owl_id || stored.mode === 'chick') return stored;
  const owl = ctx.db.get<{ motivation: number }>(
    'SELECT motivation FROM owls WHERE id = ?',
    flight.owl_id,
  );
  return owl ? profileFor(ctx, flight.owl_species, false, owl.motivation) : stored;
}

export function finishFlight(ctx: Context, flightId: string): void {
  ctx.db.run("UPDATE flights SET state = 'done' WHERE id = ?", flightId);
  ctx.db.run(
    "DELETE FROM scheduled_events WHERE type IN ('flight_stop', 'flight_rest_end') AND substr(ref, 1, 23) = ?",
    `${flightId}:`,
  );
}

type After = (work: () => void) => void;

/**
 * v0.7: the replies an owl brought home – letters to the holder handed to it by recipients
 * while it rested there (8.4). Delivered now; returns how many.
 */
function deliverReplies(ctx: Context, flight: FlightRow, at: number, after: After): number {
  const replies = ctx.db.all<{ id: string; sender_id: string }>(
    "SELECT id, sender_id FROM letters WHERE flight_id = ? AND recipient_id = ? AND status = 'in_flight'",
    flight.id,
    flight.holder_id,
  );
  // An own owl at the window already shows itself (homecoming picture); a loan owl lands with
  // the letters in the chat (arrival picture).
  const seen = flight.owl_kind === 'own' ? 1 : 0;
  const senders = new Map<string, number>();
  for (const letter of replies) {
    ctx.db.run(
      "UPDATE letters SET status = 'delivered', arrives_at = ?, arrival_seen = ? WHERE id = ?",
      at,
      seen,
      letter.id,
    );
    senders.set(letter.sender_id, (senders.get(letter.sender_id) ?? 0) + 1);
  }
  for (const [sender, count] of senders) {
    ctx.db.run(
      `INSERT INTO chats (owner_id, peer_id, peer_kind, last_activity_at, unread) VALUES (?, ?, 'user', ?, ?)
       ON CONFLICT (owner_id, peer_id) DO UPDATE SET last_activity_at = excluded.last_activity_at,
                                                     unread = unread + excluded.unread`,
      flight.holder_id,
      sender,
      at,
      count,
    );
    after(() => ctx.hub.notify(sender, 'chats'));
  }
  if (replies.length > 0) {
    ctx.db.run(
      `INSERT INTO stats_daily (day, human_letters) VALUES (?, ?)
       ON CONFLICT (day) DO UPDATE SET human_letters = human_letters + excluded.human_letters`,
      utcDay(at),
      replies.length,
    );
  }
  return replies.length;
}

/** Owl at home again: energy from the plan, gold of a returned transfer, system message. */
function arriveHome(
  ctx: Context,
  flight: FlightRow,
  stop: RouteStop,
  at: number,
  after: After,
): void {
  const replies = deliverReplies(ctx, flight, at, after);
  if (flight.owl_kind !== 'own') {
    // v0.7: a loan owl only comes "home" with replies; it vanishes afterwards (9.6).
    if (replies > 0) {
      addSystemMessage(
        ctx,
        flight.holder_id,
        'loan_back',
        { owl: flight.owl_name, species: flight.owl_species, count: replies },
        at,
        after,
      );
      ctx.push.notify(flight.holder_id, 'letter_arrived', null, at, after);
    }
    after(() => ctx.hub.notify(flight.holder_id, 'owls', 'chats', 'map'));
    return;
  }
  if (flight.owl_id) {
    ctx.db.run(
      "UPDATE owls SET state = 'home', energy = ?, energy_at = ?, owner_id = ? WHERE id = ?",
      ownEnergy(flight, stop.energy),
      at,
      flight.holder_id,
      flight.owl_id,
    );
    backHome(ctx, flight.owl_id, at);
  }
  if (flight.gold_state === 'returning') {
    credit(ctx.db, flight.holder_id, 'transfer_refund', flight.gold, at);
    ctx.db.run("UPDATE flights SET gold_state = 'refunded' WHERE id = ?", flight.id);
  }
  // v0.7: the picture of the owl at the window (by day or night where the user lives, at the
  // moment it is shown) is an overlay when the homecoming is first seen; and a push – with
  // replies on board, that is said (v0.7).
  addSystemMessage(
    ctx,
    flight.holder_id,
    'owl_home',
    {
      owl: flight.owl_name,
      species: flight.owl_species,
      ...(replies > 0 ? { count: replies } : {}),
    },
    at,
    after,
    `${flight.owl_species}:home`,
  );
  ctx.push.notify(flight.holder_id, replies > 0 ? 'owl_home_letters' : 'owl_home', null, at, after);
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
  after(() => ctx.hub.notify(flight.holder_id, 'owls', 'profile', 'map', 'chats'));
}

/** Delivery at a recipient: letters, gold, gifted owl – exactly one push (SPEC 11.2). */
function deliver(ctx: Context, flight: FlightRow, stop: RouteStop, at: number, after: After): void {
  const recipient = stop.userId;
  const bot = ctx.db.get<{ id: string }>('SELECT id FROM bots WHERE id = ?', recipient);
  if (bot) {
    // A letter to a bot: no push, no statistics; the reply is due 2 hours later (SPEC 10.1).
    const letters = ctx.db.all<{ id: string }>(
      "SELECT id FROM letters WHERE flight_id = ? AND recipient_id = ? AND status = 'in_flight'",
      flight.id,
      recipient,
    );
    for (const letter of letters) {
      ctx.db.run(
        "UPDATE letters SET status = 'delivered', arrives_at = ? WHERE id = ?",
        at,
        letter.id,
      );
      letterReachedBot(ctx, letter.id, bot.id, at);
    }
    after(() => ctx.hub.notify(flight.holder_id, 'chats', 'map', 'owls'));
    return;
  }
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
      ownEnergy(flight, stop.energy),
      at,
      utcDay(at),
      flight.owl_id,
    );
    backHome(ctx, flight.owl_id, at);
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

/** v0.7: the flight has no more stops to fly to – it ends (loan owls vanish, 9.6). */
function endFlight(ctx: Context, flight: FlightRow, at: number): void {
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
      ctx.db.run('DELETE FROM owls WHERE id = ? AND owner_id = ?', flight.owl_id, flight.holder_id);
    }
    ctx.queue.schedule('account_purge', flight.holder_id, at);
  }
}

function restEventRef(flightId: string, index: number): string {
  return `${flightId}:${index}`;
}

/**
 * v0.7: the owl takes off from a recipient where it rested – because the rest is over or the
 * recipient handed it a reply. A loan owl with replies on board flies to the holder first;
 * without them it vanishes after its last recipient. The next leg flies with the motivation
 * the owl has now.
 */
export function endRest(
  ctx: Context,
  flight: FlightRow,
  index: number,
  at: number,
  after: After,
): void {
  const route = routeOf(flight);
  const stop = route[index];
  if (!stop || stop.status !== 'resting') return;
  stop.status = 'done';
  delete stop.restUntil;
  ctx.queue.cancel('flight_rest_end', restEventRef(flight.id, index));
  const replies =
    ctx.db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM letters WHERE flight_id = ? AND recipient_id = ? AND status = 'in_flight'",
      flight.id,
      flight.holder_id,
    )?.n ?? 0;
  const hasHome = route.some((other) => other.type === 'home');
  if (!hasHome && replies > 0) {
    route.push({
      userId: flight.holder_id,
      ...homeOf(ctx, flight.holder_id),
      type: 'home',
      status: 'pending',
      arrivesAt: 0,
      energy: 0,
    });
  }
  after(() => {
    ctx.hub.notify(stop.userId, 'owls', 'chats');
    ctx.hub.notify(flight.holder_id, 'owls', 'map');
  });
  if (!route.some((other) => other.status === 'pending')) {
    saveRoute(ctx, flight, route);
    endFlight(ctx, flight, at);
    return;
  }
  // Departure now: the rest still in the plan ends here.
  replanFlight(ctx, flight, route, at, { newLeg: true, adjust: withoutRest });
}

/** v0.7: the state without a running rest – the owl takes off now. */
function withoutRest(state: FlightState): FlightState {
  const { at, position, energy } = state;
  return { at, position, energy };
}

/**
 * v0.7: when a resting owl would be back with its holder if it took off now with a reply (the
 * preview for the recipient writing it). Nothing is stored.
 */
export function previewReturn(ctx: Context, flight: FlightRow, index: number, now: number): number {
  const route = routeOf(flight).map((stop) => ({ ...stop }));
  const stop = route[index];
  if (stop) stop.status = 'done';
  if (!route.some((other) => other.type === 'home')) {
    route.push({
      userId: flight.holder_id,
      ...homeOf(ctx, flight.holder_id),
      type: 'home',
      status: 'pending',
      arrivesAt: 0,
      energy: 0,
    });
  }
  const stored = JSON.parse(flight.profile) as FlightProfile;
  const simulation = replan(
    stored.ownUnits ? legProfile(ctx, flight, stored) : stored,
    planOf(flight),
    now,
    route
      .map((other, i) => ({ other, i }))
      .filter(({ other }) => other.status === 'pending')
      .map(({ other, i }) => plannedStop(other, i)),
    flightEnvironment(ctx),
    withoutRest,
  );
  applyArrivals(route, simulation);
  return route.find((other) => other.type === 'home')?.arrivesAt ?? now;
}

/** v0.7: the stop where the owl of this flight is resting right now, if any. */
export function restingStop(route: readonly RouteStop[]): number {
  return route.findIndex((stop) => stop.status === 'resting');
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
    stop.arrivesAt = event.logicalAt;
    // v0.7: the owl rests at the recipient (letters between people only).
    const rests = stop.type === 'deliver' && (stop.rest ?? 0) > 0 && flight.purpose === 'letter';
    if (rests) {
      stop.status = 'resting';
      stop.restUntil = event.logicalAt + (stop.rest ?? 0) / ctx.flightTimeScale;
      ctx.queue.schedule('flight_rest_end', restEventRef(flight.id, index), stop.restUntil);
    } else {
      stop.status = 'done';
    }
    saveRoute(ctx, flight, route);
    if (stop.type === 'deliver') deliver(ctx, flight, stop, event.logicalAt, tools.after);
    else arriveHome(ctx, flight, stop, event.logicalAt, tools.after);
    if (rests) return;
    if (!route.some((other) => other.status === 'pending')) {
      endFlight(ctx, flight, event.logicalAt);
    } else if (stop.type === 'deliver' && (JSON.parse(flight.profile) as FlightProfile).ownUnits) {
      // v0.7: on to the next stop with the motivation the owl has now (per leg).
      replanFlight(ctx, loadFlight(ctx, flight.id) ?? flight, route, event.logicalAt, {
        newLeg: true,
      });
    }
  });

  // v0.7: the rest at a recipient is over without a reply – the owl flies on by itself.
  ctx.queue.on('flight_rest_end', (event, tools) => {
    const [flightId, indexText] = event.ref.split(':');
    const flight = flightId ? loadFlight(ctx, flightId) : undefined;
    if (!flight || flight.state !== 'active') return;
    endRest(ctx, flight, Number(indexText), event.logicalAt, tools.after);
  });
}

/**
 * Turns back all deliveries of a flight to `userId` (SPEC 9.5): that recipient is skipped,
 * letters to them are not delivered (their copy is deleted), gold goes back to the sender
 * once the owl is home (loan and stand-in owls: at once), a gifted owl returns to the giver.
 */
export function turnBack(
  ctx: Context,
  original: FlightRow,
  userId: string,
  now: number,
  after: After,
): boolean {
  let flight = original;
  if (flight.state !== 'active') return false;
  // v0.7: replies of this person on board are not delivered either.
  const replies = ctx.db.run(
    "UPDATE letters SET status = 'returned', recipient_has = 0 WHERE flight_id = ? AND sender_id = ? AND recipient_id = ? AND status = 'in_flight'",
    flight.id,
    userId,
    flight.holder_id,
  ).changes;
  if (replies > 0) {
    addSystemMessage(
      ctx,
      userId,
      'letter_returned',
      { name: displayName(ctx.db, flight.holder_id) ?? '', cargo: 'letter' },
      now,
      after,
    );
  }
  // v0.7: an owl resting with this person flies on at once.
  const resting = routeOf(flight).findIndex(
    (stop) => stop.status === 'resting' && stop.userId === userId,
  );
  if (resting >= 0) {
    endRest(ctx, flight, resting, now, after);
    const fresh = loadFlight(ctx, flight.id);
    if (!fresh || fresh.state !== 'active') return true;
    flight = fresh;
  }
  const route = routeOf(flight);
  const affected = route.filter(
    (stop) => stop.type === 'deliver' && stop.userId === userId && stop.status === 'pending',
  );
  if (affected.length === 0) {
    if (replies > 0) after(() => ctx.hub.notify(userId, 'chats'));
    return resting >= 0 || replies > 0;
  }
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
  const stillPending = route.some((stop) => stop.status === 'pending');
  if (!hasHome && !stillPending) {
    // Loan and stand-in owls have no home: without further recipients they vanish at once
    // (9.5); otherwise they fly on to the next one (v0.4: loan owls with several recipients).
    saveRoute(ctx, fresh, route);
    finishFlight(ctx, flight.id);
    if (flight.owl_kind === 'loan' && flight.owl_id) {
      ctx.db.run('DELETE FROM owls WHERE id = ?', flight.owl_id);
    }
  } else if (stillPending) {
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
