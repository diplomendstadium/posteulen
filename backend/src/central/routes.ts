/**
 * v0.8: API of the bots control centre (bots.<domain>, SPEC 10.12). Completely separate from the
 * admin panel: own host and port, own password, sessions and cookie, 12 hours idle expiry. It
 * never shows letters, names or homes of players – only aggregated numbers and, on the map, the
 * positions of bot owls on their way.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ACCOUNT, CENTRAL_BOTS, TIME } from '@posteulen/shared/constants.ts';
import { Id } from '@posteulen/shared/schemas/common.ts';
import {
  AiTest,
  BotCreate,
  BotDelete,
  BotSettings,
  BotStateChange,
  EventInput,
  ExportRequest,
} from '@posteulen/shared/schemas/bots.ts';
import { normalizeName } from '@posteulen/shared/names.ts';
import type { Context } from '../context.ts';
import { HttpError, emptyBody, parse } from '../http/errors.ts';
import { utcDay } from '../security/ids.ts';
import { registerPanelAuth } from '../admin/panel-auth.ts';
import { flightPosition, routeOf, type FlightRow } from '../flights/service.ts';
import { activationProblems, centralBot, type CentralBotRow, type EventRow } from './model.ts';
import {
  changeState,
  createCentralBot,
  createEvent,
  deleteEvent,
  eventView,
  updateEvent,
  updateSettings,
} from './admin.ts';
import { deleteCentralBot } from './service.ts';
import { normalizeImage, storeMedia } from './media.ts';
import { applyImport, exportBots, planImport } from './transfer.ts';

const RAW_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/zip'];

function idParam(request: FastifyRequest, key = 'id'): string {
  return parse(Id, (request.params as Record<string, unknown>)[key]);
}

function statsOf(ctx: Context, botId: string, now: number) {
  const sum = (since: string | null) =>
    ctx.db.get<{ sent: number; delivered: number; read: number; replies: number }>(
      `SELECT COALESCE(SUM(sent), 0) AS sent, COALESCE(SUM(delivered), 0) AS delivered,
              COALESCE(SUM(read), 0) AS read, COALESCE(SUM(replies), 0) AS replies
         FROM central_bot_stats WHERE bot_id = ? AND (? IS NULL OR day >= ?)`,
      botId,
      since,
      since,
    ) ?? { sent: 0, delivered: 0, read: 0, replies: 0 };
  return {
    total: sum(null),
    recent: sum(utcDay(now - (CENTRAL_BOTS.STATS_RECENT_DAYS - 1) * TIME.DAY)),
  };
}

function botView(ctx: Context, bot: CentralBotRow, now: number) {
  return {
    id: bot.id,
    name: bot.name,
    state: bot.state,
    character: bot.character,
    home:
      bot.home_lat !== null && bot.home_lon !== null
        ? { lat: bot.home_lat / 100, lon: bot.home_lon / 100 }
        : null,
    owlMode: bot.owl_mode,
    owlSpecies: bot.owl_species,
    owlName: bot.owl_name,
    owlSex: bot.owl_sex,
    motivation: bot.motivation,
    restHours: bot.rest_hours,
    playerOwls: bot.player_owls === 1,
    problems: activationProblems(ctx, bot),
    stats: statsOf(ctx, bot.id, now),
    planned:
      ctx.db.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM central_bot_events WHERE bot_id = ? AND state = 'planned'",
        bot.id,
      )?.n ?? 0,
  };
}

export function registerBotsCentreRoutes(app: FastifyInstance, ctx: Context): void {
  const authenticated = registerPanelAuth(app, ctx, {
    key: 'bots',
    origin: ctx.config.botsOrigin,
    cookie: 'pe_bots',
    table: 'bots_admin',
    sessions: 'bots_admin_sessions',
    idleMs: ACCOUNT.BOTS_SESSION_IDLE_HOURS * TIME.HOUR,
    attemptKind: 'bots',
    reauthKind: 'bots-reauth',
  });

  // Pictures and ZIP files are sent as they are (no JSON around them).
  app.addContentTypeParser(
    RAW_TYPES,
    { parseAs: 'buffer', bodyLimit: CENTRAL_BOTS.IMPORT_MAX_BYTES },
    (_request, body, done) => done(null, body),
  );

  const botOf = (request: FastifyRequest): CentralBotRow => {
    const bot = centralBot(ctx, idParam(request));
    if (!bot) throw new HttpError(404, 'not_found');
    return bot;
  };

  const rawBody = (request: FastifyRequest, types: readonly string[]): Buffer => {
    const type = (request.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';
    if (!types.includes(type) || !Buffer.isBuffer(request.body))
      throw new HttpError(415, 'bad_request');
    return request.body;
  };

  // ── Übersicht ──
  app.get('/api/bots', { preHandler: authenticated }, async () => {
    const now = ctx.now();
    return {
      bots: ctx.db
        .all<CentralBotRow>('SELECT * FROM central_bots ORDER BY name_key')
        .map((bot) => botView(ctx, bot, now)),
    };
  });

  /** Bot owls out right now – positions only, no names of players (SPEC 10.12). */
  app.get('/api/owls', { preHandler: authenticated }, async () => {
    const now = ctx.now();
    const flights = ctx.db.all<FlightRow & { bot_name: string }>(
      `SELECT f.*, b.name AS bot_name FROM flights f JOIN central_bots b ON b.id = f.holder_id
        WHERE f.holder_kind = 'bot' AND f.state = 'active'`,
    );
    return {
      owls: flights.flatMap((flight) => {
        const route = routeOf(flight);
        const info = flightPosition(flight, now);
        const resting = route.find((stop) => stop.status === 'resting');
        const position = resting ? { lat: resting.lat, lon: resting.lon } : info?.position;
        if (!position) return [];
        const delivered = route.some(
          (stop) => stop.type === 'deliver' && stop.status !== 'pending',
        );
        return [
          {
            bot: flight.holder_id,
            botName: flight.bot_name,
            owl: flight.owl_name,
            species: flight.owl_species,
            lat: Math.round(position.lat * 100) / 100,
            lon: Math.round(position.lon * 100) / 100,
            state: resting ? 'resting' : delivered ? 'returning' : 'flying',
            sleeping: !resting && info?.phase === 'sleep',
          },
        ];
      }),
      homes: ctx.db
        .all<{ id: string; name: string; home_lat: number; home_lon: number; state: string }>(
          'SELECT id, name, home_lat, home_lon, state FROM central_bots WHERE home_lat IS NOT NULL',
        )
        .map((bot) => ({
          id: bot.id,
          name: bot.name,
          state: bot.state,
          lat: bot.home_lat / 100,
          lon: bot.home_lon / 100,
        })),
    };
  });

  app.post('/api/bots', { preHandler: authenticated }, async (request) => {
    const body = parse(BotCreate, request.body);
    const id = ctx.db.transaction(() => createCentralBot(ctx, body.name, ctx.now()));
    return { id };
  });

  app.get('/api/bots/:id', { preHandler: authenticated }, async (request) =>
    botView(ctx, botOf(request), ctx.now()),
  );

  app.put('/api/bots/:id/settings', { preHandler: authenticated }, async (request) => {
    const body = parse(BotSettings, request.body);
    const after: (() => void)[] = [];
    const view = ctx.db.transaction(() => {
      const bot = botOf(request);
      const now = ctx.now();
      updateSettings(ctx, bot, body, now);
      const fresh = centralBot(ctx, bot.id);
      if (!fresh) throw new HttpError(404, 'not_found');
      return botView(ctx, fresh, now);
    });
    for (const work of after) work();
    return view;
  });

  app.post('/api/bots/:id/state', { preHandler: authenticated }, async (request) => {
    const body = parse(BotStateChange, request.body);
    ctx.db.transaction(() => changeState(ctx, botOf(request), body.state, ctx.now()));
    ctx.centralBots.kick();
    return botView(ctx, botOf(request), ctx.now());
  });

  /** Final deletion: the exact name has to be typed (SPEC 10.10). */
  app.post('/api/bots/:id/delete', { preHandler: authenticated }, async (request) => {
    const body = parse(BotDelete, request.body);
    const after: (() => void)[] = [];
    ctx.db.transaction(() => {
      const bot = botOf(request);
      if (normalizeName(body.name.trim()) !== bot.name_key)
        throw new HttpError(400, 'name_mismatch');
      deleteCentralBot(ctx, bot.id, ctx.now(), (work) => after.push(work));
    });
    for (const work of after) work();
    return { ok: true };
  });

  // ── Events ──
  app.get('/api/bots/:id/events', { preHandler: authenticated }, async (request) => {
    const bot = botOf(request);
    const all = ctx.db.all<EventRow>(
      'SELECT * FROM central_bot_events WHERE bot_id = ? ORDER BY due_at, id',
      bot.id,
    );
    return {
      planned: all.filter((event) => event.state === 'planned').map(eventView),
      past: all.filter((event) => event.state !== 'planned').map(eventView),
    };
  });

  app.post('/api/bots/:id/events', { preHandler: authenticated }, async (request) => {
    const body = parse(EventInput, request.body);
    const id = ctx.db.transaction(() => createEvent(ctx, botOf(request), body, ctx.now()));
    return { id };
  });

  app.put('/api/bots/:id/events/:event', { preHandler: authenticated }, async (request) => {
    const body = parse(EventInput, request.body);
    ctx.db.transaction(() =>
      updateEvent(ctx, botOf(request), idParam(request, 'event'), body, ctx.now()),
    );
    ctx.centralBots.kick();
    return { ok: true };
  });

  app.delete(
    '/api/bots/:id/events/:event',
    { preHandler: [authenticated, emptyBody] },
    async (request) => {
      ctx.db.transaction(() =>
        deleteEvent(ctx, botOf(request), idParam(request, 'event'), ctx.now()),
      );
      ctx.centralBots.kick();
      return { ok: true };
    },
  );

  // ── Bilder ──
  app.post(
    '/api/bots/:id/media',
    { preHandler: authenticated, bodyLimit: CENTRAL_BOTS.MEDIA_MAX_UPLOAD_BYTES + 1024 },
    async (request) => {
      const bot = botOf(request);
      const image = await normalizeImage(
        rawBody(request, ['image/jpeg', 'image/png', 'image/webp']),
      );
      const id = ctx.db.transaction(() => storeMedia(ctx, bot.id, image, ctx.now()));
      return { id, width: image.width, height: image.height };
    },
  );

  app.get('/api/media/:id', { preHandler: authenticated }, async (request, reply) => {
    const media = ctx.db.get<{ data: Uint8Array }>(
      'SELECT data FROM central_bot_media WHERE id = ?',
      idParam(request),
    );
    if (!media) throw new HttpError(404, 'not_found');
    void reply.header('Content-Type', 'image/webp');
    void reply.header('Cache-Control', 'private, max-age=86400');
    return reply.send(Buffer.from(media.data));
  });

  // ── KI-Test: verschickt nichts, speichert nichts, zählt nichts (außer dem KI-Kontingent) ──
  app.post('/api/bots/:id/ai-test', { preHandler: authenticated }, async (request) => {
    const body = parse(AiTest, request.body);
    const bot = botOf(request);
    const result = await ctx.centralBots.ask(bot, null, body.language, body.context, {
      ...(body.planned.trim() !== '' ? { planned: body.planned } : {}),
      letters: [{ plaintext: body.playerLetter }],
    });
    return 'text' in result ? { text: result.text } : { problem: result.problem };
  });

  // ── Export und Import (SPEC Anhang S) ──
  const sendZip = (reply: import('fastify').FastifyReply, zip: Buffer, name: string) => {
    void reply.header('Content-Type', 'application/zip');
    void reply.header('Content-Disposition', `attachment; filename="${name}"`);
    return reply.send(zip);
  };

  app.post('/api/export', { preHandler: [authenticated, emptyBody] }, async (_request, reply) =>
    sendZip(reply, exportBots(ctx), `posteulen-bots-${utcDay(ctx.now())}.zip`),
  );

  app.post('/api/bots/:id/export', { preHandler: authenticated }, async (request, reply) => {
    const body = parse(ExportRequest, request.body);
    const bot = botOf(request);
    return sendZip(
      reply,
      exportBots(ctx, { botId: bot.id, ...(body.eventIds ? { eventIds: body.eventIds } : {}) }),
      `posteulen-bot-${utcDay(ctx.now())}.zip`,
    );
  });

  const targetOf = (request: FastifyRequest): string | undefined => {
    const target = (request.query as { target?: unknown }).target;
    return target === undefined || target === '' ? undefined : parse(Id, target);
  };

  app.post('/api/import/preview', { preHandler: authenticated }, async (request) =>
    planImport(ctx, rawBody(request, ['application/zip']), targetOf(request)),
  );

  app.post('/api/import', { preHandler: authenticated }, async (request) => {
    const plan = applyImport(ctx, rawBody(request, ['application/zip']), targetOf(request));
    ctx.centralBots.kick();
    return plan;
  });
}
