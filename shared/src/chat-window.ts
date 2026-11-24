/**
 * Long conversations (SPEC 8.4): a chat with at least 30 letters (or a system chat with at least
 * 30 messages) first shows only the latest 25; "Ältere Briefe im Keller suchen" loads the rest.
 * Letters the user has not seen yet are always included, so opening a chat can still start at
 * the oldest unread one. Pure function over counts.
 */
import { CHAT } from './constants.ts';

/**
 * Index (0-based, oldest first) of the first item to send; 0 means everything. `firstPending` is
 * the index of the oldest item that must be shown (unread, arrival image pending), or null.
 */
export function windowStart(total: number, firstPending: number | null, all = false): number {
  if (all || total < CHAT.WINDOW_FROM) return 0;
  const start = total - CHAT.RECENT;
  return firstPending === null ? start : Math.max(0, Math.min(start, firstPending));
}
