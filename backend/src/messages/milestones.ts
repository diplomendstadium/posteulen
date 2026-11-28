/**
 * v1.5.0: the instance celebrates letters between people (SPEC 11.1, Anhang C). At 1,000, 5,000,
 * 10,000, 50,000, 100,000 and 1,000,000 letters, after that every further 500,000, every account
 * gets a festive system message (no push) – thanks for the trust and a call for donations and
 * ideas. Counted like "Über diese Instanz": the daily counters of letters between people.
 * The last milestone celebrated lives in `meta` (`letters_milestone`). After the update to
 * v1.5.0 an instance that already passed milestones celebrates the highest of them once.
 */
import { nextMilestone, reachedMilestone } from '@posteulen/shared/game/milestones.ts';
import type { Context } from '../context.ts';
import { addSystemMessage } from './system.ts';

type After = (work: () => void) => void;

const KEY = 'letters_milestone';

function humanLetters(ctx: Context): number {
  return (
    ctx.db.get<{ n: number | null }>('SELECT SUM(human_letters) AS n FROM stats_daily')?.n ?? 0
  );
}

function celebrated(ctx: Context): number | null {
  const row = ctx.db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', KEY);
  if (!row) return null;
  const value = Number(row.value);
  return Number.isFinite(value) ? value : 0;
}

function remember(ctx: Context, milestone: number): void {
  ctx.db.run(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    KEY,
    String(milestone),
  );
}

/** One message to every account (inside the caller's transaction). */
function celebrate(ctx: Context, milestone: number, at: number, after?: After): number {
  const users = ctx.db.all<{ id: string }>("SELECT id FROM users WHERE state != 'deleting'");
  for (const user of users) {
    addSystemMessage(ctx, user.id, 'letters_milestone', { count: milestone }, at, after);
  }
  return users.length;
}

/**
 * After letters between people were counted (inside the delivery's transaction): a milestone
 * reached is celebrated by its own queued event, so the delivery stays small.
 */
export function checkLetterMilestone(ctx: Context, at: number): void {
  const last = celebrated(ctx) ?? 0;
  const total = humanLetters(ctx);
  if (total < nextMilestone(last)) return;
  const reached = reachedMilestone(total);
  if (reached === null || reached <= last) return;
  remember(ctx, reached);
  ctx.queue.schedule('letters_milestone', String(reached), at);
}

export function registerMilestoneHandler(ctx: Context): void {
  ctx.queue.on('letters_milestone', (event, tools) => {
    const milestone = Number(event.ref);
    if (Number.isFinite(milestone) && milestone > 0)
      celebrate(ctx, milestone, event.logicalAt, tools.after);
  });
}

/**
 * Start-up: the first time (update to v1.5.0 or a fresh installation) the highest milestone
 * already passed is celebrated once – a fresh installation has no accounts and no letters.
 */
export function initLetterMilestones(ctx: Context): number {
  if (celebrated(ctx) !== null) return 0;
  const reached = reachedMilestone(humanLetters(ctx));
  const now = ctx.now();
  return ctx.db.transaction(() => {
    remember(ctx, reached ?? 0);
    return reached === null ? 0 : celebrate(ctx, reached, now);
  });
}
