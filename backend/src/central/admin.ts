/**
 * v0.8: what the control centre changes (SPEC 10.6, 10.8, 10.12): bots (draft → active ⇄ paused),
 * their settings and their planned events. Events can be edited and deleted until they run; a
 * letter that has taken off is never changed afterwards. There are no repeating events.
 */
import { checkBotName } from '@posteulen/shared/names.ts';
import type { BotSettingsType, EventInputType } from '@posteulen/shared/schemas/bots.ts';
import { letterTextError } from '@posteulen/shared/text-rules.ts';
import type { Context } from '../context.ts';
import { HttpError } from '../http/errors.ts';
import { randomId } from '../security/ids.ts';
import {
  activationProblems,
  botSpeciesAllowed,
  centralBot,
  eventById,
  mediaOf,
  validBotHome,
  type CentralBotRow,
  type EventRow,
} from './model.ts';
import { pruneMedia } from './media.ts';
import { rerouteForMove } from '../flights/service.ts';
import { reconsiderReplies, scheduleEvent, setBotState } from './service.ts';

/** A bot name: rules of user names, unique among bots and players (SPEC 10.6). */
export function checkNewBotName(
  ctx: Context,
  input: string,
  ownId?: string,
): { display: string; key: string } {
  const name = checkBotName(input.trim());
  if (typeof name === 'string') throw new HttpError(400, `name_${name}`);
  const bot = ctx.db.get<{ id: string }>(
    'SELECT id FROM central_bots WHERE name_key = ?',
    name.key,
  );
  if ((bot && bot.id !== ownId) || ctx.db.get('SELECT 1 FROM users WHERE name_key = ?', name.key))
    throw new HttpError(409, 'name_unavailable');
  return name;
}

