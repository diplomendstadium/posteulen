/**
 * The Erklärbär (SPEC 10.2): every account has one of its own, hard-coded – unlike the bots of
 * the control centre (v0.8, `central/`). His letters are plain text (the exception of SPEC 3),
 * they travel with his owls (not shown on the map) and always arrive, also at inactive accounts.
 * Until v0.7.2 there were also an aunt and an uncle per account; they are gone (relatives.ts).
 */
import { BOTS, TIME } from '@posteulen/shared/constants.ts';
import { simulate, type FlightProfile } from '@posteulen/shared/game/flight.ts';
import { owlNames } from '@posteulen/shared/names-data.ts';
import { SPECIES } from '@posteulen/shared/species.ts';
import { botLetters } from '@posteulen/shared/texts/bots.ts';
import { fill } from '@posteulen/shared/texts/de.ts';
import type { Language } from '@posteulen/shared/i18n.ts';
import { languageOf } from '../accounts/language.ts';
import type { Context } from '../context.ts';
import { randomId } from '../security/ids.ts';
import { flightEnvironment, routeOf, turnBack, type FlightRow } from '../flights/service.ts';
import type { BotType } from './prompts.ts';

type After = (work: () => void) => void;

/** Species of bot owls: never the phoenix (v0.5). */
const BOT_OWL_SPECIES = SPECIES.filter((species) => !species.mythical);

export interface BotRow {
  readonly id: string;
  readonly owner_id: string;
  readonly type: BotType;
  readonly first_name: string | null;
  readonly home_lat: number;
  readonly home_lon: number;
  readonly in_addressbook: number;
  readonly last_user_letter_at: number | null;
  readonly fixed_sent: string;
}

/** Marks a fixed letter or gold as sent; false if it was sent already (idempotent, 17.2). */
function claimFixed(ctx: Context, bot: BotRow, key: string): boolean {
  const sent = bot.fixed_sent === '' ? [] : bot.fixed_sent.split(',');
  if (sent.includes(key)) return false;
  ctx.db.run('UPDATE bots SET fixed_sent = ? WHERE id = ?', [...sent, key].join(','), bot.id);
  return true;
}

export function botById(ctx: Context, id: string): BotRow | undefined {
  return ctx.db.get<BotRow>('SELECT * FROM bots WHERE id = ?', id);
}

/** The Erklärbär of this user (unless `any`: only while he is in the letters, v0.7.2). */
export function ownBot(
  ctx: Context,
  userId: string,
  botId: string,
  any = false,
): BotRow | undefined {
  const bot = botById(ctx, botId);
  if (!bot || bot.owner_id !== userId) return undefined;
  return any || bot.in_addressbook === 1 ? bot : undefined;
}

/** "Erklärbär" – or "Explainer Bear" for an account in English (v0.4). */
export function botTitle(
  ctx: Context,
  bot: Pick<BotRow, 'type' | 'first_name' | 'owner_id'>,
): string {
  // v0.8.1: rows of a former type (before their removal at start-up) have no title.
  const title = (botLetters(languageOf(ctx, bot.owner_id)).titles as Record<string, string>)[
    bot.type
  ];
  return title === undefined ? '' : fill(title, { name: bot.first_name ?? '' });
}

function pick<T>(ctx: Context, list: readonly T[]): T {
  const item = list[Math.min(list.length - 1, Math.floor(ctx.random() * list.length))];
  if (item === undefined) throw new Error('empty list');
  return item;
}

function profileOf(ctx: Context): FlightProfile {
  return {
    speedKmh: BOTS.EXPLAINER_SPEED_KMH,
    maxEnergy: 0,
    mode: 'adult',
    unlimitedEnergy: true,
    ...(ctx.flightTimeScale !== 1 ? { timeScale: ctx.flightTimeScale } : {}),
  };
}

function userHome(ctx: Context, userId: string): { lat: number; lon: number } {
  const row = ctx.db.get<{ home_lat: number; home_lon: number }>(
    'SELECT home_lat, home_lon FROM users WHERE id = ?',
    userId,
  );
  if (!row) throw new Error('unknown user');
  return { lat: row.home_lat / 100, lon: row.home_lon / 100 };
}

/**
 * The Erklärbär sends a letter with one of his owls: random species and name, 200 km/h with
 * unlimited energy; delivery is an event, the owl is not shown on any map.
 */
