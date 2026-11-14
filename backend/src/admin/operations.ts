/**
 * Admin functions of stage 4 (SPEC 13 items 1, 2, 4, 6): statistics from counters only,
 * inactivity deletion period, broadcast messages. No user list, no access to letters.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';
import { SPECIES } from '@posteulen/shared/species.ts';
import {
  BannerCreate,
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
import { randomId, utcDay } from '../security/ids.ts';
import { Id } from '@posteulen/shared/schemas/common.ts';
import { sanitizeLetterText } from '@posteulen/shared/text-rules.ts';
import { addSystemMessage } from '../messages/system.ts';
import { getInactivityDays, setInactivityDays } from './settings.ts';

/** v0.8.2: a banner runs for at most 90 days. */
const BANNER_MAX_DAYS = 90;

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
    owls: owlsBySpecies(ctx),
  };
}

/**
 * v0.9: owls currently owned by players, per species (SPEC 13 item 1). Only own owls
 * (`kind = 'own'`, chicks included and shown separately): no loan owls, no bot owls. Every species
 * appears, also with 0, in the order of the species list; a numbers-only view without owners.
 */
export function owlsBySpecies(ctx: Context): { species: string; count: number; chicks: number }[] {
  const rows = ctx.db.all<{ species: string; n: number; chicks: number }>(
    `SELECT species, COUNT(*) AS n, SUM(is_chick) AS chicks
       FROM owls WHERE kind = 'own' GROUP BY species`,
  );
  const counts = new Map(rows.map((row) => [row.species, row]));
  const known = SPECIES.map((species) => species.id);
  const unknown = rows.map((row) => row.species).filter((id) => !known.includes(id));
  return [...known, ...unknown.sort()].map((id) => ({
    species: id,
    count: counts.get(id)?.n ?? 0,
    chicks: counts.get(id)?.chicks ?? 0,
  }));
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

  // ── v0.8.2: timed banners for all accounts (SPEC 13 item 11) ──
  app.get('/api/banners', { preHandler: authenticated }, async () => ({
    banners: ctx.db
      .all<{
        id: string;
        text_de: string;
        text_en: string;
        starts_at: number;
        ends_at: number;
      }>('SELECT id, text_de, text_en, starts_at, ends_at FROM banners ORDER BY starts_at DESC')
      .map((row) => ({
        id: row.id,
        textDe: row.text_de,
        textEn: row.text_en,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      })),
  }));

  app.post('/api/banners', { preHandler: authenticated }, async (request) => {
    const body = parse(BannerCreate, request.body);
    const now = ctx.now();
    const textDe = body.textDe.trim();
    const textEn = body.textEn.trim();
    for (const text of [textDe, textEn]) {
      if (text !== '' && sanitizeLetterText(text).text !== text.normalize('NFC'))
        throw new HttpError(400, 'banner_invalid');
    }
    if (textDe === '') throw new HttpError(400, 'banner_invalid');
    const startsAt = Math.max(body.startsAt, now);
    if (body.endsAt <= startsAt || body.endsAt - startsAt > BANNER_MAX_DAYS * TIME.DAY)
      throw new HttpError(400, 'banner_period');
    const id = randomId();
    ctx.db.run(
      'INSERT INTO banners (id, text_de, text_en, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      textDe,
      textEn,
      startsAt,
      body.endsAt,
      now,
    );
    ctx.hub.notifyAll('banners');
    return { id };
  });

  app.delete('/api/banners/:id', { preHandler: [authenticated, emptyBody] }, async (request) => {
    const id = parse(Id, (request.params as { id?: unknown }).id);
    if (ctx.db.run('DELETE FROM banners WHERE id = ?', id).changes !== 1)
      throw new HttpError(404, 'not_found');
    ctx.hub.notifyAll('banners');
    return { ok: true };
  });

  // ── OpenAI (SPEC 13 item 5): the key is never shown again, only "hinterlegt seit" ──
  app.get('/api/openai', { preHandler: authenticated }, async () => {
    const now = ctx.now();
    return {
      keySince: keySince(ctx.db),
      model: aiModel(ctx.db),
      dailyLimit: aiDailyLimit(ctx.db),
      usedToday: usedToday(ctx.db, now),
      // v0.8: own quota for the bots of the control centre.
      botsDailyLimit: aiDailyLimit(ctx.db, 'bots'),
      botsUsedToday: usedToday(ctx.db, now, 'bots'),
    };
  });

  app.put('/api/openai/key', { preHandler: authenticated }, async (request) => {
    const body = parse(OpenAiKey, request.body);
    await storeApiKey(ctx, body.key, ctx.now());
    // Replies that waited for a key are tried at once.
    ctx.db.run('UPDATE bot_jobs SET due_at = ? WHERE attempts > 0', ctx.now());
    ctx.botReplies.kick();
    ctx.centralBots.kick();
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
    if (body.botsDailyLimit !== undefined) setAiDailyLimit(ctx.db, body.botsDailyLimit, 'bots');
    return {
      model: body.model,
      dailyLimit: body.dailyLimit,
      botsDailyLimit: aiDailyLimit(ctx.db, 'bots'),
    };
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
