/**
 * Letters and chats (SPEC 5.8, 8.4). The server stores only ciphertext, wrapped keys and
 * metadata; it assigns letter IDs and send time and checks exact ciphertext lengths.
 * Stage 2: a placeholder owl with a fixed flight time (SPEC 18); real flights follow in stage 3.
 */
import type { FastifyInstance } from 'fastify';
import { GOLD, TIME } from '@posteulen/shared/constants.ts';
import { fromBase64Url, toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { ciphertextBytes } from '@posteulen/shared/crypto/letter.ts';
import { WRAPPED_KEY_BYTES } from '@posteulen/shared/crypto/hpke.ts';
import { Id } from '@posteulen/shared/schemas/common.ts';
import { IdList, LetterPrepare, LetterSend } from '@posteulen/shared/schemas/letters.ts';
import type { Context } from '../context.ts';
import { HttpError, parse } from '../http/errors.ts';
import { randomId, utcDay } from '../security/ids.ts';
import { ipKey } from '../security/ip.ts';
import { cookieSpec, requireUser, userOf } from '../auth/sessions.ts';
import { displayName, findContact, recipientProblem } from '../contacts/model.ts';

/** Placeholder owl of stage 2 (SPEC 18). */
export const PLACEHOLDER_OWL = { name: 'Postkauz Paul', species: 'waldkauz' } as const;

export function registerLetterHandlers(ctx: Context): void {
  ctx.queue.on('deliver', (event, tools) => {
    const letter = ctx.db.get<{
      id: string;
      sender_id: string;
      recipient_id: string;
      status: string;
    }>('SELECT id, sender_id, recipient_id, status FROM letters WHERE id = ?', event.ref);
    // Idempotent: a letter is delivered only once (SPEC 4.5).
    if (!letter || letter.status !== 'in_flight') return;
    ctx.db.run("UPDATE letters SET status = 'delivered' WHERE id = ?", letter.id);
    ctx.db.run(
      `INSERT INTO chats (owner_id, peer_id, peer_kind, last_activity_at, unread) VALUES (?, ?, 'user', ?, 1)
       ON CONFLICT (owner_id, peer_id) DO UPDATE SET last_activity_at = excluded.last_activity_at, unread = unread + 1`,
      letter.recipient_id,
      letter.sender_id,
      event.logicalAt,
    );
    // Admin statistics: only daily counters, letters between people (SPEC 13 item 2).
    ctx.db.run(
      `INSERT INTO stats_daily (day, human_letters) VALUES (?, 1)
       ON CONFLICT (day) DO UPDATE SET human_letters = human_letters + 1`,
      utcDay(event.logicalAt),
    );
    ctx.push.notify(letter.recipient_id, 'letter_arrived', letter.id, event.logicalAt, tools.after);
    tools.after(() => {
      ctx.hub.notify(letter.recipient_id, 'chats');
      ctx.hub.notify(letter.sender_id, 'chats');
    });
  });
}

export function registerLetterRoutes(app: FastifyInstance, ctx: Context): void {
  const authenticated = requireUser(ctx, cookieSpec(ctx.config.userOrigin, 'pe_session'));

  function checkRecipients(senderId: string, recipients: readonly string[], now: number): void {
    for (const recipientId of recipients) {
      const problem = recipientProblem(ctx, senderId, recipientId, now);
      if (problem) throw new HttpError(400, problem, { recipientId });
    }
  }

  function costOf(parchment: 'small' | 'large'): number {
    // Large parchment costs once per owl, also with several recipients (SPEC 5.9).
    return parchment === 'large' ? GOLD.LARGE_PARCHMENT_SURCHARGE : 0;
  }

  app.post('/api/letters/prepare', { preHandler: authenticated }, async (request) => {
    if (ctx.limits.expensive.hit(ipKey(request.ip), ctx.now()) > 0)
      throw new HttpError(429, 'rate_limited');
    const body = parse(LetterPrepare, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    checkRecipients(me, body.recipients, now);
    const gold = ctx.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', me)?.gold ?? 0;
    const cost = costOf(body.parchment);
    if (gold < 0 || gold < cost) throw new HttpError(400, 'gold_insufficient');
    const letters = body.recipients.map((recipientId) => ({
      recipientId,
      letterId: randomId(),
      sentAt: now,
    }));
    const token = randomId();
    ctx.letterTokens.set(
      token,
      { senderId: me, kind: 'letter', parchment: body.parchment, letters },
      5 * TIME.MINUTE,
      now,
    );
    const keys = body.recipients.map((userId) => {
      const row = ctx.db.get<{ x25519_pub: Uint8Array; ed25519_pub: Uint8Array }>(
        'SELECT x25519_pub, ed25519_pub FROM users WHERE id = ?',
        userId,
      );
      return {
        userId,
        ed25519: toBase64Url(row?.ed25519_pub ?? new Uint8Array()),
        x25519: toBase64Url(row?.x25519_pub ?? new Uint8Array()),
      };
    });
    return {
      token,
      letters,
      keys,
      cost,
      preview: {
        owl: PLACEHOLDER_OWL,
        arrivals: body.recipients.map((recipientId, index) => ({
          recipientId,
          at: now + (index + 1) * ctx.flightMinutes * TIME.MINUTE,
        })),
      },
    };
  });

  app.post(
    '/api/letters/send',
    { preHandler: authenticated, bodyLimit: 128 * 1024 },
    async (request) => {
      if (ctx.limits.expensive.hit(ipKey(request.ip), ctx.now()) > 0)
        throw new HttpError(429, 'rate_limited');
      const body = parse(LetterSend, request.body);
      const me = userOf(request).id;
      const now = ctx.now();
      const token = ctx.letterTokens.take(body.token, now);
      if (!token || token.senderId !== me) throw new HttpError(410, 'letter_token_expired');
      const expected = new Map(token.letters.map((letter) => [letter.letterId, letter]));
      if (
        body.items.length !== expected.size ||
        body.items.some((item) => !expected.has(item.letterId))
      ) {
        throw new HttpError(400, 'bad_request');
      }
      const items = body.items.map((item) => {
        const meta = expected.get(item.letterId);
        if (!meta) throw new HttpError(400, 'bad_request');
        const ciphertext = fromBase64Url(item.ciphertext);
        const wrapRecipient = fromBase64Url(item.wrapRecipient);
        const wrapSender = fromBase64Url(item.wrapSender);
        // Exact lengths per parchment (SPEC 5.9).
        if (ciphertext.length !== ciphertextBytes(token.parchment))
          throw new HttpError(400, 'bad_request');
        if (wrapRecipient.length !== WRAPPED_KEY_BYTES || wrapSender.length !== WRAPPED_KEY_BYTES) {
          throw new HttpError(400, 'bad_request');
        }
        return { ...item, ciphertext, wrapRecipient, wrapSender, meta };
      });
      checkRecipients(
        me,
        token.letters.map((letter) => letter.recipientId),
        now,
      );
      const order = token.letters.map((letter) => letter.letterId);
      items.sort((a, b) => order.indexOf(a.letterId) - order.indexOf(b.letterId));
      const result = ctx.db.transaction(() => {
        const cost = costOf(token.parchment);
        if (cost > 0) {
          const charged = ctx.db.run(
            'UPDATE users SET gold = gold - ? WHERE id = ? AND gold >= ? AND gold >= 0',
            cost,
            me,
            cost,
          );
          if (charged.changes !== 1) throw new HttpError(400, 'gold_insufficient');
        }
        return items.map((item, index) => {
          const arrivesAt = now + (index + 1) * ctx.flightMinutes * TIME.MINUTE;
          ctx.db.run(
            `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, ciphertext,
                                  wrap_recipient, wrap_sender, status, owl_name, owl_species)
             VALUES (?, ?, ?, 'letter', ?, ?, ?, ?, ?, ?, 'in_flight', ?, ?)`,
            item.letterId,
            me,
            item.meta.recipientId,
            token.parchment,
            item.meta.sentAt,
            arrivesAt,
            item.ciphertext,
            item.wrapRecipient,
            item.wrapSender,
            PLACEHOLDER_OWL.name,
            PLACEHOLDER_OWL.species,
          );
          ctx.db.run(
            `INSERT INTO chats (owner_id, peer_id, peer_kind, last_activity_at) VALUES (?, ?, 'user', ?)
             ON CONFLICT (owner_id, peer_id) DO UPDATE SET last_activity_at = excluded.last_activity_at`,
            me,
            item.meta.recipientId,
            now,
          );
          ctx.queue.schedule('deliver', item.letterId, arrivesAt);
          return { id: item.letterId, recipientId: item.meta.recipientId, arrivesAt };
        });
      });
      ctx.hub.notify(me, 'chats', 'profile');
      return { letters: result };
    },
  );

  app.get('/api/chats', { preHandler: authenticated }, async (request) => {
    const me = userOf(request).id;
    const chats = ctx.db.all<{
      peer_id: string;
      peer_kind: string;
      last_activity_at: number;
      unread: number;
    }>(
      'SELECT peer_id, peer_kind, last_activity_at, unread FROM chats WHERE owner_id = ? ORDER BY last_activity_at DESC',
      me,
    );
    const systemUnread =
      ctx.db.get<{ n: number }>(
        'SELECT COUNT(*) AS n FROM system_messages WHERE user_id = ? AND seen = 0',
        me,
      )?.n ?? 0;
    return {
      system: { unread: systemUnread },
      chats: chats.map((chat) => {
        const contact = findContact(ctx.db, me, chat.peer_id);
        return {
          peerId: chat.peer_id,
          peerKind: chat.peer_kind,
          // Current name only while connected; otherwise "unbekannt" (SPEC 8.4).
          name: contact ? displayName(ctx.db, chat.peer_id) : null,
          isContact: contact !== undefined,
          lastActivityAt: chat.last_activity_at,
          unread: chat.unread,
        };
      }),
    };
  });

  app.get('/api/chats/:peer/letters', { preHandler: authenticated }, async (request) => {
    const peer = parse(Id, (request.params as { peer?: unknown }).peer);
    const me = userOf(request).id;
    const rows = ctx.db.all<{
      id: string;
      sender_id: string;
      recipient_id: string;
      kind: string;
      parchment: string;
      sent_at: number;
      arrives_at: number;
      ciphertext: Uint8Array | null;
      wrap_recipient: Uint8Array | null;
      wrap_sender: Uint8Array | null;
      status: string;
      read: number;
      arrival_seen: number;
      owl_name: string;
      owl_species: string;
    }>(
      `SELECT * FROM letters
        WHERE (sender_id = ? AND recipient_id = ? AND sender_has = 1)
           OR (sender_id = ? AND recipient_id = ? AND recipient_has = 1 AND status = 'delivered')
        ORDER BY sent_at, id`,
      me,
      peer,
      peer,
      me,
    );
    return {
      letters: rows.map((row) => {
        const mine = row.sender_id === me;
        return {
          id: row.id,
          senderId: row.sender_id,
          recipientId: row.recipient_id,
          kind: row.kind,
          parchment: row.parchment,
          sentAt: row.sent_at,
          arrivesAt: row.arrives_at,
          status: row.status,
          read: row.read === 1,
          arrivalSeen: row.arrival_seen === 1,
          owl: { name: row.owl_name, species: row.owl_species },
          role: mine ? 'sender' : 'recipient',
          ciphertext: row.ciphertext ? toBase64Url(row.ciphertext) : null,
          wrap: mine
            ? row.wrap_sender
              ? toBase64Url(row.wrap_sender)
              : null
            : row.wrap_recipient
              ? toBase64Url(row.wrap_recipient)
              : null,
        };
      }),
    };
  });

  /** Read receipts: only yes/no, no time (SPEC 8.4). */
  app.post('/api/letters/read', { preHandler: authenticated }, async (request) => {
    const body = parse(IdList, request.body);
    const me = userOf(request).id;
    const senders = new Set<string>();
    ctx.db.transaction(() => {
      for (const id of body.ids) {
        const letter = ctx.db.get<{ sender_id: string }>(
          "SELECT sender_id FROM letters WHERE id = ? AND recipient_id = ? AND status = 'delivered' AND read = 0",
          id,
          me,
        );
        if (!letter) continue;
        ctx.db.run('UPDATE letters SET read = 1 WHERE id = ?', id);
        senders.add(letter.sender_id);
      }
      for (const sender of senders) {
        ctx.db.run(
          `UPDATE chats SET unread = (SELECT COUNT(*) FROM letters WHERE recipient_id = ? AND sender_id = ?
                                        AND status = 'delivered' AND read = 0 AND recipient_has = 1)
            WHERE owner_id = ? AND peer_id = ?`,
          me,
          sender,
          me,
          sender,
        );
      }
    });
    for (const sender of senders) ctx.hub.notify(sender, 'chats');
    return { ok: true };
  });

  app.post('/api/letters/arrival-seen', { preHandler: authenticated }, async (request) => {
    const body = parse(IdList, request.body);
    const me = userOf(request).id;
    for (const id of body.ids)
      ctx.db.run('UPDATE letters SET arrival_seen = 1 WHERE id = ? AND recipient_id = ?', id, me);
    return { ok: true };
  });

  /** Deletes the own copies of all letters of a chat for real (SPEC 8.4). */
  app.delete('/api/chats/:peer', { preHandler: authenticated }, async (request) => {
    const peer = parse(Id, (request.params as { peer?: unknown }).peer);
    const me = userOf(request).id;
    ctx.db.transaction(() => {
      ctx.db.run(
        'UPDATE letters SET sender_has = 0 WHERE sender_id = ? AND recipient_id = ?',
        me,
        peer,
      );
      ctx.db.run(
        'UPDATE letters SET recipient_has = 0 WHERE recipient_id = ? AND sender_id = ?',
        me,
        peer,
      );
      ctx.db.run('DELETE FROM letters WHERE sender_has = 0 AND recipient_has = 0');
      ctx.db.run('DELETE FROM chats WHERE owner_id = ? AND peer_id = ?', me, peer);
      if (!findContact(ctx.db, me, peer)) {
        ctx.db.run('DELETE FROM vault_entries WHERE owner_id = ? AND contact_id = ?', me, peer);
      }
    });
    ctx.hub.notify(me, 'chats');
    return { ok: true };
  });

  app.get('/api/system-messages', { preHandler: authenticated }, async (request) => ({
    messages: ctx.db
      .all<{ id: string; type: string; params: string; created_at: number; seen: number }>(
        'SELECT id, type, params, created_at, seen FROM system_messages WHERE user_id = ? ORDER BY created_at, rowid',
        userOf(request).id,
      )
      .map((row) => ({
        id: row.id,
        type: row.type,
        params: JSON.parse(row.params) as Record<string, string | number>,
        createdAt: row.created_at,
        seen: row.seen === 1,
      })),
  }));

  app.post('/api/system-messages/seen', { preHandler: authenticated }, async (request) => {
    ctx.db.run('UPDATE system_messages SET seen = 1 WHERE user_id = ?', userOf(request).id);
    return { ok: true };
  });
}
