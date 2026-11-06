/**
 * Admin functions of stage 4 (SPEC 13 items 1, 2, 4, 6): statistics from counters only,
 * inactivity deletion period, broadcast messages. No user list, no access to letters.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';
import {
  Broadcast,
  InactivityUpdate,
  OpenAiKey,
  OpenAiSettings,
} from '@posteulen/shared/schemas/auth.ts';
import { HttpError, emptyBody } from '../http/errors.ts';
import {
  aiDailyLimit,
  aiModel,
  deleteApiKey,
  keySince,
  loadApiKey,
  setAiDailyLimit,
  setAiModel,
  storeApiKey,
  usedToday,
} from '../bots/ai.ts';
import type { Context } from '../context.ts';
import { parse } from '../http/errors.ts';
import { utcDay } from '../security/ids.ts';
import { addSystemMessage } from '../messages/system.ts';
import { getInactivityDays, setInactivityDays } from './settings.ts';

export function adminStats(ctx: Context, now: number) {
  const count = (sql: string, ...params: (string | number)[]): number =>
    ctx.db.get<{ n: number | null }>(sql, ...params)?.n ?? 0;
  return {
    accounts: {
      created: count("SELECT value AS n FROM stats_counters WHERE key = 'accounts_created_total'"),
      current: count('SELECT COUNT(*) AS n FROM users'),
      active30: count(
        'SELECT COUNT(*) AS n FROM users WHERE last_active_date >= ?',
        utcDay(now - ACCOUNT.ADMIN_ACTIVE_WINDOW_DAYS * TIME.DAY),
      ),
    },
    letters: {
      total: count('SELECT SUM(human_letters) AS n FROM stats_daily'),
      last7: count(
        'SELECT SUM(human_letters) AS n FROM stats_daily WHERE day > ?',
        utcDay(now - 7 * TIME.DAY),
      ),
    },
  };
}

/** A message in the system chat of every account, with push (SPEC 13 item 6). */
export function sendBroadcast(ctx: Context, text: string, now: number): number {
  const after: (() => void)[] = [];
  const recipients = ctx.db.transaction(() => {
    ctx.db.run('INSERT INTO broadcasts (created_at, text) VALUES (?, ?)', now, text);
    const users = ctx.db.all<{ id: string }>("SELECT id FROM users WHERE state != 'deleting'");
    for (const user of users) {
      addSystemMessage(ctx, user.id, 'broadcast', { text }, now, (work) => after.push(work));
      ctx.push.notify(user.id, 'broadcast', null, now, (work) => after.push(work));
    }
    return users.length;
  });
  for (const work of after) work();
  return recipients;
}

export function registerAdminOperations(
  app: FastifyInstance,
  ctx: Context,
  authenticated: (request: FastifyRequest) => Promise<void>,
): void {
  app.get('/api/stats', { preHandler: authenticated }, async () => adminStats(ctx, ctx.now()));

  app.get('/api/settings/inactivity', { preHandler: authenticated }, async () => ({
    days: getInactivityDays(ctx.db),
    minimum: ACCOUNT.AUTO_DELETE_MIN_DAYS,
  }));

  app.put('/api/settings/inactivity', { preHandler: authenticated }, async (request) => {
    const body = parse(InactivityUpdate, request.body);
    setInactivityDays(ctx.db, body.days);
    return { days: body.days };
  });

  app.get('/api/broadcasts', { preHandler: authenticated }, async () => ({
    broadcasts: ctx.db
      .all<{ id: number; created_at: number; text: string }>(
        'SELECT id, created_at, text FROM broadcasts ORDER BY created_at DESC LIMIT 50',
      )
      .map((row) => ({ id: row.id, createdAt: row.created_at, text: row.text })),
  }));

  app.post('/api/broadcasts', { preHandler: authenticated }, async (request) => {
    const body = parse(Broadcast, request.body);
    return { recipients: sendBroadcast(ctx, body.text, ctx.now()) };
  });

  // ── OpenAI (SPEC 13 item 5): the key is never shown again, only "hinterlegt seit" ──
  app.get('/api/openai', { preHandler: authenticated }, async () => {
    const now = ctx.now();
    return {
      keySince: keySince(ctx.db),
      model: aiModel(ctx.db),
      dailyLimit: aiDailyLimit(ctx.db),
      usedToday: usedToday(ctx.db, now),
    };
  });

  app.put('/api/openai/key', { preHandler: authenticated }, async (request) => {
    const body = parse(OpenAiKey, request.body);
    await storeApiKey(ctx, body.key, ctx.now());
    // Replies that waited for a key are tried at once.
    ctx.db.run('UPDATE bot_jobs SET due_at = ? WHERE attempts > 0', ctx.now());
    ctx.botReplies.kick();
    return { keySince: keySince(ctx.db) };
  });

  app.delete('/api/openai/key', { preHandler: [authenticated, emptyBody] }, async () => {
    deleteApiKey(ctx.db);
    return { ok: true };
  });

  app.put('/api/openai/settings', { preHandler: authenticated }, async (request) => {
    const body = parse(OpenAiSettings, request.body);
    setAiModel(ctx.db, body.model);
    setAiDailyLimit(ctx.db, body.dailyLimit);
    return { model: body.model, dailyLimit: body.dailyLimit };
  });

  /** Model list from the API; the admin may still type a model by hand. */
  app.get('/api/openai/models', { preHandler: authenticated }, async () => {
    const key = await loadApiKey(ctx);
    if (!key) throw new HttpError(400, 'openai_no_key');
    try {
      return { models: await ctx.ai.listModels(key) };
    } catch {
      throw new HttpError(502, 'openai_failed');
    }
  });

  /** "Verbindung testen": the key is valid and the model exists. */
  app.post('/api/openai/test', { preHandler: [authenticated, emptyBody] }, async () => {
    const key = await loadApiKey(ctx);
    if (!key) return { ok: false, code: 'openai_no_key' };
    try {
      const models = await ctx.ai.listModels(key);
      const model = aiModel(ctx.db);
      return models.includes(model) ? { ok: true } : { ok: false, code: 'openai_model_unknown' };
    } catch (error) {
      return {
        ok: false,
        code:
          (error as { status?: number | null }).status === 401
            ? 'openai_key_invalid'
            : 'openai_failed',
      };
    }
  });
}
