/** Admin API (SPEC 13). Never offers user lists, letters or changes to accounts. */
import * as v from 'valibot';
import type { FastifyInstance } from 'fastify';
import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';
import { ErrorLogUpdate, RegistrationModeUpdate } from '@posteulen/shared/schemas/auth.ts';
import { Id } from '@posteulen/shared/schemas/common.ts';
import type { Context } from '../context.ts';
import { HttpError, parse, emptyBody } from '../http/errors.ts';
import { createInvite, getRegistrationMode, listInvites, setRegistrationMode } from './settings.ts';
import { createVoucher, listVouchers } from './vouchers.ts';
import { listFeedback } from './feedback.ts';
import { VoucherCreate } from '@posteulen/shared/schemas/vouchers.ts';
import { registerAdminOperations } from './operations.ts';
import { registerPanelAuth } from './panel-auth.ts';

/** Error log IDs are positive integers in decimal notation (no `1e2`, no signs). */
const ErrorLogId = v.pipe(v.string(), v.regex(/^[1-9][0-9]{0,14}$/));

export function registerAdminRoutes(app: FastifyInstance, ctx: Context): void {
  const authenticated = registerPanelAuth(app, ctx, {
    key: 'admin',
    origin: ctx.config.adminOrigin,
    cookie: 'pe_admin',
    table: 'admin',
    sessions: 'admin_sessions',
    idleMs: ACCOUNT.ADMIN_SESSION_IDLE_MINUTES * TIME.MINUTE,
    attemptKind: 'admin',
    reauthKind: 'admin-reauth',
  });

  registerAdminOperations(app, ctx, authenticated);

  // ── Registrierung und Einladungscodes (SPEC 13 item 3) ──
  app.get('/api/settings/registration', { preHandler: authenticated }, async () => ({
    mode: getRegistrationMode(ctx.db),
  }));

  app.put('/api/settings/registration', { preHandler: authenticated }, async (request) => {
    const body = parse(RegistrationModeUpdate, request.body);
    setRegistrationMode(ctx.db, body.mode);
    return { mode: body.mode };
  });

  app.get('/api/invites', { preHandler: authenticated }, async () => ({
    invites: listInvites(ctx, ctx.now()),
  }));

  app.post('/api/invites', { preHandler: [authenticated, emptyBody] }, async () =>
    createInvite(ctx, ctx.now()),
  );

  app.delete('/api/invites/:id', { preHandler: [authenticated, emptyBody] }, async (request) => {
    const id = parse(Id, (request.params as { id?: unknown }).id);
    const result = ctx.db.run('DELETE FROM invite_codes WHERE id = ?', id);
    if (result.changes !== 1) throw new HttpError(404, 'not_found');
    return { ok: true };
  });

  // ── Gutscheine für Gold oder eine Eule (v0.7, SPEC 13) ──
  app.get('/api/vouchers', { preHandler: authenticated }, async () => ({
    vouchers: listVouchers(ctx, ctx.now()),
  }));

  app.post('/api/vouchers', { preHandler: authenticated }, async (request) =>
    createVoucher(ctx, parse(VoucherCreate, request.body), ctx.now()),
  );

  app.delete('/api/vouchers/:id', { preHandler: [authenticated, emptyBody] }, async (request) => {
    const id = parse(Id, (request.params as { id?: unknown }).id);
    const result = ctx.db.run('DELETE FROM vouchers WHERE id = ?', id);
    if (result.changes !== 1) throw new HttpError(404, 'not_found');
    return { ok: true };
  });

  // ── Nachrichten der Nutzer (v0.7.1, SPEC 13): ohne Absender, 90 Tage ──
  app.get('/api/feedback', { preHandler: authenticated }, async () => ({
    messages: listFeedback(ctx, ctx.now()),
  }));

  app.delete('/api/feedback/:id', { preHandler: [authenticated, emptyBody] }, async (request) => {
    const id = parse(Id, (request.params as { id?: unknown }).id);
    const result = ctx.db.run('DELETE FROM feedback WHERE id = ?', id);
    if (result.changes !== 1) throw new HttpError(404, 'not_found');
    return { ok: true };
  });

  // ── Fehlerprotokoll (SPEC 13 item 7) ──
  app.get('/api/errors', { preHandler: authenticated }, async () => ({
    entries: ctx.db
      .all<{
        id: number;
        at: number;
        component: string;
        severity: string;
        what: string;
        cause: string;
        action: string;
        read: number;
        count: number;
        last_at: number | null;
      }>(
        `SELECT id, at, component, severity, what, cause, action, read, count, last_at
           FROM error_log ORDER BY COALESCE(last_at, at) DESC LIMIT 500`,
      )
      // v0.6.1: merged entries carry how often and when last (SPEC 13 item 7).
      .map(({ last_at: lastAt, ...row }) => ({
        ...row,
        read: row.read === 1,
        lastAt: lastAt ?? row.at,
      })),
  }));

  app.patch('/api/errors/:id', { preHandler: authenticated }, async (request) => {
    parse(ErrorLogUpdate, request.body);
    const id = Number(parse(ErrorLogId, (request.params as { id?: unknown }).id));
    if (ctx.db.run('UPDATE error_log SET read = 1 WHERE id = ?', id).changes !== 1)
      throw new HttpError(404, 'not_found');
    return { ok: true };
  });

  app.delete('/api/errors/:id', { preHandler: [authenticated, emptyBody] }, async (request) => {
    const id = Number(parse(ErrorLogId, (request.params as { id?: unknown }).id));
    if (ctx.db.run('DELETE FROM error_log WHERE id = ?', id).changes !== 1)
      throw new HttpError(404, 'not_found');
    return { ok: true };
  });
}
