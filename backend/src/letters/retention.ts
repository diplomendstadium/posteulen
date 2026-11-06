/**
 * Deletion of old letters (v0.2): every letter and system message disappears irrevocably at
 * the latest one year after its delivery; each user can choose 30, 90 or 180 days for their
 * own copies (sent and received). The other side keeps its copy until its own period ends.
 * Letters still on the way are never touched. Runs daily at 04:00 and right after a change of
 * the setting. Runs inside the caller's transaction.
 */
import { LETTER, TIME } from '@posteulen/shared/constants.ts';
import type { Context } from '../context.ts';

/** Deletes everything past its period; `userId` limits the run to one account. */
export function purgeOldLetters(ctx: Context, at: number, userId?: string): void {
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
        AND (sender_id IN (SELECT id FROM bots) OR recipient_id IN (SELECT id FROM bots))`,
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
}