/** A new bot starts as an empty draft: no home, nobody sees it, it does nothing (SPEC 10.6). */
export function createCentralBot(ctx: Context, nameInput: string, now: number): string {
  const name = checkNewBotName(ctx, nameInput);
  const id = randomId();
  ctx.db.run(
    `INSERT INTO central_bots (id, name, name_key, state, owl_sex, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
    id,
    name.display,
    name.key,
    ctx.random() < 0.5 ? 'f' : 'm',
    now,
    now,
  );
  return id;
}

export function updateSettings(
  ctx: Context,
  bot: CentralBotRow,
  input: BotSettingsType,
  now: number,
): void {
  const name = checkNewBotName(ctx, input.name, bot.id);
  if (input.home && !validBotHome(ctx, input.home.lat, input.home.lon))
    throw new HttpError(400, 'home_not_land');
  if (input.owlSpecies !== null && !botSpeciesAllowed(input.owlSpecies))
    throw new HttpError(400, 'bad_request');
  const owlName = input.owlName?.trim() ?? null;
  if (owlName !== null && owlName !== '') {
    if (Array.from(owlName).length < 2 || Array.from(owlName).length > 20)
      throw new HttpError(400, 'name_too_long');
  }
  const homeLat = input.home ? Math.round(input.home.lat * 100) : null;
  const homeLon = input.home ? Math.round(input.home.lon * 100) : null;
  const moved = homeLat !== bot.home_lat || homeLon !== bot.home_lon;
  // Renaming keeps the conversations: everything hangs on the stable ID (SPEC 10.6).
  ctx.db.run(
    `UPDATE central_bots SET name = ?, name_key = ?, character = ?, home_lat = ?, home_lon = ?, owl_mode = ?,
            owl_species = ?, owl_name = ?, motivation = ?, rest_hours = ?, player_owls = ?, updated_at = ?
      WHERE id = ?`,
    name.display,
    name.key,
    input.character,
    homeLat,
    homeLon,
    input.owlMode,
    input.owlSpecies,
    owlName === '' ? null : owlName,
    input.motivation,
    input.restHours,
    input.playerOwls ? 1 : 0,
    now,
    bot.id,
  );
  const fresh = centralBot(ctx, bot.id);
  if (fresh && fresh.state !== 'draft' && activationProblems(ctx, fresh).length > 0)
    throw new HttpError(400, 'bot_incomplete');
  // A new home: owls on their way to the bot (and its own owls flying home) adjust their course.
  if (moved && homeLat !== null) rerouteForMove(ctx, bot.id, now, () => undefined);
}

/** Activation needs a valid configuration and is confirmed separately in the UI. */
export function changeState(
  ctx: Context,
  bot: CentralBotRow,
  state: 'active' | 'paused',
  now: number,
): void {
  if (state === 'active') {
    const problems = activationProblems(ctx, bot);
    if (problems.length > 0) throw new HttpError(400, 'bot_incomplete', { problems });
  } else if (bot.state === 'draft') {
    throw new HttpError(400, 'bad_request');
  }
  setBotState(ctx, bot.id, state, now);
}

/** Columns of an event from the form (checked like every letter, SPEC 5.9, 10.8). */
export function eventColumns(
  ctx: Context,
  botId: string,
  input: EventInputType,
): Omit<
  EventRow,
  | 'id'
  | 'bot_id'
  | 'due_at'
  | 'state'
  | 'started_at'
  | 'archived_at'
  | 'recipients'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'replies'
  | 'created_at'
  | 'updated_at'
> {
  if (!input.move && !input.letter && !input.gift) throw new HttpError(400, 'event_empty');
  if (input.move && !validBotHome(ctx, input.move.lat, input.move.lon))
    throw new HttpError(400, 'home_not_land');
  if (input.letter) {
    const texts = [
      input.letter.texts.de.first,
      input.letter.texts.de.follow,
      input.letter.texts.en.first,
      input.letter.texts.en.follow,
    ];
    for (const text of texts) {
      const error = letterTextError(text, input.letter.parchment);
      if (error) throw new HttpError(400, error === 'too_long' ? 'letter_too_long' : 'event_texts');
    }
    if (new Set(input.letter.media).size !== input.letter.media.length)
      throw new HttpError(400, 'bad_request');
    for (const media of input.letter.media) {
      if (!ctx.db.get('SELECT 1 FROM central_bot_media WHERE id = ? AND bot_id = ?', media, botId))
        throw new HttpError(400, 'media_unknown');
    }
  }
  if (input.gift && 'species' in input.gift && !botSpeciesAllowed(input.gift.species))
    throw new HttpError(400, 'bad_request');
  return {
    move_lat: input.move ? Math.round(input.move.lat * 100) : null,
    move_lon: input.move ? Math.round(input.move.lon * 100) : null,
    has_letter: input.letter ? 1 : 0,
    parchment: input.letter?.parchment ?? 'small',
    text_first_de: input.letter?.texts.de.first.normalize('NFC') ?? '',
    text_first_en: input.letter?.texts.en.first.normalize('NFC') ?? '',
    text_follow_de: input.letter?.texts.de.follow.normalize('NFC') ?? '',
    text_follow_en: input.letter?.texts.en.follow.normalize('NFC') ?? '',
    context: input.context,
    owl_mode: input.letter?.owlMode ?? 'default',
    gift_gold: input.gift && 'gold' in input.gift ? input.gift.gold : null,
    gift_species: input.gift && 'species' in input.gift ? input.gift.species : null,
    media: JSON.stringify(input.letter?.media ?? []),
  };
}

export function insertEvent(
  ctx: Context,
  botId: string,
  input: EventInputType,
  now: number,
  options: { id?: string; state?: EventRow['state'] } = {},
): string {
  const columns = eventColumns(ctx, botId, input);
  const id = options.id ?? randomId();
  const state = options.state ?? 'planned';
  ctx.db.run(
    `INSERT INTO central_bot_events (id, bot_id, due_at, state, move_lat, move_lon, has_letter, parchment,
                                     text_first_de, text_first_en, text_follow_de, text_follow_en, context,
                                     owl_mode, gift_gold, gift_species, media, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    botId,
    input.dueAt,
    state,
    columns.move_lat,
    columns.move_lon,
    columns.has_letter,
    columns.parchment,
    columns.text_first_de,
    columns.text_first_en,
    columns.text_follow_de,
    columns.text_follow_en,
    columns.context,
    columns.owl_mode,
    columns.gift_gold,
    columns.gift_species,
    columns.media,
    now,
    now,
  );
  if (state === 'planned') scheduleEvent(ctx, id, input.dueAt);
  return id;
}

/** New event: always in the future. */
export function createEvent(
  ctx: Context,
  bot: CentralBotRow,
  input: EventInputType,
  now: number,
): string {
  if (input.dueAt <= now) throw new HttpError(400, 'event_in_past');
  return insertEvent(ctx, bot.id, input, now);
}

/** Editing only until it runs (SPEC 10.8). */
export function updateEvent(
  ctx: Context,
  bot: CentralBotRow,
  eventId: string,
  input: EventInputType,
  now: number,
): void {
  const event = eventById(ctx, eventId);
  if (event?.bot_id !== bot.id) throw new HttpError(404, 'not_found');
  if (event.state !== 'planned' || event.due_at <= now) throw new HttpError(409, 'event_started');
  if (input.dueAt <= now) throw new HttpError(400, 'event_in_past');
  const columns = eventColumns(ctx, bot.id, input);
  ctx.db.run(
    `UPDATE central_bot_events SET due_at = ?, move_lat = ?, move_lon = ?, has_letter = ?, parchment = ?,
            text_first_de = ?, text_first_en = ?, text_follow_de = ?, text_follow_en = ?, context = ?,
            owl_mode = ?, gift_gold = ?, gift_species = ?, media = ?, updated_at = ?
      WHERE id = ? AND state = 'planned'`,
    input.dueAt,
    columns.move_lat,
    columns.move_lon,
    columns.has_letter,
    columns.parchment,
    columns.text_first_de,
    columns.text_first_en,
    columns.text_follow_de,
    columns.text_follow_en,
    columns.context,
    columns.owl_mode,
    columns.gift_gold,
    columns.gift_species,
    columns.media,
    now,
    eventId,
  );
  scheduleEvent(ctx, eventId, input.dueAt);
  // A letter that answered may have moved out of the four weeks.
  reconsiderReplies(ctx, bot.id, now);
  pruneMedia(ctx, now, bot.id);
}

export function deleteEvent(ctx: Context, bot: CentralBotRow, eventId: string, now: number): void {
  const event = eventById(ctx, eventId);
  if (event?.bot_id !== bot.id) throw new HttpError(404, 'not_found');
  if (event.state !== 'planned' || event.due_at <= now) throw new HttpError(409, 'event_started');
  ctx.db.run('DELETE FROM central_bot_events WHERE id = ?', eventId);
  ctx.queue.cancel('cbot_event', eventId);
  // Letters that waited for this event may need a reply of their own now.
  reconsiderReplies(ctx, bot.id, now);
  pruneMedia(ctx, now, bot.id);
}

/** The event as the control centre shows it. */
export function eventView(event: EventRow): Record<string, unknown> {
  return {
    id: event.id,
    dueAt: event.due_at,
    state: event.state,
    move:
      event.move_lat !== null && event.move_lon !== null
        ? { lat: event.move_lat / 100, lon: event.move_lon / 100 }
        : null,
    letter:
      event.has_letter === 1
        ? {
            parchment: event.parchment,
            owlMode: event.owl_mode,
            texts: {
              de: { first: event.text_first_de, follow: event.text_follow_de },
              en: { first: event.text_first_en, follow: event.text_follow_en },
            },
            media: mediaOf(event),
          }
        : null,
    gift:
      event.gift_gold !== null
        ? { gold: event.gift_gold }
        : event.gift_species !== null
          ? { species: event.gift_species }
          : null,
    context: event.context,
    startedAt: event.started_at,
    archivedAt: event.archived_at,
    stats: {
      recipients: event.recipients,
      sent: event.sent,
      delivered: event.delivered,
      read: event.read,
      replies: event.replies,
    },
  };
}
