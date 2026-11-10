/**
 * v0.8: bots of the control centre (SPEC 10.6 ff.): one central identity, personality,
 * configuration and event plan per bot – but every player has an isolated conversation, an own
 * memory of the bot (summary) and an own delivery state.
 */
import { CENTRAL_BOTS, LETTER } from '@posteulen/shared/constants.ts';
import { speciesById } from '@posteulen/shared/game/owls.ts';
import type { Context } from '../context.ts';
import { isLandAnywhere } from '@posteulen/shared/map/landmask.ts';
import { utcDay } from '../security/ids.ts';

export type CentralState = 'draft' | 'active' | 'paused';
export type OwlMode = 'own' | 'loan';

export interface CentralBotRow {
  readonly id: string;
  readonly name: string;
  readonly name_key: string;
  readonly state: CentralState;
  readonly character: string;
  readonly home_lat: number | null;
  readonly home_lon: number | null;
  readonly owl_mode: OwlMode;
  readonly owl_species: string | null;
  readonly owl_name: string | null;
  readonly owl_sex: 'f' | 'm';
  readonly motivation: number;
  readonly rest_hours: number;
  readonly player_owls: number;
  readonly created_at: number;
  readonly updated_at: number;
}

export interface EventRow {
  readonly id: string;
  readonly bot_id: string;
  readonly due_at: number;
  readonly state: 'planned' | 'running' | 'archived' | 'skipped';
  readonly move_lat: number | null;
  readonly move_lon: number | null;
  readonly has_letter: number;
  readonly parchment: 'small' | 'large';
  readonly text_first_de: string;
  readonly text_first_en: string;
  readonly text_follow_de: string;
  readonly text_follow_en: string;
  readonly context: string;
  readonly owl_mode: 'default' | OwlMode;
  readonly gift_gold: number | null;
  readonly gift_species: string | null;
  readonly media: string;
  readonly started_at: number | null;
  readonly archived_at: number | null;
  readonly recipients: number;
  readonly sent: number;
  readonly delivered: number;
  readonly read: number;
  readonly replies: number;
  readonly created_at: number;
  readonly updated_at: number;
}

export interface DeliveryRow {
  readonly id: string;
  readonly bot_id: string;
  readonly event_id: string | null;
  readonly user_id: string;
  readonly state: 'pending' | 'started' | 'done' | 'dropped';
  readonly not_before: number;
  readonly attempts: number;
  readonly variant: 'first' | 'follow' | null;
  readonly letter_id: string | null;
  readonly flight_id: string | null;
  readonly personalized: number;
  readonly created_at: number;
  readonly started_at: number | null;
  /** v0.8.3: planned on take-off, real on arrival. */
  readonly arrives_at: number | null;
}

export interface PlayerRow {
  readonly bot_id: string;
  readonly user_id: string;
  readonly known: number;
  readonly first_started: number;
  readonly removed: number;
  readonly last_letter_day: string | null;
}

export function centralBot(ctx: Context, id: string): CentralBotRow | undefined {
  return ctx.db.get<CentralBotRow>('SELECT * FROM central_bots WHERE id = ?', id);
}

export function eventById(ctx: Context, id: string): EventRow | undefined {
  return ctx.db.get<EventRow>('SELECT * FROM central_bot_events WHERE id = ?', id);
}

export function playerRow(ctx: Context, botId: string, userId: string): PlayerRow | undefined {
  return ctx.db.get<PlayerRow>(
    'SELECT * FROM central_bot_players WHERE bot_id = ? AND user_id = ?',
    botId,
    userId,
  );
}

/** Creates the per-player row if missing (all flags 0). */
export function ensurePlayer(ctx: Context, botId: string, userId: string): void {
  ctx.db.run(
    'INSERT OR IGNORE INTO central_bot_players (bot_id, user_id) VALUES (?, ?)',
    botId,
    userId,
  );
}

/** The bot as the player sees it: only once its first letter has arrived, not removed. */
export function knownCentralBot(
  ctx: Context,
  userId: string,
  botId: string,
): CentralBotRow | undefined {
  const bot = centralBot(ctx, botId);
  if (!bot || bot.state === 'draft') return undefined;
  const player = playerRow(ctx, botId, userId);
  return player?.known === 1 && player.removed === 0 ? bot : undefined;
}

