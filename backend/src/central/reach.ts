/**
 * v0.8.3: when the first and the last player get the owl of an event (SPEC 10.12). Owls already
 * on their way (or arrived) give real times; players still waiting – and every player of a
 * planned event – are estimated by planning the flights to the nearest and the farthest of them
 * (great-circle distance) with the bot's settings, without storing anything. The estimate
 * ignores waiting for the bot's own owl and the order in which the letters go out.
 */
import { SPECIES } from '@posteulen/shared/species.ts';
import { speciesById } from '@posteulen/shared/game/owls.ts';
import { distanceKm, type Point } from '@posteulen/shared/game/geo.ts';
import { TIME } from '@posteulen/shared/constants.ts';
import type { Context } from '../context.ts';
import { homeOf, planFlight } from '../flights/service.ts';
import { eligiblePlayers, type CentralBotRow, type EventRow } from './model.ts';
import { owlModeOf } from './flights.ts';

export interface ReachTime {
  readonly at: number;
  /** true: planned by the server (ca.), false: the owl is on its way or has arrived. */
  readonly estimated: boolean;
}

export interface EventReach {
  readonly first: ReachTime;
  readonly last: ReachTime;
  readonly players: number;
}

/** Loan owls are a random species: the estimate uses the one of median speed (never the phoenix). */
const MEDIAN_SPECIES = (() => {
  const pool = SPECIES.filter((species) => !species.mythical).sort(
    (a, b) => a.speedFactor - b.speedFactor,
  );
  return pool[Math.floor(pool.length / 2)]?.id ?? 'waldkauz';
})();

/** Estimates are cached a few minutes (the overview of a bot may list many planned events). */
const CACHE_MS = 5 * TIME.MINUTE;
const cache = new Map<string, { until: number; value: EventReach | null }>();

function speciesFor(bot: CentralBotRow, event: EventRow): string {
  return owlModeOf(bot, event.owl_mode ?? null) === 'own' &&
    bot.owl_species &&
    speciesById(bot.owl_species)
    ? bot.owl_species
    : MEDIAN_SPECIES;
}

/** Arrival at one player for an owl starting at `from` at `at` (planned, nothing stored). */
function estimateFor(
  ctx: Context,
  bot: CentralBotRow,
  species: string,
  from: Point,
  userId: string,
  at: number,
): number {
  const planned = planFlight(ctx, {
    holderId: bot.id,
    botPeerId: userId,
    from,
    owl: {
      id: null,
      kind: 'bot',
      name: '',
      species,
      energy: speciesById(species)?.maxEnergy ?? 0,
      motivation: bot.motivation,
    },
    recipients: [userId],
    returnsHome: false,
    now: at,
  });
  return planned.route[0]?.arrivesAt ?? at;
}

/** Nearest and farthest player (by distance) and their estimated arrivals. */
function estimate(
  ctx: Context,
  bot: CentralBotRow,
  event: EventRow,
  from: Point,
  players: readonly string[],
  at: number,
): { first: number; last: number } | null {
  if (players.length === 0) return null;
  const sorted = players
    .map((userId) => ({ userId, km: distanceKm(from, homeOf(ctx, userId)) }))
    .sort((a, b) => a.km - b.km);
  const species = speciesFor(bot, event);
  const near = sorted[0];
  const far = sorted.at(-1);
  if (!near || !far) return null;
  const first = estimateFor(ctx, bot, species, from, near.userId, at);
  const last = near === far ? first : estimateFor(ctx, bot, species, from, far.userId, at);
  return { first: Math.min(first, last), last: Math.max(first, last) };
}

/** Where the owls start: the place of the move of this event, else the bot's home. */
function startOf(ctx: Context, bot: CentralBotRow, event: EventRow): Point | null {
  if (event.move_lat !== null && event.move_lon !== null)
    return { lat: event.move_lat / 100, lon: event.move_lon / 100 };
  return bot.home_lat !== null && bot.home_lon !== null ? homeOf(ctx, bot.id) : null;
}

function sends(event: EventRow): boolean {
  return event.has_letter === 1 || event.gift_gold !== null || event.gift_species !== null;
}

/** First and last arrival of an event, or null (nothing to send, no players, no home). */
export function eventReach(
  ctx: Context,
  bot: CentralBotRow,
  event: EventRow,
  now: number,
): EventReach | null {
  if (!sends(event) || event.state === 'skipped') return null;
  if (event.state === 'planned') {
    const players = eligiblePlayers(ctx, bot.id);
    const key = [
      event.id,
      event.due_at,
      event.move_lat,
      event.move_lon,
      event.owl_mode,
      bot.home_lat,
      bot.home_lon,
      bot.owl_mode,
      bot.owl_species,
      bot.motivation,
      players.length,
      players[0] ?? '',
      players.at(-1) ?? '',
    ].join('|');
    const hit = cache.get(key);
    if (hit && hit.until > now) return hit.value;
    const from = startOf(ctx, bot, event);
    const at = Math.max(event.due_at, now);
    const times = from ? estimate(ctx, bot, event, from, players, at) : null;
    const value = times
      ? {
          first: { at: times.first, estimated: true },
          last: { at: times.last, estimated: true },
          players: players.length,
        }
      : null;
    if (cache.size > 2000) cache.clear();
    cache.set(key, { until: now + CACHE_MS, value });
    return value;
  }
  // Running or archived: real arrivals of the owls on their way, estimates for those still waiting.
  const deliveries = ctx.db.all<{
    user_id: string;
    state: string;
    arrives_at: number | null;
    not_before: number;
  }>(
    "SELECT user_id, state, arrives_at, not_before FROM central_bot_deliveries WHERE event_id = ? AND state != 'dropped'",
    event.id,
  );
  if (deliveries.length === 0) return null;
  const real = deliveries.flatMap((d) =>
    d.state !== 'pending' && d.arrives_at !== null ? [d.arrives_at] : [],
  );
  const waiting = deliveries.filter((d) => d.state === 'pending');
  const from = waiting.length > 0 && bot.home_lat !== null ? homeOf(ctx, bot.id) : null;
  const later =
    from && waiting.length > 0
      ? estimate(
          ctx,
          bot,
          event,
          from,
          waiting.map((d) => d.user_id),
          Math.max(now, Math.min(...waiting.map((d) => d.not_before))),
        )
      : null;
  const candidates: ReachTime[] = [
    ...real.map((at) => ({ at, estimated: false })),
    ...(later
      ? [
          { at: later.first, estimated: true },
          { at: later.last, estimated: true },
        ]
      : []),
  ];
  if (candidates.length === 0) return null;
  const first = candidates.reduce((a, b) => (b.at < a.at ? b : a));
  const last = candidates.reduce((a, b) => (b.at > a.at ? b : a));
  return { first, last, players: deliveries.length };
}
