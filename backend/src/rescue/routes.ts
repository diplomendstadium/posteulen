/** The owl rescue centre (SPEC 8.13): list, the five interactions, a healed wild owl leaves. */
import type { FastifyInstance } from 'fastify';
import { Id } from '@posteulen/shared/schemas/common.ts';
import { RescueParams as Params } from '@posteulen/shared/schemas/owls.ts';
import type { Context } from '../context.ts';
import { emptyBody, parse } from '../http/errors.ts';
import { requireUser, userCookieSpec, userOf } from '../auth/sessions.ts';
import { careForOwn, careForWild, releaseWild, rescueView } from './service.ts';

export function registerRescueRoutes(app: FastifyInstance, ctx: Context): void {
  const authenticated = requireUser(ctx, userCookieSpec(ctx.config));

  app.get('/api/rescue', { preHandler: authenticated }, async (request) => {
    const me = userOf(request).id;
    return ctx.db.transaction(() => rescueView(ctx, me, ctx.now()));
  });

  app.post(
    '/api/rescue/own/:id/:action',
    { preHandler: [authenticated, emptyBody] },
    async (request) => {
      const { id, action } = parse(Params, request.params);
      const me = userOf(request).id;
      const after: (() => void)[] = [];
      const result = ctx.db.transaction(() =>
        careForOwn(ctx, me, id, action, ctx.now(), (work) => after.push(work)),
      );
      for (const work of after) work();
      ctx.hub.notify(me, 'owls', 'profile', 'finance');
      return result;
    },
  );

  app.post(
    '/api/rescue/wild/:id/:action',
    { preHandler: [authenticated, emptyBody] },
    async (request) => {
      const { id, action } = parse(Params, request.params);
      const me = userOf(request).id;
      const result = ctx.db.transaction(() => careForWild(ctx, me, id, action, ctx.now()));
      ctx.hub.notify(me, 'profile', 'finance');
      return result;
    },
  );

  app.post(
    '/api/rescue/wild/:id/release',
    { preHandler: [authenticated, emptyBody] },
    async (request) => {
      const id = parse(Id, (request.params as { id?: unknown }).id);
      const me = userOf(request).id;
      const after: (() => void)[] = [];
      const result = ctx.db.transaction(() =>
        releaseWild(ctx, me, id, ctx.now(), (work) => after.push(work)),
      );
      for (const work of after) work();
      return result;
    },
  );
}