/** Species bots may use: every species of the game except the phoenix (SPEC 10.6; v0.8.4 with the Virginiauhu). */
export function botSpeciesAllowed(id: string): boolean {
  const species = speciesById(id);
  return species !== undefined && (!species.mythical || species.forBots === true);
}

/** Valid home of a bot: on land anywhere in the world (SPEC 10.6, 12.3). */
export function validBotHome(ctx: Context, lat: number, lon: number): boolean {
  return isLandAnywhere(ctx.landMask, ctx.worldMask, lat, lon);
}

/**
 * What is missing before a bot may take part in the world (SPEC 10.6): name, valid home and a
 * valid owl configuration. Empty = ready to be activated.
 */
export function activationProblems(ctx: Context, bot: CentralBotRow): string[] {
  const problems: string[] = [];
  if (bot.name.trim() === '') problems.push('name');
  if (
    bot.home_lat === null ||
    bot.home_lon === null ||
    !validBotHome(ctx, bot.home_lat / 100, bot.home_lon / 100)
  )
    problems.push('home');
  if (bot.owl_mode === 'own') {
    if (!bot.owl_species || !botSpeciesAllowed(bot.owl_species)) problems.push('owl_species');
    if (!bot.owl_name || bot.owl_name.trim() === '') problems.push('owl_name');
  }
  if (
    bot.motivation < CENTRAL_BOTS.MOTIVATION_MIN ||
    bot.motivation > CENTRAL_BOTS.MOTIVATION_MAX ||
    bot.rest_hours < 0 ||
    bot.rest_hours > CENTRAL_BOTS.REST_HOURS_MAX
  )
    problems.push('owl');
  return problems;
}

/** Players a bot writes to: accounts not being deleted, bots allowed, this bot not removed. */
export function eligiblePlayers(ctx: Context, botId: string): string[] {
  return ctx.db
    .all<{ id: string }>(
      `SELECT id FROM users
        WHERE state != 'deleting' AND bots_disabled = 0
          AND NOT EXISTS (SELECT 1 FROM central_bot_players p
                           WHERE p.bot_id = ? AND p.user_id = users.id AND p.removed = 1)
        ORDER BY id`,
      botId,
    )
    .map((row) => row.id);
}

export function playerEligible(ctx: Context, botId: string, userId: string): boolean {
  const row = ctx.db.get<{ state: string; bots_disabled: number }>(
    'SELECT state, bots_disabled FROM users WHERE id = ?',
    userId,
  );
  if (!row || row.state === 'deleting' || row.bots_disabled === 1) return false;
  return playerRow(ctx, botId, userId)?.removed !== 1;
}

/** Counts one event in the daily statistics of a bot (aggregated, no personal data). */
export function countStat(
  ctx: Context,
  botId: string,
  field: 'sent' | 'delivered' | 'read' | 'replies',
  at: number,
  eventId?: string | null,
  amount = 1,
): void {
  if (amount <= 0) return;
  ctx.db.run(
    `INSERT INTO central_bot_stats (bot_id, day, ${field}) VALUES (?, ?, ?)
     ON CONFLICT (bot_id, day) DO UPDATE SET ${field} = ${field} + excluded.${field}`,
    botId,
    utcDay(at),
    amount,
  );
  if (eventId) {
    ctx.db.run(
      `UPDATE central_bot_events SET ${field} = ${field} + ? WHERE id = ?`,
      amount,
      eventId,
    );
  }
}

/** The text of an event letter for a player: variant and language (SPEC 10.8). */
export function eventText(
  event: EventRow,
  variant: 'first' | 'follow',
  language: 'de' | 'en',
): string {
  const texts = {
    first: { de: event.text_first_de, en: event.text_first_en },
    follow: { de: event.text_follow_de, en: event.text_follow_en },
  };
  const own = texts[variant][language];
  return own.trim() !== '' ? own : texts[variant][language === 'de' ? 'en' : 'de'];
}

/** Bot letters have no fixed length: a text too long for the small parchment goes on a large one. */
export function parchmentFor(text: string, wanted: 'small' | 'large'): 'small' | 'large' {
  return wanted === 'small' && Array.from(text).length > LETTER.SMALL_MAX_CHARS ? 'large' : wanted;
}

export function mediaOf(event: Pick<EventRow, 'media'>): string[] {
  try {
    const list = JSON.parse(event.media) as unknown;
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
