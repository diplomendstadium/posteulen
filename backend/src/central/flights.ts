/**
 * v0.8: owls of control-centre bots fly like every owl (SPEC 10.7): speed, energy, sleep, water,
 * rest at the player, reply on board, return flight and moves. Every player gets an own virtual
 * instance of the bot's owl (same name, species and motivation, independent flights); random
 * loan owls are new owls each time and vanish after delivering.
 */
import { CENTRAL_BOTS, TIME } from '@posteulen/shared/constants.ts';
import { startEnergy } from '@posteulen/shared/game/energy.ts';
import { randomSex, speciesById } from '@posteulen/shared/game/owls.ts';
import { owlNames } from '@posteulen/shared/names-data.ts';
import { SPECIES } from '@posteulen/shared/species.ts';
import type { Context } from '../context.ts';
import { languageOf } from '../accounts/language.ts';
import { credit } from '../gold/ledger.ts';
import { addSystemMessage } from '../messages/system.ts';
import { randomId, utcDay } from '../security/ids.ts';
import {
  setCentralFlightHooks,
  startFlight,
  type FlightRow,
  type RouteStop,
} from '../flights/service.ts';
import {
  centralBot,
  countStat,
  ensurePlayer,
  eventById,
  type CentralBotRow,
  type OwlMode,
} from './model.ts';

type After = (work: () => void) => void;

function pick<T>(ctx: Context, list: readonly T[]): T {
  const item = list[Math.min(list.length - 1, Math.floor(ctx.random() * list.length))];
  if (item === undefined) throw new Error('empty list');
  return item;
}

/** The active flight of the bot's own owl instance for this player, if it is out. */
export function ownOwlOut(ctx: Context, botId: string, userId: string): FlightRow | undefined {
  return ctx.db.get<FlightRow>(
    "SELECT * FROM flights WHERE holder_id = ? AND bot_peer_id = ? AND owl_kind = 'bot' AND state = 'active'",
    botId,
    userId,
  );
}

/** Which owl an event uses: its own choice or the bot's default (SPEC 10.6). */
export function owlModeOf(bot: CentralBotRow, eventMode: 'default' | OwlMode | null): OwlMode {
  return eventMode === 'own' || eventMode === 'loan' ? eventMode : bot.owl_mode;
}

/**
 * Starts a bot owl to a player (inside the caller's transaction). Own owl: full energy at the
 * start (it rests at the bot's home in between), the bot's motivation, back to the bot after
 * the rest. Loan owl: random species of the game (never the phoenix) and name, the same
 * motivation, vanishes after the rest.
 */
export function startBotFlight(
  ctx: Context,
  bot: CentralBotRow,
  userId: string,
  mode: OwlMode,
  now: number,
): { flightId: string; arrivesAt: number; owlName: string; species: string } {
  const pool = SPECIES.filter((species) => !species.mythical);
  const own = mode === 'own' && bot.owl_species && bot.owl_name;
  const species = own ? (bot.owl_species ?? '') : pick(ctx, pool).id;
  const name = own ? (bot.owl_name ?? '') : pick(ctx, owlNames(languageOf(ctx, userId)));
  const maxEnergy = speciesById(species)?.maxEnergy ?? 0;
  const { id, route } = startFlight(ctx, {
    holderId: bot.id,
    botPeerId: userId,
    owl: {
      id: null,
      kind: own ? 'bot' : 'loan',
      name,
      species,
      energy: maxEnergy,
      motivation: bot.motivation,
    },
    recipients: [userId],
    returnsHome: Boolean(own),
    now,
    purpose: 'letter',
    restMs: bot.rest_hours * TIME.HOUR,
  });
  const arrivesAt = route.find((stop) => stop.type === 'deliver')?.arrivesAt ?? now;
  return { flightId: id, arrivesAt, owlName: name, species };
}

/** The delivery a bot flight belongs to. */
function deliveryOfFlight(
  ctx: Context,
  flightId: string,
): { id: string; event_id: string | null } | undefined {
  return ctx.db.get<{ id: string; event_id: string | null }>(
    'SELECT id, event_id FROM central_bot_deliveries WHERE flight_id = ?',
    flightId,
  );
}

