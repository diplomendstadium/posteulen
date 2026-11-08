/**
 * v0.7.1: short messages from users to the admin (SPEC 8.10, 13). Not encrypted, stored without
 * the sender; the account only remembers the UTC day of its last message (one per calendar day).
 * Deleted 90 days after they arrived (cleanup 04:00 and when the admin opens the list).
 */
import { FEEDBACK, TIME } from '@posteulen/shared/constants.ts';
import { countCodePoints } from '@posteulen/shared/names.ts';
import { sanitizeLetterText } from '@posteulen/shared/text-rules.ts';
import type { Context } from '../context.ts';
import { HttpError } from '../http/errors.ts';
import { randomId, utcDay } from '../security/ids.ts';

/** Same text rules as letters (no emojis, no invisible characters), at most 300 characters. */
export function feedbackTextError(
  text: string,
): 'feedback_empty' | 'feedback_invalid' | 'feedback_too_long' | null {
  const clean = sanitizeLetterText(text).text;
  if (clean !== text.normalize('NFC')) return 'feedback_invalid';
  if (clean.trim() === '') return 'feedback_empty';
  if (countCodePoints(clean) > FEEDBACK.MAX_CHARS) return 'feedback_too_long';
  return null;
}

/** Stores a message (inside the caller's transaction). */
export function sendFeedback(ctx: Context, userId: string, text: string, now: number): void {
  const problem = feedbackTextError(text);
  if (problem) throw new HttpError(400, problem);
  const today = utcDay(now);
  const marked = ctx.db.run(
    'UPDATE users SET feedback_sent_on = ? WHERE id = ? AND (feedback_sent_on IS NULL OR feedback_sent_on != ?)',
    today,
    userId,
    today,
  );
  if (marked.changes !== 1) throw new HttpError(400, 'feedback_daily');
  ctx.db.run(
    'INSERT INTO feedback (id, text, created_at) VALUES (?, ?, ?)',
    randomId(),
    text.normalize('NFC').trim(),
    now,
  );
}

export function pruneFeedback(ctx: Context, now: number): void {
  ctx.db.run('DELETE FROM feedback WHERE created_at < ?', now - FEEDBACK.RETENTION_DAYS * TIME.DAY);
}

export function listFeedback(ctx: Context, now: number) {
  pruneFeedback(ctx, now);
  return ctx.db
    .all<{ id: string; text: string; created_at: number }>(
      'SELECT id, text, created_at FROM feedback ORDER BY created_at DESC, id',
    )
    .map((row) => ({ id: row.id, text: row.text, createdAt: row.created_at }));
}
