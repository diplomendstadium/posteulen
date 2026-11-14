/**
 * Address book (SPEC 8.8), coupling, contact vault and key warning (SPEC 5.7).
 * The answer to a contact request never reveals whether the name exists.
 */
import { botTitle, ownBot, removeBot, type BotRow } from '../bots/service.ts';
import { playerBot, writableFrom } from '../bots/registry.ts';
import { removeCentralBotForPlayer } from '../central/service.ts';
import type { CentralBotRow } from '../central/model.ts';
import type { FastifyInstance } from 'fastify';
import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';
import { toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { normalizeName } from '@posteulen/shared/names.ts';
import { Id } from '@posteulen/shared/schemas/common.ts';
import { ContactRequest, VaultPut } from '@posteulen/shared/schemas/letters.ts';
import type { Context } from '../context.ts';
import { HttpError, parse, emptyBody } from '../http/errors.ts';
import { hmac, randomId, utcDay } from '../security/ids.ts';
import { clientKey } from '../security/ip.ts';
import { addSystemMessage } from '../messages/system.ts';
import { userCookieSpec, requireUser, userOf } from '../auth/sessions.ts';
import { SERVER_CONTEXTS } from '@posteulen/shared/crypto/contexts.ts';
import { deriveServerKey } from '../secrets.ts';
import {
  displayName,
  findContact,
  hasKeyWarning,
  isActiveDate,
  pair,
  removeContact,
} from './model.ts';

export async function registerContactRoutes(app: FastifyInstance, ctx: Context): Promise<void> {
  const authenticated = requireUser(ctx, userCookieSpec(ctx.config));
  const requestKey = await deriveServerKey(ctx.secrets, SERVER_CONTEXTS.CONTACT_REQUEST);
  const targetHmac = (nameKey: string): Buffer => hmac(requestKey, nameKey);

  app.post('/api/contacts/requests', { preHandler: authenticated }, async (request) => {
    const wait = ctx.limits.expensive.hit(clientKey(request), ctx.now());
    if (wait > 0) throw new HttpError(429, 'rate_limited');
    const body = parse(ContactRequest, request.body);
    const me = userOf(request).id;
    const now = ctx.now();
    const today = utcDay(now);
    // v0.8.2: spaces an autocorrection added around the name do not count.
    const nameKey = normalizeName(body.name.trim());
    ctx.db.transaction(() => {
      const self = ctx.db.get<{
        name_key: string;
        contact_requests_day: string | null;
        contact_requests_count: number;
      }>(
        'SELECT name_key, contact_requests_day, contact_requests_count FROM users WHERE id = ?',
        me,
      );
      if (!self) throw new HttpError(401, 'unauthorized');
      const count = self.contact_requests_day === today ? self.contact_requests_count : 0;
      if (count >= ACCOUNT.CONTACT_REQUESTS_PER_DAY) throw new HttpError(429, 'contact_limit');
      ctx.db.run(
        'UPDATE users SET contact_requests_day = ?, contact_requests_count = ? WHERE id = ?',
        today,
        count + 1,
        me,
      );
      ctx.db.run('DELETE FROM contact_requests WHERE expires_at <= ?', now);
      if (nameKey === self.name_key) return;
      const target = ctx.db.get<{ id: string }>(
        "SELECT id FROM users WHERE name_key = ? AND state = 'active'",
        nameKey,
      );
      if (target && findContact(ctx.db, me, target.id)) return;
      const reverse = target
        ? ctx.db.get<{ id: string }>(
            'SELECT id FROM contact_requests WHERE from_id = ? AND target_hmac = ? AND expires_at > ?',
            target.id,
            targetHmac(self.name_key),
            now,
          )
        : undefined;
      if (target && reverse) {
        // Both added each other: connected (SPEC 8.8).
        const [lo, hi] = pair(me, target.id);
        ctx.db.run('INSERT INTO contacts (user_lo, user_hi, since) VALUES (?, ?, ?)', lo, hi, now);
        ctx.db.run('DELETE FROM contact_requests WHERE id = ?', reverse.id);
        ctx.db.run(
          'DELETE FROM contact_requests WHERE from_id = ? AND target_hmac = ?',
          me,
          targetHmac(nameKey),
        );
        addSystemMessage(
          ctx,
          me,
          'contact_confirmed',
          { name: displayName(ctx.db, target.id) ?? '' },
          now,
        );
        addSystemMessage(
          ctx,
          target.id,
          'contact_confirmed',
          { name: displayName(ctx.db, me) ?? '' },
          now,
        );
        ctx.hub.notify(me, 'contacts');
        ctx.hub.notify(target.id, 'contacts');
        return;
      }
      ctx.db.run(
        `INSERT INTO contact_requests (id, from_id, target_hmac, label, expires_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (from_id, target_hmac) DO UPDATE SET label = excluded.label, expires_at = excluded.expires_at`,
        randomId(),
        me,
        targetHmac(nameKey),
        body.label,
        now + ACCOUNT.CONTACT_REQUEST_EXPIRY_HOURS * TIME.HOUR,
      );
    });
    // Always the same answer, whether the name exists or not (SPEC 8.8).
    return { ok: true };
  });

  app.delete(
    '/api/contacts/requests/:id',
    { preHandler: [authenticated, emptyBody] },
    async (request) => {
      const id = parse(Id, (request.params as { id?: unknown }).id);
      ctx.db.run(
        'DELETE FROM contact_requests WHERE id = ? AND from_id = ?',
        id,
        userOf(request).id,
      );
      return { ok: true };
    },
  );

  app.get('/api/contacts', { preHandler: authenticated }, async (request) => {
    const me = userOf(request).id;
    const now = ctx.now();
    const rows = ctx.db.all<{
      other: string;
      since: number;
      warn_mine: number;
      warn_theirs: number;
      name_display: string;
      last_active_date: string;
    }>(
      `SELECT CASE WHEN c.user_lo = ? THEN c.user_hi ELSE c.user_lo END AS other, c.since,
              CASE WHEN c.user_lo = ? THEN c.warn_lo ELSE c.warn_hi END AS warn_mine,
              CASE WHEN c.user_lo = ? THEN c.warn_hi ELSE c.warn_lo END AS warn_theirs,
              u.name_display, u.last_active_date
         FROM contacts c JOIN users u ON u.id = CASE WHEN c.user_lo = ? THEN c.user_hi ELSE c.user_lo END
        WHERE (c.user_lo = ? OR c.user_hi = ?) AND u.state != 'deleting'
        ORDER BY u.name_key`,
      me,
      me,
      me,
      me,
      me,
      me,
    );
    const requests = ctx.db.all<{ id: string; label: string; expires_at: number }>(
      'SELECT id, label, expires_at FROM contact_requests WHERE from_id = ? AND expires_at > ? ORDER BY expires_at',
      me,
      now,
    );
    const explainer = ctx.db.all<BotRow>(
      'SELECT * FROM bots WHERE owner_id = ? AND in_addressbook = 1',
      me,
    );
    // v0.8: bots of the control centre once their first letter has arrived (SPEC 10.7).
    const central = ctx.db.all<CentralBotRow>(
      `SELECT b.* FROM central_bots b JOIN central_bot_players p ON p.bot_id = b.id
        WHERE p.user_id = ? AND p.known = 1 AND p.removed = 0 AND b.state != 'draft'
        ORDER BY b.name_key`,
      me,
    );
    const disabled =
      ctx.db.get<{ bots_disabled: number }>('SELECT bots_disabled FROM users WHERE id = ?', me)
        ?.bots_disabled === 1;
    const allBots = explainer.length + central.length;
    return {
      allBots,
      contacts: rows.map((row) => ({
        userId: row.other,
        name: row.name_display,
        since: row.since,
        active: isActiveDate(row.last_active_date, now),
        keyWarning: row.warn_mine === 1 || row.warn_theirs === 1,
      })),
      // v0.8: never in the address book – the letters and the settings use this list.
      botsDisabled: disabled,
      bots: [
        ...explainer.map((bot) => ({
          userId: bot.id,
          name: botTitle(ctx, bot),
          type: 'explainer' as const,
          playerOwls: true,
          writableFrom: writableFrom(ctx, me, { kind: 'explainer', row: bot }, now),
        })),
        ...central.map((bot) => ({
          userId: bot.id,
          name: bot.name,
          type: 'central' as const,
          playerOwls: bot.player_owls === 1,
          writableFrom: writableFrom(ctx, me, { kind: 'central', bot }, now),
        })),
      ],
      requests: requests.map((row) => ({
        id: row.id,
        label: row.label,
        expiresAt: row.expires_at,
      })),
    };
  });

  app.delete('/api/contacts/:id', { preHandler: [authenticated, emptyBody] }, async (request) => {
    const other = parse(Id, (request.params as { id?: unknown }).id);
    const me = userOf(request).id;
    const after: (() => void)[] = [];
    ctx.db.transaction(() => {
      const bot = ownBot(ctx, me, other, true);
      if (bot) {
        removeBot(ctx, me, bot, ctx.now(), (work) => after.push(work));
        return;
      }
      // v0.8: a bot of the control centre – removed for this player for good.
      if (playerBot(ctx, me, other)?.kind === 'central') {
        removeCentralBotForPlayer(ctx, me, other, ctx.now(), (work) => after.push(work));
        return;
      }
      if (!findContact(ctx.db, me, other)) throw new HttpError(404, 'not_found');
      removeContact(ctx, me, other, ctx.now(), (work) => after.push(work));
    });
    for (const work of after) work();
    return { ok: true };
  });

  /** Public keys: for contacts and for former contacts whose chat still exists (SPEC 5.7). */
  app.get('/api/contacts/:id/keys', { preHandler: authenticated }, async (request) => {
    const other = parse(Id, (request.params as { id?: unknown }).id);
    const me = userOf(request).id;
    const allowed =
      findContact(ctx.db, me, other) !== undefined ||
      ctx.db.get('SELECT 1 FROM chats WHERE owner_id = ? AND peer_id = ?', me, other) !== undefined;
    if (!allowed) throw new HttpError(404, 'not_found');
    const keys = ctx.db.get<{ ed25519_pub: Uint8Array; x25519_pub: Uint8Array }>(
      'SELECT ed25519_pub, x25519_pub FROM users WHERE id = ?',
      other,
    );
    if (!keys) throw new HttpError(404, 'not_found');
    return {
      userId: other,
      ed25519: toBase64Url(keys.ed25519_pub),
      x25519: toBase64Url(keys.x25519_pub),
    };
  });

  app.post(
    '/api/contacts/:id/key-warning',
    { preHandler: [authenticated, emptyBody] },
    async (request) => {
      const other = parse(Id, (request.params as { id?: unknown }).id);
      const me = userOf(request).id;
      const now = ctx.now();
      ctx.db.transaction(() => {
        const contact = findContact(ctx.db, me, other);
        if (!contact) throw new HttpError(404, 'not_found');
        if (hasKeyWarning(contact)) return;
        const column = contact.user_lo === me ? 'warn_lo' : 'warn_hi';
        ctx.db.run(
          `UPDATE contacts SET ${column} = 1 WHERE user_lo = ? AND user_hi = ?`,
          contact.user_lo,
          contact.user_hi,
        );
        addSystemMessage(ctx, me, 'key_warning', { name: displayName(ctx.db, other) ?? '' }, now);
      });
      ctx.hub.notify(me, 'contacts');
      return { ok: true };
    },
  );

  // ── Kontakt-Tresor (nur Chiffrat, SPEC 5.7) ──
  app.get('/api/vault', { preHandler: authenticated }, async (request) => ({
    entries: ctx.db
      .all<{ contact_id: string; version: number; blob: string }>(
        'SELECT contact_id, version, blob FROM vault_entries WHERE owner_id = ?',
        userOf(request).id,
      )
      .map((row) => ({ contactId: row.contact_id, version: row.version, blob: row.blob })),
  }));

  app.put('/api/vault/:contactId', { preHandler: authenticated }, async (request) => {
    const contactId = parse(Id, (request.params as { contactId?: unknown }).contactId);
    const body = parse(VaultPut, request.body);
    const me = userOf(request).id;
    ctx.db.transaction(() => {
      const existing = ctx.db.get<{ version: number }>(
        'SELECT version FROM vault_entries WHERE owner_id = ? AND contact_id = ?',
        me,
        contactId,
      );
      if (!existing && !findContact(ctx.db, me, contactId)) throw new HttpError(404, 'not_found');
      // Versions only grow: an old entry cannot be put back (rollback protection).
      if (existing && body.version <= existing.version) throw new HttpError(409, 'vault_version');
      ctx.db.run(
        `INSERT INTO vault_entries (owner_id, contact_id, version, blob) VALUES (?, ?, ?, ?)
         ON CONFLICT (owner_id, contact_id) DO UPDATE SET version = excluded.version, blob = excluded.blob`,
        me,
        contactId,
        body.version,
        body.blob,
      );
    });
    return { ok: true };
  });
}
