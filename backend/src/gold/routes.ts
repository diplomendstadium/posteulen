/**
 * Finance overview, transfers by owl and the daily gold (SPEC 8.6, 9.1). Transfers are
 * debited at departure and credited at arrival; a returning owl brings the gold back.
 */
import type { FastifyInstance } from 'fastify';
import { GOLD } from '@posteulen/shared/constants.ts';
import { transferProblem } from '@posteulen/shared/game/gold.ts';
import { CoverSend, GoldPrepare } from '@posteulen/shared/schemas/owls.ts';
import type { Context } from '../context.ts';
import { HttpError, parse } from '../http/errors.ts';
import { randomId, utcDay } from '../security/ids.ts';
import { ipKey } from '../security/ip.ts';
import { cookieSpec, requireUser, userOf } from '../auth/sessions.ts';
import { displayName, findContact } from '../contacts/model.ts';
import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';
import { planFlight } from '../flights/service.ts';
import {
  checkLetters,
  checkRecipients,
  chooseOwl,
  depart,
  newLetters,
  publicKeys,
  TOKEN_MS,
} from '../flights/transport.ts';
import { balance, debit } from './ledger.ts';

/**
 * Daily gold at 15:00 UTC for every active account, once per (missed) day (9.1.1, 4.5):
 * GOLD.DAILY during the first GOLD.DAILY_HIGH_DAYS days after the account was created,
 * GOLD.DAILY_LATER afterwards (v0.4).
 */
export function registerGoldJobs(ctx: Context): void {
  ctx.queue.registerDaily({
    name: 'daily_gold',
    hourUtc: GOLD.DAILY_HOUR_UTC,
    catchUpEveryDay: true,
    run: (_day, logicalAt) => {
      // Active at the time of the (catch-up) run (SPEC Anhang L.5).
      const activeSince = utcDay(
        Math.max(ctx.now(), logicalAt) - ACCOUNT.INACTIVE_AFTER_DAYS * TIME.DAY,
      );
      // created_on is the UTC day of the registration: that day and the following 29 pay more.
      const highSince = utcDay(logicalAt - GOLD.DAILY_HIGH_DAYS * TIME.DAY);
      const wage = 'CASE WHEN created_on > ? THEN ? ELSE ? END';
      ctx.db.run(
        `INSERT INTO transactions (user_id, at, type, amount)
           SELECT id, ?, 'daily', ${wage} FROM users WHERE state != 'deleting' AND last_active_date >= ?`,
        logicalAt,
        highSince,
        GOLD.DAILY,
        GOLD.DAILY_LATER,
        activeSince,
      );
      ctx.db.run(
        `UPDATE users SET gold = gold + ${wage} WHERE state != 'deleting' AND last_active_date >= ?`,
        highSince,
        GOLD.DAILY,
        GOLD.DAILY_LATER,
        activeSince,
      );
      ctx.db.run(
        `DELETE FROM transactions WHERE id IN (
           SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY at DESC, id DESC) AS n
                             FROM transactions) WHERE n > ?)`,
        GOLD.TRANSACTIONS_KEPT,
      );
    },
  });
}

export function registerGoldRoutes(app: FastifyInstance, ctx: Context): void {
  const authenticated = requireUser(ctx, cookieSpec(ctx.config.userOrigin, 'pe_session'));

  app.get('/api/finance', { preHandler: authenticated }, async (request) => {
    const me = userOf(request).id;
    const rows = ctx.db.all<{
      id: number;
      at: number;
      type: string;
      amount: number;
      counterpart_id: string | null;
      counterpart_label: string | null;
    }>(
      'SELECT id, at, type, amount, counterpart_id, counterpart_label FROM transactions WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT ?',
      me,
      GOLD.TRANSACTIONS_KEPT,
    );
    return {
      gold: balance(ctx.db, me),
      transactions: rows.map((row) => ({
        id: row.id,
        at: row.at,
        type: row.type,
        amount: row.amount,
        // Current name while connected, "unbekannt" otherwise (like the chat list, 8.4).
        counterpart:
          row.counterpart_label ??
          (row.counterpart_id
            ? findContact(ctx.db, me, row.counterpart_id)
              ? displayName(ctx.db, row.counterpart_id)
              : null
            : undefined),
      })),
    };
  });

  app.post('/api/gold/prepare', { preHandler: authenticated }, async (request) => {
    if (ctx.limits.expensive.hit(ipKey(request.ip), ctx.now()) > 0)
      throw new HttpError(429, 'rate_limited');
    const body = parse(GoldPrepare, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    checkRecipients(ctx, me, [body.recipient], now);
    const problem = transferProblem(balance(ctx.db, me), body.amount);
    if (problem) throw new HttpError(400, problem);
    const owl = chooseOwl(ctx, me, body.owlId, now);
    const planned = planFlight(ctx, {
      holderId: me,
      owl,
      recipients: [body.recipient],
      returnsHome: owl.returnsHome,
      now,
    });
    const letters = body.withCover ? newLetters([body.recipient], now) : [];
    const token = randomId();
    ctx.letterTokens.set(
      token,
      {
        senderId: me,
        purpose: 'gold',
        owlId: body.owlId,
        kind: 'cover_gold',
        parchment: 'small',
        recipients: [body.recipient],
        letters,
        gold: body.amount,
      },
      TOKEN_MS,
      now,
    );
    return {
      token,
      letters,
      keys: body.withCover ? publicKeys(ctx, [body.recipient]) : [],
      arrivesAt: planned.route[0]?.arrivesAt ?? now,
    };
  });

  app.post('/api/gold/send', { preHandler: authenticated }, async (request) => {
    const body = parse(CoverSend, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const token = ctx.letterTokens.take(body.token, now);
    if (!token || token.senderId !== me || token.purpose !== 'gold') {
      throw new HttpError(410, 'letter_token_expired');
    }
    const letters = checkLetters(token, body.cover ? [body.cover] : []);
    checkRecipients(ctx, me, token.recipients, now);
    const result = ctx.db.transaction(() => {
      // Checked again inside the transaction: the balance may have changed meanwhile.
      const problem = transferProblem(balance(ctx.db, me), token.gold);
      if (problem) throw new HttpError(400, problem);
      debit(ctx.db, me, 'transfer_out', token.gold, now, token.recipients[0] ?? null);
      const { route, owl } = depart(ctx, token, letters, now);
      return {
        owl: { name: owl.name, species: owl.species },
        arrivesAt: route.find((stop) => stop.type === 'deliver')?.arrivesAt ?? now,
      };
    });
    ctx.hub.notify(me, 'profile', 'finance', 'owls', 'map', 'chats');
    return result;
  });
}
