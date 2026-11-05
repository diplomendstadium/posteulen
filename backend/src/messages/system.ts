/**
 * System chat (SPEC 8.4, 11.1, Anhang C): messages appear immediately, no replies, no read
 * status. Parameters are plain values (names at the time of the event, amounts).
 */
import type { Context } from '../context.ts';
import { randomId } from '../security/ids.ts';

export type SystemMessageType =
  | 'contact_confirmed'
  | 'contact_removed'
  | 'contact_renamed'
  | 'contact_deleted'
  | 'key_warning'
  | 'letter_returned'
  | 'password_changed';

export function addSystemMessage(
  ctx: Context,
  userId: string,
  type: SystemMessageType,
  params: Record<string, string | number>,
  now: number,
  after?: (work: () => void) => void,
): void {
  ctx.db.run(
    'INSERT INTO system_messages (id, user_id, type, params, created_at) VALUES (?, ?, ?, ?, ?)',
    randomId(),
    userId,
    type,
    JSON.stringify(params),
    now,
  );
  ctx.db.run(
    'DELETE FROM system_messages WHERE user_id = ? AND id NOT IN (SELECT id FROM system_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 500)',
    userId,
    userId,
  );
  const notify = (): void => ctx.hub.notify(userId, 'system');
  if (after) after(notify);
  else notify();
}
