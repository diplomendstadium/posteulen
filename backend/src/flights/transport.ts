/**
 * Common steps of every transport (letter, gold, gift): choosing the owl, preparing letter
 * IDs and keys, checking the encrypted letters, and the departure itself.
 */
import { BOTS, TIME } from '@posteulen/shared/constants.ts';
import { ownBot } from '../bots/service.ts';
import { fromBase64Url, toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { WRAPPED_KEY_BYTES } from '@posteulen/shared/crypto/hpke.ts';
import { ciphertextBytes } from '@posteulen/shared/crypto/letter.ts';
import { maxRecipients } from '@posteulen/shared/game/owls.ts';
import type { Context, TransportToken } from '../context.ts';
import { HttpError } from '../http/errors.ts';
import { randomId } from '../security/ids.ts';
import { recipientProblem } from '../contacts/model.ts';
import { currentEnergy, isReady, type OwlRow } from '../owls/model.ts';
import { startFlight, type FlightOwl, type Purpose, type RouteStop } from './service.ts';
import { setChickGiftStarter } from '../owls/lifecycle.ts';

export const TOKEN_MS = 5 * TIME.MINUTE;

export interface ChosenOwl extends FlightOwl {
  readonly maxRecipients: number;
  readonly returnsHome: boolean;
}

/** The owl for a transport: an own or loan owl that is ready (9.2.5). */
export function chooseOwl(ctx: Context, userId: string, owlId: string, now: number): ChosenOwl {
  const owl = ctx.db.get<OwlRow>('SELECT * FROM owls WHERE id = ? AND owner_id = ?', owlId, userId);
  if (!owl || owl.state === 'gift_flight') throw new HttpError(404, 'not_found');
  if (!isReady(owl)) throw new HttpError(400, 'owl_not_ready');
  return {
    id: owl.id,
    kind: owl.kind,
    name: owl.name ?? '',
    species: owl.species,
    energy: currentEnergy(ctx, owl, now),
    maxRecipients: maxRecipients({ state: owl.state, kind: owl.kind, isChick: false }),
    returnsHome: owl.kind === 'own',
  };
}

/**
 * People: confirmed, active contacts with intact keys. Bots only where allowed (letters), only
 * as the single recipient and at most once in 24 hours (SPEC 10.1).
 */
export function checkRecipients(
  ctx: Context,
  senderId: string,
  recipients: readonly string[],
  now: number,
  options: { allowBots?: boolean } = {},
): void {
  for (const recipientId of recipients) {
    const bot = ownBot(ctx, senderId, recipientId);
    if (bot) {
      if (!options.allowBots || recipients.length > 1)
        throw new HttpError(400, 'recipient_invalid', { recipientId });
      if (
        bot.last_user_letter_at !== null &&
        now - bot.last_user_letter_at < BOTS.WRITE_LOCK_HOURS * TIME.HOUR
      ) {
        throw new HttpError(400, 'bot_write_lock', { recipientId });
      }
      continue;
    }
    const problem = recipientProblem(ctx, senderId, recipientId, now);
    if (problem) throw new HttpError(400, problem, { recipientId });
  }
}

export function publicKeys(
  ctx: Context,
  userIds: readonly string[],
): { userId: string; ed25519: string; x25519: string }[] {
  return userIds.map((userId) => {
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
}

export function newLetters(recipients: readonly string[], now: number): TransportToken['letters'] {
  return recipients.map((recipientId) => ({ recipientId, letterId: randomId(), sentAt: now }));
}

export interface EncryptedItem {
  readonly letterId: string;
  readonly ciphertext: string;
  readonly wrapRecipient: string;
  readonly wrapSender: string;
}

export interface CheckedLetter {
  readonly letterId: string;
  readonly recipientId: string;
  readonly sentAt: number;
  readonly ciphertext: Uint8Array;
  readonly wrapRecipient: Uint8Array;
  readonly wrapSender: Uint8Array;
}

/** Exactly the prepared letters, with exact lengths per parchment (SPEC 5.9). */
export function checkLetters(
  token: TransportToken,
  items: readonly EncryptedItem[],
): CheckedLetter[] {
  const expected = new Map(token.letters.map((letter) => [letter.letterId, letter]));
  if (items.length !== expected.size || items.some((item) => !expected.has(item.letterId))) {
    throw new HttpError(400, 'bad_request');
  }
  const checked = items.map((item) => {
    const meta = expected.get(item.letterId);
    if (!meta) throw new HttpError(400, 'bad_request');
    const ciphertext = fromBase64Url(item.ciphertext);
    const wrapRecipient = fromBase64Url(item.wrapRecipient);
    const wrapSender = fromBase64Url(item.wrapSender);
    if (ciphertext.length !== ciphertextBytes(token.parchment))
      throw new HttpError(400, 'bad_request');
    if (wrapRecipient.length !== WRAPPED_KEY_BYTES || wrapSender.length !== WRAPPED_KEY_BYTES) {
      throw new HttpError(400, 'bad_request');
    }
    return { ...meta, ciphertext, wrapRecipient, wrapSender };
  });
  const order = token.letters.map((letter) => letter.letterId);
  return checked.sort((a, b) => order.indexOf(a.letterId) - order.indexOf(b.letterId));
}

/** A chick for its gift flight: own, at home (9.9). */
export function chooseChick(ctx: Context, userId: string, chickId: string, now: number): ChosenOwl {
  const chick = ctx.db.get<OwlRow>(
    "SELECT * FROM owls WHERE id = ? AND owner_id = ? AND is_chick = 1 AND state = 'home'",
    chickId,
    userId,
  );
  if (!chick) throw new HttpError(400, 'owl_not_ready');
  return {
    id: chick.id,
    kind: 'own',
    name: chick.name ?? '',
    species: chick.species,
    energy: currentEnergy(ctx, chick, now),
    maxRecipients: 1,
    returnsHome: false,
  };
}

/**
 * Departure (inside a transaction): the owl leaves home, the letters are stored in flight,
 * the plan is simulated and the stops are scheduled.
 */
export function depart(
  ctx: Context,
  token: TransportToken,
  letters: readonly CheckedLetter[],
  now: number,
): { flightId: string; route: RouteStop[]; owl: ChosenOwl } {
  const owl = token.chick
    ? chooseChick(ctx, token.senderId, token.owlId, now)
    : chooseOwl(ctx, token.senderId, token.owlId, now);
  if (token.recipients.length > owl.maxRecipients) throw new HttpError(400, 'owl_recipients');
  if (owl.id) {
    const state = token.purpose === 'gift' ? 'gift_flight' : 'flying';
    const left = ctx.db.run(
      "UPDATE owls SET state = ?, energy = ?, energy_at = ? WHERE id = ? AND state = 'home'",
      state,
      owl.energy,
      now,
      owl.id,
    );
    if (left.changes !== 1) throw new HttpError(400, 'owl_not_ready');
  }
  const { id, route } = startFlight(ctx, {
    holderId: token.senderId,
    owl,
    recipients: token.recipients,
    returnsHome: owl.returnsHome && token.purpose !== 'gift',
    now,
    purpose: token.purpose as Purpose,
    gold: token.gold,
    chick: token.chick === true,
  });
  for (const letter of letters) {
    const stop = route.find(
      (candidate) => candidate.userId === letter.recipientId && candidate.type === 'deliver',
    );
    ctx.db.run(
      `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, ciphertext,
                            wrap_recipient, wrap_sender, status, owl_name, owl_species, flight_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_flight', ?, ?, ?)`,
      letter.letterId,
      token.senderId,
      letter.recipientId,
      token.kind,
      token.parchment,
      letter.sentAt,
      stop?.arrivesAt ?? now,
      letter.ciphertext,
      letter.wrapRecipient,
      letter.wrapSender,
      owl.name,
      owl.species,
      id,
    );
    ctx.db.run(
      `INSERT INTO chats (owner_id, peer_id, peer_kind, last_activity_at)
       VALUES (?, ?, CASE WHEN EXISTS (SELECT 1 FROM bots WHERE id = ?2) THEN 'bot' ELSE 'user' END, ?)
       ON CONFLICT (owner_id, peer_id) DO UPDATE SET last_activity_at = excluded.last_activity_at`,
      token.senderId,
      letter.recipientId,
      now,
    );
  }
  return { flightId: id, route, owl };
}

// The lot of the chick gift (9.9) starts a gift flight without a cover letter.
setChickGiftStarter((ctx, input) => {
  depart(
    ctx,
    {
      senderId: input.holderId,
      purpose: 'gift',
      owlId: input.chickId,
      kind: 'cover_chick',
      parchment: 'small',
      recipients: [input.recipient],
      letters: [],
      gold: 0,
      chick: true,
    },
    [],
    input.now,
  );
});