/** A bot owl reached its player: letter, gold or owl of the event, exactly one push. */
function deliver(ctx: Context, flight: FlightRow, stop: RouteStop, at: number, after: After): void {
  const bot = centralBot(ctx, flight.holder_id);
  const userId = stop.userId;
  if (!bot) return;
  const delivery = deliveryOfFlight(ctx, flight.id);
  const event = delivery?.event_id ? eventById(ctx, delivery.event_id) : undefined;
  const letters = ctx.db.all<{ id: string }>(
    "SELECT id FROM letters WHERE flight_id = ? AND recipient_id = ? AND status = 'in_flight'",
    flight.id,
    userId,
  );
  for (const letter of letters) {
    ctx.db.run(
      "UPDATE letters SET status = 'delivered', arrives_at = ? WHERE id = ?",
      at,
      letter.id,
    );
  }
  ensurePlayer(ctx, bot.id, userId);
  const wasKnown =
    ctx.db.get<{ known: number }>(
      'SELECT known FROM central_bot_players WHERE bot_id = ? AND user_id = ?',
      bot.id,
      userId,
    )?.known === 1;
  // The bot appears in the letters and on the map with its first letter (SPEC 10.7).
  ctx.db.run(
    'UPDATE central_bot_players SET known = 1 WHERE bot_id = ? AND user_id = ?',
    bot.id,
    userId,
  );
  ctx.db.run(
    `INSERT INTO chats (owner_id, peer_id, peer_kind, last_activity_at, unread) VALUES (?, ?, 'bot', ?, ?)
     ON CONFLICT (owner_id, peer_id) DO UPDATE SET last_activity_at = excluded.last_activity_at,
                                                   unread = unread + excluded.unread`,
    userId,
    bot.id,
    at,
    letters.length,
  );
  if (letters.length > 0) countStat(ctx, bot.id, 'delivered', at, event?.id, letters.length);
  // Arrival image of a delivery without a letter comes with the system message (9.2.6).
  const image = letters.length === 0 ? flight.owl_species : null;
  let push: 'letter_arrived' | 'gold_arrived' | 'owl_gift' = 'letter_arrived';
  if (event?.gift_gold) {
    credit(ctx.db, userId, 'bot_gift', event.gift_gold, at, null, bot.name);
    addSystemMessage(
      ctx,
      userId,
      'gold_arrived',
      { name: bot.name, amount: event.gift_gold, owl: flight.owl_name },
      at,
      after,
      image,
    );
    push = 'gold_arrived';
    after(() => ctx.hub.notify(userId, 'profile', 'finance'));
  }
  if (event?.gift_species) {
    // Like an owl from a voucher: it moves in at once and waits for its name (may exceed the limit).
    const species = speciesById(event.gift_species);
    if (species) {
      ctx.db.run(
        `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at)
         VALUES (?, ?, 'own', ?, ?, NULL, ?, ?, ?, ?)`,
        randomId(),
        userId,
        species.id,
        randomSex(ctx.random()),
        startEnergy(species, ctx.random()),
        at,
        utcDay(at),
        at,
      );
      addSystemMessage(
        ctx,
        userId,
        'bot_owl_gift',
        { name: bot.name, species: species.id },
        at,
        after,
        letters.length === 0 ? species.id : null,
      );
      push = 'owl_gift';
      after(() => ctx.hub.notify(userId, 'owls'));
    }
  }
  if (delivery) {
    ctx.db.run(
      "UPDATE central_bot_deliveries SET state = 'done', arrives_at = ? WHERE id = ? AND state = 'started'",
      Math.round(at),
      delivery.id,
    );
  }
  ctx.push.notify(userId, push, letters[0]?.id ?? flight.id, at, after);
  after(() => ctx.hub.notify(userId, 'chats', ...(wasKnown ? [] : (['contacts', 'map'] as const))));
}

/** Letters of a player arrived at the bot: they wait for an answer (SPEC 10.9). */
export function lettersArrived(
  ctx: Context,
  botId: string,
  letterIds: readonly string[],
  at: number,
): void {
  for (const letterId of letterIds) {
    const letter = ctx.db.get<{ sender_id: string }>(
      'SELECT sender_id FROM letters WHERE id = ?',
      letterId,
    );
    if (!letter) continue;
    const inserted = ctx.db.run(
      `INSERT OR IGNORE INTO central_bot_inbox (letter_id, bot_id, user_id, state, arrived_at)
       VALUES (?, ?, ?, 'arrived', ?)`,
      letterId,
      botId,
      letter.sender_id,
      at,
    );
    if (inserted.changes !== 1) continue;
    // Counted for the bot and for the event of its last letter to this player.
    const last = ctx.db.get<{ bot_event_id: string | null }>(
      `SELECT bot_event_id FROM letters WHERE sender_id = ? AND recipient_id = ? AND bot_event_id IS NOT NULL
        ORDER BY sent_at DESC LIMIT 1`,
      botId,
      letter.sender_id,
    );
    countStat(ctx, botId, 'replies', at, last?.bot_event_id ?? null);
    ctx.db.run(
      'UPDATE chats SET last_activity_at = ? WHERE owner_id = ? AND peer_id = ?',
      at,
      letter.sender_id,
      botId,
    );
    scheduleSpontaneous(ctx, botId, letter.sender_id, at);
  }
}

/**
 * A reply is generated with the next planned letter of the bot; only if none is planned within
 * the next four weeks, the bot replies by itself two hours after the arrival (SPEC 10.9).
 */
