/**
 * v0.8: the bots a player deals with – the Erklärbär (one per account, `bots`) and the bots of the
 * control centre (`central_bots`, one for all). Chats, contacts, map and sending ask here.
 */
import type { Context } from '../context.ts';
import { utcDay } from '../security/ids.ts';
import { knownCentralBot, playerRow, type CentralBotRow } from '../central/model.ts';
import { ownBot, type BotRow } from './service.ts';

export type PlayerBot =
  | { readonly kind: 'explainer'; readonly row: BotRow }
  | { readonly kind: 'central'; readonly bot: CentralBotRow };

/**
 * A bot as this player sees it: the own Erklärbär (unless `any`: only while he is there), or a
 * control-centre bot whose first letter has arrived and that the player has not removed.
 */
export function playerBot(
  ctx: Context,
  userId: string,
  botId: string,
  any = false,
): PlayerBot | undefined {
  const row = ownBot(ctx, userId, botId, any);
  if (row) return { kind: 'explainer', row };
  const bot = knownCentralBot(ctx, userId, botId);
  return bot ? { kind: 'central', bot } : undefined;
}

/** Any bot at all (also of other accounts) – letters to and from bots are plain text. */
export function isBotId(ctx: Context, id: string): boolean {
  return (
    ctx.db.get(
      'SELECT 1 FROM bots WHERE id = ? UNION SELECT 1 FROM central_bots WHERE id = ?',
      id,
      id,
    ) !== undefined
  );
}

/** v0.8: one letter per calendar day (UTC) to every bot, the Erklärbär included (SPEC 10.1). */
export function lastLetterDay(ctx: Context, userId: string, bot: PlayerBot): string | null {
  if (bot.kind === 'explainer') {
    const at = bot.row.last_user_letter_at;
    return at === null ? null : utcDay(at);
  }
  return playerRow(ctx, bot.bot.id, userId)?.last_letter_day ?? null;
}

/** Start of the next UTC day if the player already wrote today, else null (SPEC 10.1). */
export function writableFrom(
  ctx: Context,
  userId: string,
  bot: PlayerBot,
  now: number,
): number | null {
  const today = utcDay(now);
  return lastLetterDay(ctx, userId, bot) === today
    ? Date.parse(`${today}T00:00:00Z`) + 24 * 60 * 60 * 1000
    : null;
}

export function botDisplayName(bot: PlayerBot, explainerTitle: string): string {
  return bot.kind === 'explainer' ? explainerTitle : bot.bot.name;
}
