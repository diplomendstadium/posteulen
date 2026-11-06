/**
 * Messages of PostEulen itself (v0.3): a friendly request for donations every five weeks
 * after registration (three texts in turn), and once per update a note about what changed.
 * Both are plain system messages; the texts live in shared/texts/messages.ts.
 */
import { DONATION, TIME } from '@posteulen/shared/constants.ts';
import { notesSince } from '@posteulen/shared/texts/messages.ts';
import { VERSION } from '@posteulen/shared/version.ts';
import type { Context } from '../context.ts';
import { addSystemMessage } from './system.ts';

const INTERVAL = DONATION.INTERVAL_DAYS * TIME.DAY;

/** First request five weeks after registration (call inside the registration transaction). */
export function scheduleDonations(ctx: Context, userId: string, registeredAt: number): void {
  ctx.queue.schedule('donation', userId, registeredAt + INTERVAL);
}

/**
 * Accounts from before v0.3: the next request falls on the next five-week mark counted from
 * the day of registration, so nobody gets one right after the update.
 */
export function ensureDonationSchedules(ctx: Context): number {
  const users = ctx.db.all<{ id: string; created_on: string }>(
    `SELECT id, created_on FROM users WHERE state != 'deleting'
        AND id NOT IN (SELECT ref FROM scheduled_events WHERE type = 'donation')`,
  );
  const now = ctx.now();
  ctx.db.transaction(() => {
    for (const user of users) {
      const registered = Date.parse(`${user.created_on}T00:00:00Z`);
      const start = Number.isFinite(registered) ? registered : now;
      const periods = Math.max(1, Math.ceil((now - start) / INTERVAL));
      let due = start + periods * INTERVAL;
      if (due <= now) due += INTERVAL;
      ctx.queue.schedule('donation', user.id, due);
    }
  });
  return users.length;
}

export function registerDonationHandler(ctx: Context): void {
  ctx.queue.on('donation', (event, tools) => {
    const user = ctx.db.get<{ state: string; donation_count: number }>(
      'SELECT state, donation_count FROM users WHERE id = ?',
      event.ref,
    );
    if (!user || user.state === 'deleting') return;
    if (user.state === 'active') {
      addSystemMessage(
        ctx,
        event.ref,
        'donation',
        { text: user.donation_count % DONATION.TEXTS },
        event.logicalAt,
        tools.after,
      );
      ctx.db.run('UPDATE users SET donation_count = donation_count + 1 WHERE id = ?', event.ref);
    }
    ctx.queue.schedule('donation', event.ref, event.logicalAt + INTERVAL);
  });
}

/**
 * After an update every existing account gets one system message per new version with notes.
 * A fresh installation (no accounts yet) only remembers the version. Without a remembered
 * version the database comes from before v0.3, the first version with notes.
 */
export function sendUpdateNotes(ctx: Context): number {
  const row = ctx.db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'notes_version'");
  const hasUsers = ctx.db.get('SELECT 1 FROM users LIMIT 1') !== undefined;
  const notes = hasUsers ? notesSince(row?.value ?? '0.2.0', VERSION) : [];
  const now = ctx.now();
  let sent = 0;
  ctx.db.transaction(() => {
    if (notes.length > 0) {
      const users = ctx.db.all<{ id: string }>("SELECT id FROM users WHERE state != 'deleting'");
      for (const user of users) {
        for (const note of notes) {
          addSystemMessage(ctx, user.id, 'update_notes', { version: note.version }, now);
          sent++;
        }
      }
    }
    ctx.db.run(
      "INSERT INTO meta (key, value) VALUES ('notes_version', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      VERSION,
    );
  });
  return sent;
}
