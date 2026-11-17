/**
 * v1.1: Christmas parchment (SPEC 8.4, 9.11). Whether a letter is written in the Christmas
 * season is decided once, when it is sent, by the local time at the sender's (fictional) home,
 * and kept with the letter. Which of the four parchment pairs a conversation uses is derived from
 * both IDs and never stored.
 */
import { christmasPaper, isChristmas } from '@posteulen/shared/game/season.ts';
import type { Context } from '../context.ts';
import { homeOf } from '../flights/service.ts';
import { hmac } from '../security/ids.ts';

/** 1 when the sender's home is in the Christmas season at `at`, else 0 (stored as is). */
export function christmasAt(ctx: Context, senderId: string, at: number): 0 | 1 {
  try {
    const home = homeOf(ctx, senderId);
    return isChristmas(at, home.lat, home.lon) ? 1 : 0;
  } catch {
    // A sender without a home (should not happen): the parchment of the rest of the year.
    return 0;
  }
}

/** The Christmas parchment pair (1–4) of the conversation between two accounts or bots. */
export function christmasPaperOf(ctx: Context, a: string, b: string): number {
  return christmasPaper(hmac(ctx.keys.christmasPaper, [a, b].sort().join('|')));
}
