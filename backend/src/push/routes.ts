/** Push subscription, verification (SPEC 11.4) and "Neuigkeiten" (SPEC 11.5). */
import type { FastifyInstance } from 'fastify';
import { IdList, PushAck, PushSubscriptionInput } from '@posteulen/shared/schemas/letters.ts';
import { SECURITY } from '@posteulen/shared/constants.ts';
import type { Context } from '../context.ts';
import { HttpError, parse, emptyBody } from '../http/errors.ts';
import { clientKey } from '../security/ip.ts';
import { userCookieSpec, requireUser, userOf } from '../auth/sessions.ts';
import { checkEndpointUrl, EndpointError } from './transport.ts';

export function registerPushRoutes(app: FastifyInstance, ctx: Context): void {
  const authenticated = requireUser(ctx, userCookieSpec(ctx.config));

  /**
   * v0.6.1: every test push to an endpoint that keeps failing costs the server a connection
   * and an error report – so per account at most SECURITY.PUSH_CHANGES_PER_HOUR an hour.
   */
  const pushLimit = (userId: string): void => {
    const wait = ctx.limits.push.hit(userId, ctx.now());
    if (wait > 0)
      throw new HttpError(429, 'rate_limited', { retryAfterSeconds: Math.ceil(wait / 1000) });
  };

  app.get('/api/push/key', { preHandler: authenticated }, async () => ({
    publicKey: ctx.secrets.vapid.publicKey,
  }));

  /** One subscription per account, bound to the last device (SPEC 11.3); starts the test. */
  app.put('/api/push/subscription', { preHandler: authenticated }, async (request) => {
    if (ctx.limits.expensive.hit(clientKey(request), ctx.now()) > 0)
      throw new HttpError(429, 'rate_limited');
    pushLimit(userOf(request).id);
    const body = parse(PushSubscriptionInput, request.body);
    try {
      checkEndpointUrl(body.endpoint);
    } catch (error) {
      if (error instanceof EndpointError) throw new HttpError(400, 'push_endpoint_invalid');
      throw error;
    }
    const me = userOf(request).id;
    const now = ctx.now();
    const after: (() => void)[] = [];
    const testId = ctx.db.transaction(() => {
      ctx.db.run(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET endpoint = excluded.endpoint, p256dh = excluded.p256dh,
           auth = excluded.auth, created_at = excluded.created_at, last_confirmed_at = NULL`,
        me,
        body.endpoint,
        body.keys.p256dh,
        body.keys.auth,
        now,
      );
      ctx.db.run("DELETE FROM notifications WHERE user_id = ? AND type = 'push_test'", me);
      return ctx.push.notify(me, 'push_test', null, now, (work) => after.push(work));
    });
    for (const work of after) work();
    return { testId };
  });

  app.delete(
    '/api/push/subscription',
    { preHandler: [authenticated, emptyBody] },
    async (request) => {
      ctx.db.run('DELETE FROM push_subscriptions WHERE user_id = ?', userOf(request).id);
      return { ok: true };
    },
  );

  app.post('/api/push/test', { preHandler: [authenticated, emptyBody] }, async (request) => {
    if (ctx.limits.expensive.hit(clientKey(request), ctx.now()) > 0)
      throw new HttpError(429, 'rate_limited');
    const me = userOf(request).id;
    pushLimit(me);
    if (!ctx.db.get('SELECT 1 FROM push_subscriptions WHERE user_id = ?', me))
      throw new HttpError(400, 'push_not_subscribed');
    const after: (() => void)[] = [];
    const testId = ctx.db.transaction(() => {
      ctx.db.run("DELETE FROM notifications WHERE user_id = ? AND type = 'push_test'", me);
      return ctx.push.notify(me, 'push_test', null, ctx.now(), (work) => after.push(work));
    });
    for (const work of after) work();
    return { testId };
  });

  /**
   * Status for the settings and the start check (SPEC 11.4 step 4): re-verify if the last
   * confirmation is older than the oldest unconfirmed push.
   */
  app.get('/api/push/status', { preHandler: authenticated }, async (request) => {
    const me = userOf(request).id;
    const subscription = ctx.db.get<{ endpoint: string; last_confirmed_at: number | null }>(
      'SELECT endpoint, last_confirmed_at FROM push_subscriptions WHERE user_id = ?',
      me,
    );
    if (!subscription) return { state: 'none' };
    const unconfirmed = ctx.db.get<{ oldest: number | null }>(
      "SELECT MIN(created_at) AS oldest FROM notifications WHERE user_id = ? AND push_state = 'sent' AND type != 'push_test'",
      me,
    )?.oldest;
    // The test counts as running for 60 s (SPEC 11.4); a failed send ends it at once.
    const test = ctx.db.get<{ created_at: number; push_state: string }>(
      "SELECT created_at, push_state FROM notifications WHERE user_id = ? AND type = 'push_test' ORDER BY created_at DESC LIMIT 1",
      me,
    );
    const now = ctx.now();
    const testRunning =
      test !== undefined &&
      test.push_state !== 'failed' &&
      now - test.created_at < SECURITY.PUSH_VERIFY_SECONDS * 1000;
    return {
      state:
        subscription.last_confirmed_at !== null
          ? 'confirmed'
          : testRunning
            ? 'testing'
            : 'unconfirmed',
      testFailed: test?.push_state === 'failed',
      endpoint: subscription.endpoint,
      confirmedAt: subscription.last_confirmed_at,
      needsVerification:
        subscription.last_confirmed_at === null ||
        (unconfirmed !== null &&
          unconfirmed !== undefined &&
          unconfirmed < now - 60 * 60 * 1000 &&
          unconfirmed > subscription.last_confirmed_at),
    };
  });

  /**
   * Confirmation from the service worker (SPEC 11.4 step 3): no session, only the random,
   * unguessable push ID. Background request – does not count as activity (SPEC 9.10).
   */
  app.post('/api/push/ack', async (request) => {
    if (ctx.limits.general.hit(clientKey(request), ctx.now()) > 0)
      throw new HttpError(429, 'rate_limited');
    const body = parse(PushAck, request.body);
    const now = ctx.now();
    const row = ctx.db.get<{ user_id: string }>(
      'SELECT user_id FROM notifications WHERE id = ?',
      body.id,
    );
    if (row) {
      ctx.db.transaction(() => {
        ctx.db.run('DELETE FROM notifications WHERE id = ?', body.id);
        ctx.db.run(
          'UPDATE push_subscriptions SET last_confirmed_at = ? WHERE user_id = ?',
          now,
          row.user_id,
        );
      });
      ctx.hub.notify(row.user_id, 'push', 'news');
    }
    return { ok: true };
  });

  // ── Neuigkeiten: Benachrichtigungen ohne bestätigten Push (SPEC 8.3, 11.5) ──
  app.get('/api/news', { preHandler: authenticated }, async (request) => ({
    news: ctx.db
      .all<{ id: string; type: string; ref: string | null; created_at: number }>(
        "SELECT id, type, ref, created_at FROM notifications WHERE user_id = ? AND type != 'push_test' ORDER BY created_at",
        userOf(request).id,
      )
      .map((row) => ({ id: row.id, type: row.type, ref: row.ref, createdAt: row.created_at })),
  }));

  app.post('/api/news/seen', { preHandler: authenticated }, async (request) => {
    const body = parse(IdList, request.body);
    const me = userOf(request).id;
    for (const id of body.ids)
      ctx.db.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', id, me);
    return { ok: true };
  });

  /** Live updates while visible (SPEC 11.6): only hints, never content. */
  app.get('/api/events', { preHandler: authenticated }, async (request, reply) => {
    const me = userOf(request).id;
    reply.hijack();
    const headers = reply.getHeaders();
    reply.raw.writeHead(200, {
      ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)])),
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    });
    reply.raw.write('retry: 5000\n\n');
    ctx.hub.add(me, reply.raw);
  });
}
