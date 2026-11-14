/**
 * Letters to bots (SPEC 10.1): plain text, one recipient, one letter per calendar day (UTC, v0.8)
 * – to the Erklärbär and to the bots of the control centre. A control-centre bot can always be
 * answered with its owl while it rests at the player; with own or loan owls only if the bot
 * allows it (SPEC 10.7).
 */
import type { FastifyInstance } from 'fastify';
import { GOLD, SECURITY } from '@posteulen/shared/constants.ts';
import { BotLetterSend } from '@posteulen/shared/schemas/letters.ts';
import { letterTextError } from '@posteulen/shared/text-rules.ts';
import type { Context } from '../context.ts';
import { HttpError, emptyBody, parse } from '../http/errors.ts';
import { randomId, utcDay } from '../security/ids.ts';
import { clientKey } from '../security/ip.ts';
import { userCookieSpec, requireUser, userOf } from '../auth/sessions.ts';
import { debit } from '../gold/ledger.ts';
import { checkRecipients, depart, departWithBotReply, guestRefOwl } from '../flights/transport.ts';
import { removeAllCentralBotsForPlayer } from '../central/service.ts';
import { playerBot } from './registry.ts';
import { removeAllBots } from './service.ts';

export function registerBotRoutes(app: FastifyInstance, ctx: Context): void {
  const authenticated = requireUser(ctx, userCookieSpec(ctx.config));

  /**
   * "Alle Bots entfernen" (settings): the Erklärbär and every bot of the control centre go for
   * good, and bots created later never write to this account (v0.8, SPEC 8.10).
   */
  app.post('/api/bots/remove-all', { preHandler: [authenticated, emptyBody] }, async (request) => {
    const me = userOf(request).id;
    const after: (() => void)[] = [];
    const removed = ctx.db.transaction(() => {
      const now = ctx.now();
      const push = (work: () => void) => after.push(work);
      return removeAllBots(ctx, me, now, push) + removeAllCentralBotsForPlayer(ctx, me, now, push);
    });
    for (const work of after) work();
    return { removed };
  });

  app.post(
    '/api/bot-letters/send',
    { preHandler: authenticated, bodyLimit: SECURITY.MAX_BOT_LETTER_REQUEST_BYTES },
    async (request) => {
      if (ctx.limits.expensive.hit(clientKey(request), ctx.now()) > 0)
        throw new HttpError(429, 'rate_limited');
      const body = parse(BotLetterSend, request.body);
      const me = userOf(request).id;
      const now = ctx.now();
      checkRecipients(ctx, me, [body.botId], now, { allowBots: true });
      const bot = playerBot(ctx, me, body.botId);
      if (!bot) throw new HttpError(400, 'recipient_invalid');
      const textError = letterTextError(body.text, body.parchment);
      if (textError)
        throw new HttpError(400, textError === 'too_long' ? 'letter_too_long' : 'letter_invalid');
      const guest = guestRefOwl(body.owlId) !== null;
      // v0.8: own and loan owls only where the bot allows it; its resting owl always.
      if (bot.kind === 'central' && !guest && bot.bot.player_owls !== 1)
        throw new HttpError(400, 'bot_owls_only');
      const after: (() => void)[] = [];
      const result = ctx.db.transaction(() => {
        if (body.parchment === 'large')
          debit(ctx.db, me, 'large_parchment', GOLD.LARGE_PARCHMENT_SURCHARGE, now);
        const text = body.text.normalize('NFC');
        let letter: { id: string; arrivesAt: number };
        let owl: { name: string; species: string };
        let returnsAt: number | null = null;
        if (guest) {
          if (bot.kind !== 'central') throw new HttpError(400, 'owl_not_ready');
          const sent = departWithBotReply(
            ctx,
            me,
            body.botId,
            body.owlId,
            body.parchment,
            text,
            now,
            (work) => after.push(work),
          );
          letter = { id: sent.letterId, arrivesAt: sent.arrivesAt };
          owl = { name: sent.owl.name, species: sent.owl.species };
        } else {
          const {
            flightId,
            route,
            owl: chosen,
          } = depart(
            ctx,
            {
              senderId: me,
              purpose: 'letter',
              owlId: body.owlId,
              kind: 'letter',
              parchment: body.parchment,
              recipients: [body.botId],
              letters: [],
              gold: 0,
            },
            [],
            now,
          );
          const arrivesAt = route.find((stop) => stop.type === 'deliver')?.arrivesAt ?? now;
          const id = randomId();
          ctx.db.run(
            `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, plaintext,
                                  status, owl_name, owl_species, flight_id)
             VALUES (?, ?, ?, 'letter', ?, ?, ?, ?, 'in_flight', ?, ?, ?)`,
            id,
            me,
            body.botId,
            body.parchment,
            now,
            arrivesAt,
            text,
            chosen.name,
            chosen.species,
            flightId,
          );
          letter = { id, arrivesAt };
          owl = { name: chosen.name, species: chosen.species };
          returnsAt = route.find((stop) => stop.type === 'home')?.arrivesAt ?? null;
        }
        ctx.db.run(
          `INSERT INTO chats (owner_id, peer_id, peer_kind, last_activity_at) VALUES (?, ?, 'bot', ?)
           ON CONFLICT (owner_id, peer_id) DO UPDATE SET last_activity_at = excluded.last_activity_at`,
          me,
          body.botId,
          now,
        );
        if (bot.kind === 'explainer') {
          ctx.db.run('UPDATE bots SET last_user_letter_at = ? WHERE id = ?', now, body.botId);
        } else {
          ctx.db.run(
            'UPDATE central_bot_players SET last_letter_day = ? WHERE bot_id = ? AND user_id = ?',
            utcDay(now),
            body.botId,
            me,
          );
        }
        return {
          owl,
          letters: [{ id: letter.id, recipientId: body.botId, arrivesAt: letter.arrivesAt }],
          returnsAt,
        };
      });
      for (const work of after) work();
      ctx.hub.notify(me, 'chats', 'profile', 'owls', 'map', 'finance', 'contacts');
      return result;
    },
  );
}
