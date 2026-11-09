/**
 * Deletion of old letters (v0.2): every letter and system message disappears irrevocably at
 * the latest one year after its delivery; each user can choose 30, 90 or 180 days for their
 * own copies (sent and received). The other side keeps its copy until its own period ends.
 * Letters still on the way are never touched. Runs daily at 04:00 and right after a change of
 * the setting. Runs inside the caller's transaction.
 */
import { LETTER, TIME } from '@posteulen/shared/constants.ts';
import type { Context } from '../context.ts';
import { displayName, findContact } from '../contacts/model.ts';
import { addSystemMessage } from '../messages/system.ts';
import { playerBot } from '../bots/registry.ts';

type After = (work: () => void) => void;

/**
 * v0.7: how many of each person's own letter copies (per chat) the run will delete – the copies
 * past their own period and those past the one-year limit. Only people, never bots.
 */
function copiesDue(ctx: Context, at: number, userId?: string): Map<string, Map<string, number>> {
  const due = new Map<string, Map<string, number>>();
  const onlyUser = userId === undefined ? '' : ' AND users.id = ?';
  for (const [side, other] of [
    ['sender', 'recipient'],
    ['recipient', 'sender'],
  ] as const) {
    const rows = ctx.db.all<{ owner: string; peer: string; n: number }>(
      `SELECT letters.${side}_id AS owner, letters.${other}_id AS peer, COUNT(*) AS n
         FROM letters JOIN users ON users.id = letters.${side}_id
        WHERE letters.${side}_has = 1 AND letters.status != 'in_flight' AND users.state != 'deleting'
          ${side === 'recipient' ? "AND letters.status = 'delivered'" : ''}
          AND (letters.arrives_at < ? - users.letter_retention_days * ? OR letters.arrives_at < ?)${onlyUser}
        GROUP BY owner, peer`,
      at,
      TIME.DAY,
      at - LETTER.RETENTION_MAX_DAYS * TIME.DAY,
      ...(userId === undefined ? [] : [userId]),
    );
    for (const row of rows) {
      const chats = due.get(row.owner) ?? new Map<string, number>();
      chats.set(row.peer, (chats.get(row.peer) ?? 0) + row.n);
      due.set(row.owner, chats);
    }
  }
  return due;
}

/**
 * Deletes everything past its period; `userId` limits the run to one account. v0.7: everyone
 * who lost letters gets a system message with the number and the chats (with the picture of the
 * letters burning in the fireplace).
 */
export function purgeOldLetters(ctx: Context, at: number, userId?: string, after?: After): void {
  const due = copiesDue(ctx, at, userId);
  const onlyUser = userId === undefined ? '' : ' AND users.id = ?';
  const user = userId === undefined ? [] : [userId];
  for (const side of ['sender', 'recipient'] as const) {
    ctx.db.run(
      `UPDATE letters SET ${side}_has = 0
        WHERE ${side}_has = 1 AND status != 'in_flight'
          AND ${side}_id IN (SELECT users.id FROM users
                              WHERE letters.arrives_at < ? - users.letter_retention_days * ?${onlyUser})`,
      at,
      TIME.DAY,
      ...user,
    );
  }
  // A bot keeps no copies of its own (as when deleting a chat, SPEC 8.4).
  ctx.db.run(
    `DELETE FROM letters
      WHERE status != 'in_flight' AND (sender_has = 0 OR recipient_has = 0)
        AND (sender_id IN (SELECT id FROM bots UNION SELECT id FROM central_bots)
             OR recipient_id IN (SELECT id FROM bots UNION SELECT id FROM central_bots))`,
  );
  // One year at most for everyone, whatever the flags say.
  ctx.db.run(
    "DELETE FROM letters WHERE status != 'in_flight' AND arrives_at < ?",
    at - LETTER.RETENTION_MAX_DAYS * TIME.DAY,
  );
  ctx.db.run('DELETE FROM letters WHERE sender_has = 0 AND recipient_has = 0');
  ctx.db.run(
    `DELETE FROM system_messages
      WHERE (? IS NULL OR user_id = ?)
        AND created_at < ? - ? * (SELECT letter_retention_days FROM users
                                   WHERE users.id = system_messages.user_id)`,
    userId ?? null,
    userId ?? null,
    at,
    TIME.DAY,
  );
  // Deleted unread letters no longer count as unread.
  ctx.db.run(
    `UPDATE chats SET unread = (SELECT COUNT(*) FROM letters
                                 WHERE recipient_id = chats.owner_id AND sender_id = chats.peer_id
                                   AND status = 'delivered' AND read = 0 AND recipient_has = 1)
      WHERE unread > 0`,
  );
  for (const [owner, chats] of due) {
    let count = 0;
    const names: string[] = [];
    for (const [peer, n] of chats) {
      count += n;
      // Current name while connected (bots: while the player has them), otherwise "unknown".
      const known = playerBot(ctx, owner, peer, true) ?? findContact(ctx.db, owner, peer);
      names.push(known ? (displayName(ctx.db, peer) ?? '') : '');
    }
    names.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
    addSystemMessage(
      ctx,
      owner,
      'letters_purged',
      { count, chats: JSON.stringify(names) },
      at,
      after,
    );
  }
}
