/**
 * v0.8.5: events of the control-centre bots are deleted irrevocably and completely 36 months
 * after they were sent (SPEC 10.10): the event with its texts and numbers, its deliveries to
 * players and its pictures that nothing else uses any more. Planned and running events stay.
 * The anonymous daily counters per bot (statistics, 10.13) are kept. Runs daily at 04:00 UTC,
 * inside the caller's transaction.
 */
import { CENTRAL_BOTS } from '@posteulen/shared/constants.ts';
import type { Context } from '../context.ts';

/** The moment 36 calendar months before `at`. */
export function eventCutoff(at: number): number {
  const date = new Date(at);
  date.setUTCMonth(date.getUTCMonth() - CENTRAL_BOTS.EVENT_RETENTION_MONTHS);
  return date.getTime();
}

/** Deletes old events; returns how many. */
export function pruneOldEvents(ctx: Context, at: number): number {
  const old = ctx.db.all<{ id: string; bot_id: string; media: string }>(
    `SELECT id, bot_id, media FROM central_bot_events
      WHERE state IN ('archived', 'skipped') AND due_at < ?`,
    eventCutoff(at),
  );
  for (const event of old) {
    // Letters live at most a year; should one still point here, it forgets the event.
    ctx.db.run('UPDATE letters SET bot_event_id = NULL WHERE bot_event_id = ?', event.id);
    ctx.db.run('DELETE FROM central_bot_deliveries WHERE event_id = ?', event.id);
    ctx.db.run('DELETE FROM central_bot_events WHERE id = ?', event.id);
    // Its pictures go at once if no other event and no letter uses them.
    for (const mediaId of JSON.parse(event.media) as string[]) {
      ctx.db.run(
        `DELETE FROM central_bot_media
          WHERE id = ? AND bot_id = ?
            AND NOT EXISTS (SELECT 1 FROM central_bot_events e
                             WHERE e.bot_id = central_bot_media.bot_id
                               AND instr(e.media, '"' || central_bot_media.id || '"') > 0)
            AND NOT EXISTS (SELECT 1 FROM letters l
                             WHERE l.sender_id = central_bot_media.bot_id AND l.media IS NOT NULL
                               AND instr(l.media, '"' || central_bot_media.id || '"') > 0)`,
        mediaId,
        event.bot_id,
      );
    }
  }
  return old.length;
}
