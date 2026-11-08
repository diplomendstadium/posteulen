/** Account settings (SPEC 7.3–7.5, 8.10): change name or home, delete the account. */
import type { FastifyInstance } from 'fastify';
import { isLand, roundHome } from '@posteulen/shared/map/landmask.ts';
import { checkUserName } from '@posteulen/shared/names.ts';
import {
  AccountDelete,
  HomeChange,
  LanguageSetting,
  NameChange,
  LetterSettings,
} from '@posteulen/shared/schemas/auth.ts';
import type { Context } from '../context.ts';
import { HttpError, parse } from '../http/errors.ts';
import { utcDay } from '../security/ids.ts';
import { clearSessionCookie, cookieSpec, requireUser, userOf } from '../auth/sessions.ts';
import { nameLocked, profileOf, utcMonth } from '../auth/user-routes.ts';
import { addSystemMessage } from '../messages/system.ts';
import { rerouteForMove } from '../flights/service.ts';
import { contactIdsOf, lockName, requestDeletion } from './lifecycle.ts';
import { purgeOldLetters } from '../letters/retention.ts';
import { sendFeedback } from '../admin/feedback.ts';
import { FeedbackSend } from '@posteulen/shared/schemas/feedback.ts';
import { ipKey } from '../security/ip.ts';

export function registerAccountRoutes(app: FastifyInstance, ctx: Context): void {
  const spec = cookieSpec(ctx.config.userOrigin, 'pe_session');
  const authenticated = requireUser(ctx, spec);

  /** v0.7.1: a short, unencrypted message to the admin, once per calendar day (8.10). */
  app.post('/api/feedback', { preHandler: authenticated }, async (request) => {
    if (ctx.limits.expensive.hit(ipKey(request.ip), ctx.now()) > 0)
      throw new HttpError(429, 'rate_limited');
    const body = parse(FeedbackSend, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    ctx.db.transaction(() => sendFeedback(ctx, me, body.text, now));
    ctx.hub.notify(me, 'profile');
    return { profile: profileOf(ctx, me) };
  });

  /** Once per calendar year; all contacts are told; the old name is locked 90 days (7.4). */
  app.patch('/api/account/name', { preHandler: authenticated }, async (request) => {
    const body = parse(NameChange, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const year = new Date(now).getUTCFullYear();
    const name = checkUserName(body.name);
    if (typeof name === 'string') throw new HttpError(400, `name_${name}`);
    ctx.db.transaction(() => {
      const user = ctx.db.get<{
        name_display: string;
        name_key: string;
        name_changed_year: number | null;
      }>('SELECT name_display, name_key, name_changed_year FROM users WHERE id = ?', me);
      if (!user) throw new HttpError(401, 'unauthorized');
      if (user.name_changed_year !== null && user.name_changed_year >= year) {
        throw new HttpError(400, 'name_change_blocked');
      }
      if (name.key !== user.name_key) {
        const taken =
          ctx.db.get('SELECT 1 FROM users WHERE name_key = ?', name.key) !== undefined ||
          nameLocked(ctx, name.key, now) ||
          ctx.reservations.values(now).some((r) => r.key === name.key);
        if (taken) throw new HttpError(409, 'name_unavailable');
        lockName(ctx, user.name_key, now);
      }
      ctx.db.run(
        'UPDATE users SET name_display = ?, name_key = ?, name_changed_year = ? WHERE id = ?',
        name.display,
        name.key,
        year,
        me,
      );
      for (const other of contactIdsOf(ctx, me)) {
        addSystemMessage(
          ctx,
          other,
          'contact_renamed',
          { old: user.name_display, name: name.display },
          now,
        );
        ctx.hub.notify(other, 'contacts', 'chats');
      }
    });
    ctx.hub.notify(me, 'profile');
    return { profile: profileOf(ctx, me) };
  });

  /** Three times per calendar month, on land, rounded to 0.01°; flights adjust (7.3, 9.4.6). */
  app.patch('/api/account/home', { preHandler: authenticated }, async (request) => {
    const body = parse(HomeChange, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const { latE2, lonE2 } = roundHome(body.home.lat, body.home.lon);
    if (!isLand(ctx.landMask, latE2 / 100, lonE2 / 100)) throw new HttpError(400, 'home_invalid');
    const after: (() => void)[] = [];
    ctx.db.transaction(() => {
      if (profileOf(ctx, me).homeChangesLeft <= 0) throw new HttpError(400, 'home_change_blocked');
      const month = utcMonth(now);
      ctx.db.run(
        `UPDATE users SET home_lat = ?, home_lon = ?, home_changed_on = ?,
                          home_moves_count = CASE WHEN home_moves_month = ? THEN home_moves_count + 1 ELSE 1 END,
                          home_moves_month = ?
          WHERE id = ?`,
        latE2,
        lonE2,
        utcDay(now),
        month,
        month,
        me,
      );
      rerouteForMove(ctx, me, now, (work) => after.push(work));
    });
    for (const work of after) work();
    for (const other of contactIdsOf(ctx, me)) ctx.hub.notify(other, 'map');
    ctx.hub.notify(me, 'profile', 'map');
    return { profile: profileOf(ctx, me) };
  });

  /**
   * Letter settings (v0.2): how long one's own letters and system messages are kept (30, 90,
   * 180 or 365 days; a shorter period deletes at once what is already older) and whether
   * letters are shown in handwriting.
   */
  app.patch('/api/account/letters', { preHandler: authenticated }, async (request) => {
    const body = parse(LetterSettings, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    ctx.db.transaction(() => {
      ctx.db.run(
        'UPDATE users SET letter_retention_days = ?, letters_print = ? WHERE id = ?',
        body.retentionDays,
        body.print ? 1 : 0,
        me,
      );
      purgeOldLetters(ctx, now, me);
    });
    ctx.hub.notify(me, 'profile', 'chats');
    return { profile: profileOf(ctx, me) };
  });

  /** Deletion with a fresh password check; logout at once, 24 hours to change one's mind (7.5). */
  /** Preferred language (v0.4): the settings and the flag in the top right corner. */
  app.patch('/api/account/language', { preHandler: authenticated }, async (request) => {
    const body = parse(LanguageSetting, request.body);
    const me = userOf(request).id;
    ctx.db.run('UPDATE users SET language = ? WHERE id = ?', body.language, me);
    // Bot names (aunt/uncle) and loan owl names follow the language.
    ctx.hub.notify(me, 'profile', 'contacts', 'owls', 'map');
    return { profile: profileOf(ctx, me) };
  });

  app.post('/api/account/delete', { preHandler: authenticated }, async (request, reply) => {
    const body = parse(AccountDelete, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const token = ctx.reauthTokens.take(body.token, now);
    if (!token || token.subject !== me || token.purpose !== 'delete') {
      throw new HttpError(403, 'reauth_required');
    }
    ctx.db.transaction(() => requestDeletion(ctx, me, now));
    ctx.hub.close(me);
    clearSessionCookie(reply, spec);
    return { ok: true };
  });
}
