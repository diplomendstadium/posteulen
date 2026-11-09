/**
 * v0.8: the aunt and the uncle of every account are gone for good (SPEC Anhang T). Runs at every
 * start-up, idempotent – so the clean-up also happens again after a rollback to an older version
 * and a new update. Nothing of them stays: chats, letters (also those still on their way), gold
 * shipments, reply jobs, planned events, their bookings and the system messages about their gold.
 * Own owls on their way to them turn back. Gold the players already received stays theirs.
 */
import type { Context } from '../context.ts';
import { removeBot, type BotRow } from './service.ts';

/** Old types of the bots table (before v0.8). */
interface RelativeRow extends Omit<BotRow, 'type'> {
  readonly type: string;
}

/** Their titles in both languages, as they were shown ("Tante Emma", "Aunt Emma"). */
function titles(bot: RelativeRow): string[] {
  const name = bot.first_name ?? '';
  return bot.type === 'aunt'
    ? [`Tante ${name}`, `Aunt ${name}`]
    : [`Onkel ${name}`, `Uncle ${name}`];
}

export function removeRelatives(ctx: Context): number {
  const relatives = ctx.db.all<RelativeRow>("SELECT * FROM bots WHERE type IN ('aunt', 'uncle')");
  const now = ctx.now();
  const after: (() => void)[] = [];
  ctx.db.transaction(() => {
    for (const bot of relatives) {
      // v0.8.1: own owls on their way to them turn back – without the usual "turned back"
      // message, which would name them (and crashed the start of 0.8.0).
      const before = new Set(
        ctx.db
          .all<{ id: string }>(
            "SELECT id FROM system_messages WHERE user_id = ? AND type = 'letter_returned'",
            bot.owner_id,
          )
          .map((row) => row.id),
      );
      removeBot(ctx, bot.owner_id, bot as unknown as BotRow, now, (work) => after.push(work));
      for (const row of ctx.db.all<{ id: string }>(
        "SELECT id FROM system_messages WHERE user_id = ? AND type = 'letter_returned'",
        bot.owner_id,
      )) {
        if (!before.has(row.id)) ctx.db.run('DELETE FROM system_messages WHERE id = ?', row.id);
      }
      for (const title of titles(bot)) {
        ctx.db.run(
          "DELETE FROM system_messages WHERE user_id = ? AND type = 'gold_arrived' AND json_extract(params, '$.name') = ?",
          bot.owner_id,
          title,
        );
        // The note about deleted old letters named their chats (v0.7): their name goes from it.
        const notes = ctx.db.all<{ id: string; params: string }>(
          "SELECT id, params FROM system_messages WHERE user_id = ? AND type = 'letters_purged' AND instr(params, ?) > 0",
          bot.owner_id,
          JSON.stringify(title).slice(1, -1),
        );
        for (const note of notes) {
          const params = JSON.parse(note.params) as { count: number; chats: string };
          const chats = (JSON.parse(params.chats) as string[]).filter((name) => name !== title);
          ctx.db.run(
            'UPDATE system_messages SET params = ? WHERE id = ?',
            JSON.stringify({ ...params, chats: JSON.stringify(chats) }),
            note.id,
          );
        }
      }
    }
    // Their bookings go (the gold itself stays with the players).
    ctx.db.run("DELETE FROM transactions WHERE type IN ('aunt_gift', 'uncle_inheritance')");
    // Only they had gold of their own to send.
    ctx.db.run("DELETE FROM scheduled_events WHERE type = 'bot_gold'");
    ctx.db.run(
      "DELETE FROM scheduled_events WHERE type = 'bot_letter' AND substr(ref, -6) = ':first'",
    );
  });
  for (const work of after) work();
  return relatives.length;
}
