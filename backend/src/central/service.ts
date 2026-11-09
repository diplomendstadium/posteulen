/**
 * v0.8: life of a control-centre bot (SPEC 10.6–10.10): events run once at their time, pausing
 * stops new letters, deleting is atomic and final. Players can remove a single bot or all bots.
 */
import type { Context } from '../context.ts';
import { addSystemMessage } from '../messages/system.ts';
import { randomId } from '../security/ids.ts';
import {
  finishFlight,
  rerouteForMove,
  routeOf,
  turnBack,
  type FlightRow,
} from '../flights/service.ts';
import { centralBot, eligiblePlayers, eventById } from './model.ts';
import { registerCentralFlightHooks, scheduleSpontaneous } from './flights.ts';

type After = (work: () => void) => void;

/** (Re-)plans the execution of an event at its time (one queue event per event). */
export function scheduleEvent(ctx: Context, eventId: string, dueAt: number): void {
  ctx.queue.cancel('cbot_event', eventId);
  ctx.queue.schedule('cbot_event', eventId, dueAt);
}

/**
 * An event is due: move and/or letter, gold or owl to every player – exactly once. Players who
 * join later do not get it afterwards (SPEC 10.8). A bot that is not active at that time sends
 * nothing; the event is marked as skipped.
 */
export function runEvent(ctx: Context, eventId: string, at: number, after: After): void {
  const event = eventById(ctx, eventId);
  if (event?.state !== 'planned' || event.due_at > at) return;
  const bot = centralBot(ctx, event.bot_id);
  if (!bot) return;
  if (bot.state !== 'active') {
    ctx.db.run(
      "UPDATE central_bot_events SET state = 'skipped', archived_at = ? WHERE id = ?",
      at,
      event.id,
    );
    return;
  }
  if (event.move_lat !== null && event.move_lon !== null) {
    ctx.db.run(
      'UPDATE central_bots SET home_lat = ?, home_lon = ?, updated_at = ? WHERE id = ?',
      event.move_lat,
      event.move_lon,
      at,
      bot.id,
    );
    // Owls on their way to the bot (and its own owls on their way home) adjust their course.
    rerouteForMove(ctx, bot.id, at, after);
  }
  const sends = event.has_letter === 1 || event.gift_gold !== null || event.gift_species !== null;
  let recipients = 0;
  if (sends) {
    for (const userId of eligiblePlayers(ctx, bot.id)) {
      recipients += ctx.db.run(
        `INSERT OR IGNORE INTO central_bot_deliveries (id, bot_id, event_id, user_id, state, not_before, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
        randomId(),
        bot.id,
        event.id,
        userId,
        at,
        at,
      ).changes;
    }
  }
  ctx.db.run(
    `UPDATE central_bot_events SET state = ?, started_at = ?, recipients = recipients + ?,
            archived_at = CASE WHEN ? THEN ? ELSE NULL END WHERE id = ?`,
    recipients > 0 ? 'running' : 'archived',
    at,
    recipients,
    recipients > 0 ? 0 : 1,
    at,
    event.id,
  );
  after(() => ctx.centralBots.kick());
}

/** Unanswered letters may need a spontaneous reply again (an event was deleted or moved). */
export function reconsiderReplies(ctx: Context, botId: string, now: number): void {
  const players = ctx.db.all<{ user_id: string }>(
    "SELECT DISTINCT user_id FROM central_bot_inbox WHERE bot_id = ? AND state = 'arrived'",
    botId,
  );
  for (const player of players) scheduleSpontaneous(ctx, botId, player.user_id, now);
}

/** Pausing stops new letters; owls already out fly on as usual (SPEC 10.6). */
export function setBotState(
  ctx: Context,
  botId: string,
  state: 'active' | 'paused',
  now: number,
): void {
  ctx.db.run('UPDATE central_bots SET state = ?, updated_at = ? WHERE id = ?', state, now, botId);
  if (state === 'active') {
    // Letters that waited during the pause go now; open letters get their answer.
    ctx.db.run(
      "UPDATE central_bot_deliveries SET not_before = ? WHERE bot_id = ? AND state = 'pending' AND not_before < ?",
      now,
      botId,
      now,
    );
    reconsiderReplies(ctx, botId, now);
    ctx.queue.schedule('cbot_kick', `${botId}:`, now);
  }
}

/**
 * Takes the bot out of one player's world (removed by the player or the whole bot deleted):
 * its owls on their way to the player vanish with their letters, the player's owls on their way
 * to the bot turn back with their letters, chat and memory go.
 */
function detachPlayer(
  ctx: Context,
  botId: string,
  userId: string,
  now: number,
  after: After,
): void {
  const botFlights = ctx.db.all<FlightRow>(
    "SELECT * FROM flights WHERE holder_id = ? AND bot_peer_id = ? AND state = 'active'",
    botId,
    userId,
  );
  for (const flight of botFlights) {
    ctx.db.run('DELETE FROM letters WHERE flight_id = ?', flight.id);
    finishFlight(ctx, flight.id);
  }
  const ownFlights = ctx.db.all<FlightRow>(
    "SELECT * FROM flights WHERE holder_id = ? AND state = 'active'",
    userId,
  );
  for (const flight of ownFlights) {
    if (routeOf(flight).some((stop) => stop.userId === botId && stop.status === 'pending')) {
      turnBack(ctx, flight, botId, now, after);
    }
  }
  ctx.db.run(
    'DELETE FROM letters WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)',
    botId,
    userId,
    userId,
    botId,
  );
  ctx.db.run('DELETE FROM chats WHERE owner_id = ? AND peer_id = ?', userId, botId);
  ctx.db.run('DELETE FROM central_bot_inbox WHERE bot_id = ? AND user_id = ?', botId, userId);
  ctx.db.run(
    "UPDATE central_bot_deliveries SET state = 'dropped' WHERE bot_id = ? AND user_id = ? AND state IN ('pending', 'started')",
    botId,
    userId,
  );
  after(() => ctx.hub.notify(userId, 'contacts', 'chats', 'map', 'owls'));
}

/** A player removes one bot for good (in its chat): it never writes to them again. */
export function removeCentralBotForPlayer(
  ctx: Context,
  userId: string,
  botId: string,
  now: number,
  after: After,
): void {
  detachPlayer(ctx, botId, userId, now, after);
  ctx.db.run(
    `INSERT INTO central_bot_players (bot_id, user_id, removed) VALUES (?, ?, 1)
     ON CONFLICT (bot_id, user_id) DO UPDATE SET removed = 1, known = 0`,
    botId,
    userId,
  );
  const events = ctx.db.all<{ id: string }>(
    "SELECT id FROM central_bot_events WHERE bot_id = ? AND state = 'running'",
    botId,
  );
  for (const event of events) ctx.queue.schedule('cbot_archive', event.id, now);
}

/** "Alle Bots entfernen" (settings): all control-centre bots, now and in future (SPEC 8.10). */
export function removeAllCentralBotsForPlayer(
  ctx: Context,
  userId: string,
  now: number,
  after: After,
): number {
  ctx.db.run('UPDATE users SET bots_disabled = 1 WHERE id = ?', userId);
  const bots = ctx.db.all<{ id: string }>('SELECT id FROM central_bots');
  let known = 0;
  for (const bot of bots) {
    const player = ctx.db.get<{ known: number; removed: number }>(
      'SELECT known, removed FROM central_bot_players WHERE bot_id = ? AND user_id = ?',
      bot.id,
      userId,
    );
    if (player?.known === 1 && player.removed === 0) known++;
    removeCentralBotForPlayer(ctx, userId, bot.id, now, after);
  }
  return known;
}

/**
 * Deleting a bot in the control centre: atomic and final (SPEC 10.10). Planned letters and letters
 * on their way go; players' owls turn back with undelivered letters; chats and memories go. Only
 * players who already had contact with the bot get a system message.
 */
export function deleteCentralBot(ctx: Context, botId: string, now: number, after: After): boolean {
  const bot = centralBot(ctx, botId);
  if (!bot) return false;
  const contacts = ctx.db.all<{ user_id: string }>(
    `SELECT p.user_id FROM central_bot_players p JOIN users u ON u.id = p.user_id
      WHERE p.bot_id = ? AND p.known = 1 AND p.removed = 0 AND u.bots_disabled = 0 AND u.state != 'deleting'`,
    botId,
  );
  const players = ctx.db.all<{ user_id: string }>(
    `SELECT user_id FROM central_bot_players WHERE bot_id = ?
     UNION SELECT DISTINCT bot_peer_id FROM flights WHERE holder_id = ? AND state = 'active'
     UNION SELECT DISTINCT holder_id FROM flights WHERE state = 'active' AND holder_kind = 'user' AND instr(route, ?) > 0`,
    botId,
    botId,
    `"userId":"${botId}"`,
  );
  for (const player of players) detachPlayer(ctx, botId, player.user_id, now, after);
  // Flights of the bot that are left (no player any more) end as well.
  for (const flight of ctx.db.all<{ id: string }>(
    "SELECT id FROM flights WHERE holder_id = ? AND state = 'active'",
    botId,
  ))
    finishFlight(ctx, flight.id);
  ctx.db.run('DELETE FROM letters WHERE sender_id = ? OR recipient_id = ?', botId, botId);
  ctx.db.run('DELETE FROM chats WHERE peer_id = ?', botId);
  ctx.db.run(
    "DELETE FROM scheduled_events WHERE type IN ('cbot_event', 'cbot_archive') AND ref IN (SELECT id FROM central_bot_events WHERE bot_id = ?)",
    botId,
  );
  ctx.db.run(
    "DELETE FROM scheduled_events WHERE type = 'cbot_kick' AND substr(ref, 1, 23) = ?",
    `${botId}:`,
  );
  // Events, pictures, players, deliveries, inbox and statistics hang on the bot (CASCADE).
  ctx.db.run('DELETE FROM central_bots WHERE id = ?', botId);
  for (const contact of contacts) {
    addSystemMessage(ctx, contact.user_id, 'bot_deleted', { name: bot.name }, now, after);
  }
  return true;
}

export function registerCentralHandlers(ctx: Context): void {
  registerCentralFlightHooks();
  ctx.queue.on('cbot_event', (event, tools) =>
    runEvent(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('cbot_kick', (_event, tools) => tools.after(() => ctx.centralBots.kick()));
  ctx.queue.on('cbot_archive', (event) => {
    // Deliveries of a removed player no longer hold the event back.
    const open = ctx.db.get(
      `SELECT 1 FROM central_bot_deliveries d
        WHERE d.event_id = ? AND (d.state = 'pending'
          OR EXISTS (SELECT 1 FROM flights f WHERE f.id = d.flight_id AND f.state = 'active'))`,
      event.ref,
    );
    if (!open) {
      ctx.db.run(
        "UPDATE central_bot_events SET state = 'archived', archived_at = ? WHERE id = ? AND state = 'running'",
        event.logicalAt,
        event.ref,
      );
    }
  });
}