export function scheduleSpontaneous(ctx: Context, botId: string, userId: string, at: number): void {
  const bot = centralBot(ctx, botId);
  if (bot?.state !== 'active') return;
  const open = ctx.db.get(
    "SELECT 1 FROM central_bot_inbox WHERE bot_id = ? AND user_id = ? AND state = 'arrived'",
    botId,
    userId,
  );
  if (!open) return;
  const planned = ctx.db.get(
    `SELECT 1 FROM central_bot_events
      WHERE bot_id = ? AND state = 'planned' AND has_letter = 1 AND due_at <= ?`,
    botId,
    at + CENTRAL_BOTS.SPONTANEOUS_WINDOW_DAYS * TIME.DAY,
  );
  // A letter of an event already waiting for this player answers, too.
  const waiting = ctx.db.get(
    "SELECT 1 FROM central_bot_deliveries WHERE bot_id = ? AND user_id = ? AND state = 'pending'",
    botId,
    userId,
  );
  if (planned || waiting) return;
  const arrived =
    ctx.db.get<{ first: number }>(
      "SELECT MIN(arrived_at) AS first FROM central_bot_inbox WHERE bot_id = ? AND user_id = ? AND state = 'arrived'",
      botId,
      userId,
    )?.first ?? at;
  const due = Math.max(at, arrived + CENTRAL_BOTS.REPLY_AFTER_HOURS * TIME.HOUR);
  ctx.db.run(
    `INSERT INTO central_bot_deliveries (id, bot_id, event_id, user_id, state, not_before, created_at)
     VALUES (?, ?, NULL, ?, 'pending', ?, ?)`,
    randomId(),
    botId,
    userId,
    due,
    at,
  );
  ctx.queue.schedule('cbot_kick', `${botId}:${userId}`, due);
}

/** A bot owl is back at its bot: the replies of the player on board arrive there. */
function arriveHome(ctx: Context, flight: FlightRow, at: number, after: After): void {
  const letters = ctx.db.all<{ id: string }>(
    "SELECT id FROM letters WHERE flight_id = ? AND recipient_id = ? AND status = 'in_flight'",
    flight.id,
    flight.holder_id,
  );
  for (const letter of letters) {
    ctx.db.run(
      "UPDATE letters SET status = 'delivered', arrives_at = ? WHERE id = ?",
      at,
      letter.id,
    );
  }
  lettersArrived(
    ctx,
    flight.holder_id,
    letters.map((letter) => letter.id),
    at,
  );
  if (flight.bot_peer_id) {
    const peer = flight.bot_peer_id;
    after(() => ctx.hub.notify(peer, 'chats'));
  }
}

/** A flight of a bot ended: its owl is free for the next letter; the event may be archived. */
function flightEnded(ctx: Context, flight: FlightRow, at: number): void {
  const delivery = deliveryOfFlight(ctx, flight.id);
  if (delivery) {
    // Not delivered (turned back, player gone): the letter did not reach the player.
    ctx.db.run(
      "UPDATE central_bot_deliveries SET state = 'dropped' WHERE id = ? AND state = 'started'",
      delivery.id,
    );
    if (delivery.event_id) checkArchive(ctx, delivery.event_id, at);
  }
  // The next letter for this player may wait for this owl (SPEC 10.7).
  ctx.db.run(
    "UPDATE central_bot_deliveries SET not_before = ? WHERE bot_id = ? AND user_id = ? AND state = 'pending' AND not_before > ?",
    at,
    flight.holder_id,
    flight.bot_peer_id ?? '',
    at,
  );
  ctx.queue.schedule('cbot_kick', `${flight.holder_id}:${flight.bot_peer_id ?? ''}`, at);
}

/**
 * An event goes to the archive once all its letters and possible replies have been delivered:
 * nothing pending, no owl of the event still out (SPEC 10.8).
 */
export function checkArchive(ctx: Context, eventId: string, at: number): void {
  const event = eventById(ctx, eventId);
  if (event?.state !== 'running') return;
  const open = ctx.db.get(
    `SELECT 1 FROM central_bot_deliveries d
      WHERE d.event_id = ? AND (d.state = 'pending'
        OR EXISTS (SELECT 1 FROM flights f WHERE f.id = d.flight_id AND f.state = 'active'))`,
    eventId,
  );
  if (open) return;
  ctx.db.run(
    "UPDATE central_bot_events SET state = 'archived', archived_at = ? WHERE id = ? AND state = 'running'",
    at,
    eventId,
  );
}

export function isCentralBotId(ctx: Context, id: string): boolean {
  return ctx.db.get('SELECT 1 FROM central_bots WHERE id = ?', id) !== undefined;
}

export function registerCentralFlightHooks(): void {
  setCentralFlightHooks({
    deliver,
    arriveHome,
    lettersArrived,
    flightEnded,
    isCentralBot: isCentralBotId,
  });
}