export function dispatchBotLetter(
  ctx: Context,
  bot: BotRow,
  text: string,
  now: number,
): { letterId: string; arrivesAt: number } {
  const species = pick(ctx, BOT_OWL_SPECIES).id;
  const owlName = pick(ctx, owlNames(languageOf(ctx, bot.owner_id)));
  const profile = profileOf(ctx);
  const simulation = simulate(
    profile,
    {
      at: now,
      position: { lat: bot.home_lat / 100, lon: bot.home_lon / 100 },
      energy: profile.maxEnergy,
    },
    [{ index: 0, point: userHome(ctx, bot.owner_id) }],
    flightEnvironment(ctx),
  );
  const arrivesAt = simulation.arrivals[0]?.at ?? now;
  const letterId = randomId();
  ctx.db.run(
    `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, plaintext,
                          status, owl_name, owl_species)
     VALUES (?, ?, ?, ?, 'small', ?, ?, ?, 'in_flight', ?, ?)`,
    letterId,
    bot.id,
    bot.owner_id,
    'letter',
    now,
    arrivesAt,
    text,
    owlName,
    species,
  );
  const shipment = randomId();
  ctx.db.run(
    'INSERT INTO bot_shipments (id, bot_id, user_id, letter_id, gold, arrives_at) VALUES (?, ?, ?, ?, ?, ?)',
    shipment,
    bot.id,
    bot.owner_id,
    letterId,
    0,
    arrivesAt,
  );
  ctx.queue.schedule('bot_deliver', shipment, arrivesAt);
  return { letterId, arrivesAt };
}

function upsertBotChat(
  ctx: Context,
  userId: string,
  botId: string,
  at: number,
  unread: number,
): void {
  ctx.db.run(
    `INSERT INTO chats (owner_id, peer_id, peer_kind, last_activity_at, unread) VALUES (?, ?, 'bot', ?, ?)
     ON CONFLICT (owner_id, peer_id) DO UPDATE SET last_activity_at = excluded.last_activity_at,
                                                   unread = unread + excluded.unread`,
    userId,
    botId,
    at,
    unread,
  );
}

/** The Erklärbär of a new account (SPEC 10.2), his day-0 letter already delivered. */
export function createBots(ctx: Context, userId: string, now: number): void {
  // v0.7.2: only once per account – a removed Erklärbär never comes back.
  const done = ctx.db.run(
    'UPDATE users SET bots_created = 1 WHERE id = ? AND bots_created = 0',
    userId,
  );
  if (done.changes !== 1) return;
  if (ctx.db.get('SELECT 1 FROM bots WHERE owner_id = ?', userId)) return;
  const id = randomId();
  ctx.db.run(
    `INSERT INTO bots (id, owner_id, type, first_name, home_lat, home_lon, in_addressbook)
     VALUES (?, ?, 'explainer', NULL, ?, ?, 1)`,
    id,
    userId,
    Math.round(BOTS.EXPLAINER_HOME.lat * 100),
    Math.round(BOTS.EXPLAINER_HOME.lon * 100),
  );
  // v0.4: fixed letters in the language the account was created in.
  const language: Language = languageOf(ctx, userId);
  const letters = botLetters(language);
  // Day 0: already in the letter box, "brought" by an owl of the Erklärbär (SPEC 10.2).
  ctx.db.run(
    `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, plaintext,
                          status, owl_name, owl_species)
     VALUES (?, ?, ?, 'letter', 'small', ?, ?, ?, 'delivered', ?, ?)`,
    randomId(),
    id,
    userId,
    now,
    now,
    letters.explainer.day0,
    pick(ctx, owlNames(language)),
    pick(ctx, BOT_OWL_SPECIES).id,
  );
  upsertBotChat(ctx, userId, id, now, 1);
  for (const day of BOTS.EXPLAINER_LETTER_DAYS.filter((day) => day > 0)) {
    ctx.queue.schedule('bot_letter', `${id}:day${day}`, now + day * TIME.DAY);
  }
}

/** Accounts from before stage 5 get their Erklärbär once, with the schedule starting now (D-82). */
export function ensureBotsForAllUsers(ctx: Context): number {
  const users = ctx.db.all<{ id: string }>(
    // v0.7.2: only accounts that never had bots (not those that removed them).
    "SELECT id FROM users WHERE state != 'deleting' AND bots_created = 0",
  );
  const now = ctx.now();
  ctx.db.transaction(() => {
    for (const user of users) createBots(ctx, user.id, now);
  });
  return users.length;
}

