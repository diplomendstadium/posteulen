/** Letters to bots (SPEC 10.1): plain text, one recipient, once per 24 hours. */
import type { FastifyInstance } from 'fastify';
import { GOLD, SECURITY } from '@posteulen/shared/constants.ts';
import { BotLetterSend } from '@posteulen/shared/schemas/letters.ts';
import { letterTextError } from '@posteulen/shared/text-rules.ts';
import type { Context } from '../context.ts';
import { HttpError, emptyBody, parse } from '../http/errors.ts';
import { randomId } from '../security/ids.ts';
import { ipKey } from '../security/ip.ts';
import { cookieSpec, requireUser, userOf } from '../auth/sessions.ts';
import { debit } from '../gold/ledger.ts';
import { checkRecipients, depart } from '../flights/transport.ts';
import { removeAllBots } from './service.ts';

export function registerBotRoutes(app: FastifyInstance, ctx: Context): void {
  const authenticated = requireUser(ctx, cookieSpec(ctx.config.userOrigin, 'pe_session'));

  /** v0.7.2: remove all bots of this account for good, the Erklärbär included (settings). */
  app.post('/api/bots/remove-all', { preHandler: [authenticated, emptyBody] }, async (request) => {
    const me = userOf(request).id;
    const after: (() => void)[] = [];
    const removed = ctx.db.transaction(() =>
      removeAllBots(ctx, me, ctx.now(), (work) => after.push(work)),
    );
    for (const work of after) work();
    return { removed };
  });

  app.post(
    '/api/bot-letters/send',
    { preHandler: authenticated, bodyLimit: SECURITY.MAX_BOT_LETTER_REQUEST_BYTES },
    async (request) => {
      if (ctx.limits.expensive.hit(ipKey(request.ip), ctx.now()) > 0)
        throw new HttpError(429, 'rate_limited');
      const body = parse(BotLetterSend, request.body);
      const me = userOf(request).id;
      const now = ctx.now();
      checkRecipients(ctx, me, [body.botId], now, { allowBots: true });
      const textError = letterTextError(body.text, body.parchment);
      if (textError)
        throw new HttpError(400, textError === 'too_long' ? 'letter_too_long' : 'letter_invalid');
      const result = ctx.db.transaction(() => {
        if (body.parchment === 'large')
          debit(ctx.db, me, 'large_parchment', GOLD.LARGE_PARCHMENT_SURCHARGE, now);
        const { flightId, route, owl } = depart(
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
          body.text.normalize('NFC'),
          owl.name,
          owl.species,
          flightId,
        );
        ctx.db.run(
          `INSERT INTO chats (owner_id, peer_id, peer_kind, last_activity_at) VALUES (?, ?, 'bot', ?)
         ON CONFLICT (owner_id, peer_id) DO UPDATE SET last_activity_at = excluded.last_activity_at`,
          me,
          body.botId,
          now,
        );
        ctx.db.run('UPDATE bots SET last_user_letter_at = ? WHERE id = ?', now, body.botId);
        return {
          owl: { name: owl.name, species: owl.species },
          letters: [{ id, recipientId: body.botId, arrivesAt }],
          returnsAt: route.find((stop) => stop.type === 'home')?.arrivesAt ?? null,
        };
      });
      ctx.hub.notify(me, 'chats', 'profile', 'owls', 'map', 'finance', 'contacts');
      return result;
    },
  );
}