function deliverShipment(ctx: Context, shipmentId: string, at: number, after: After): void {
  const shipment = ctx.db.get<{
    bot_id: string;
    user_id: string;
    letter_id: string | null;
    gold: number;
  }>('SELECT bot_id, user_id, letter_id, gold FROM bot_shipments WHERE id = ?', shipmentId);
  // Removed bot: its owl vanished together with letter and gold (SPEC 10.1).
  if (!shipment) return;
  ctx.db.run('DELETE FROM bot_shipments WHERE id = ?', shipmentId);
  const bot = botById(ctx, shipment.bot_id);
  if (!bot) return;
  if (shipment.letter_id) {
    ctx.db.run(
      "UPDATE letters SET status = 'delivered', arrives_at = ? WHERE id = ? AND status = 'in_flight'",
      at,
      shipment.letter_id,
    );
  }
  upsertBotChat(ctx, bot.owner_id, bot.id, at, shipment.letter_id ? 1 : 0);
  ctx.push.notify(bot.owner_id, 'letter_arrived', shipment.letter_id, at, after);
  after(() => ctx.hub.notify(bot.owner_id, 'chats'));
}

/** A letter of a person reached a bot: the reply is due 2 hours later (SPEC 10.1). */
export function letterReachedBot(ctx: Context, letterId: string, botId: string, at: number): void {
  ctx.queue.schedule('bot_reply', letterId, at + BOTS.REPLY_AFTER_HOURS * TIME.HOUR);
  ctx.db.run('UPDATE chats SET last_activity_at = ? WHERE peer_id = ?', at, botId);
}

/**
 * Removing a bot is final (SPEC 10.1, 8.8): chat, summary, planned letters and gold go; a bot
 * owl on its way vanishes with letter and gold; own owls on the way to the bot turn back.
 */
export function removeBot(
  ctx: Context,
  userId: string,
  bot: BotRow,
  now: number,
  after: After,
): void {
  const flights = ctx.db.all<FlightRow>(
    "SELECT * FROM flights WHERE state = 'active' AND holder_id = ?",
    userId,
  );
  for (const flight of flights) {
    if (routeOf(flight).some((stop) => stop.userId === bot.id && stop.status === 'pending')) {
      turnBack(ctx, flight, bot.id, now, after);
    }
  }
  ctx.db.run('DELETE FROM letters WHERE sender_id = ? OR recipient_id = ?', bot.id, bot.id);
  ctx.db.run('DELETE FROM chats WHERE owner_id = ? AND peer_id = ?', userId, bot.id);
  ctx.db.run(
    "DELETE FROM scheduled_events WHERE (type = 'bot_gold' AND ref = ?) OR (type = 'bot_letter' AND substr(ref, 1, 23) = ?)",
    bot.id,
    `${bot.id}:`,
  );
  // Shipments and reply jobs go with the bot (ON DELETE CASCADE).
  ctx.db.run('DELETE FROM bots WHERE id = ?', bot.id);
  after(() => ctx.hub.notify(userId, 'contacts', 'chats', 'map'));
}

/** v0.7.2: all bots of an account go for good, the Erklärbär included (settings, SPEC 10.1). */
export function removeAllBots(ctx: Context, userId: string, now: number, after: After): number {
  const bots = ctx.db.all<BotRow>('SELECT * FROM bots WHERE owner_id = ?', userId);
  for (const bot of bots) removeBot(ctx, userId, bot, now, after);
  return bots.length;
}

export function registerBotHandlers(ctx: Context): void {
  ctx.queue.on('bot_letter', (event) => {
    const [botId, which] = event.ref.split(':');
    const bot = botId ? botById(ctx, botId) : undefined;
    if (bot?.type !== 'explainer' || !which) return;
    const letters = botLetters(languageOf(ctx, bot.owner_id)).explainer;
    const text = letters[which as keyof typeof letters] as string | undefined;
    if (!text || !claimFixed(ctx, bot, which)) return;
    dispatchBotLetter(ctx, bot, text, event.logicalAt);
  });
  ctx.queue.on('bot_deliver', (event, tools) =>
    deliverShipment(ctx, event.ref, event.logicalAt, tools.after),
  );
}
