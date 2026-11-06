/**
 * Bots (SPEC 10): every user has an Erklärbär, an aunt and an uncle of their own. Their letters
 * are plain text (the exception of SPEC 3), they travel with bot owls (not shown on the map)
 * and always arrive, also at inactive accounts.
 */
import { BOTS, GOLD, MAP, TIME } from '@posteulen/shared/constants.ts';
import { simulate, type FlightProfile } from '@posteulen/shared/game/flight.ts';
import { AUNT_NAMES, OWL_NAMES, UNCLE_NAMES } from '@posteulen/shared/names-data.ts';
import { SPECIES } from '@posteulen/shared/species.ts';
import {
  AUNT_LETTERS,
  BOT_TITLES,
  EXPLAINER_LETTERS,
  UNCLE_LETTERS,
} from '@posteulen/shared/texts/bots.ts';
import { fill } from '@posteulen/shared/texts/de.ts';
import { isLand } from '@posteulen/shared/map/landmask.ts';
import type { Context } from '../context.ts';
import { randomId } from '../security/ids.ts';
import { credit } from '../gold/ledger.ts';
import { addSystemMessage } from '../messages/system.ts';
import { flightEnvironment, routeOf, turnBack, type FlightRow } from '../flights/service.ts';
import type { BotType } from './prompts.ts';

type After = (work: () => void) => void;

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

/** A bot of this user (in the address book unless `any`). */
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

/** "Erklärbär", "Tante Emma", "Onkel Paul" (SPEC 10.3, 10.4). */
export function botTitle(bot: Pick<BotRow, 'type' | 'first_name'>): string {
  return fill(BOT_TITLES[bot.type], { name: bot.first_name ?? '' });
}

function pick<T>(ctx: Context, list: readonly T[]): T {
  const item = list[Math.min(list.length - 1, Math.floor(ctx.random() * list.length))];
  if (item === undefined) throw new Error('empty list');
  return item;
}

/** A random place on land within the map (SPEC 10.3), rounded to 0.01°. */
function randomHome(ctx: Context): { latE2: number; lonE2: number } {
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const lat = MAP.SOUTH_LAT + ctx.random() * (MAP.NORTH_LAT - MAP.SOUTH_LAT);
    const lon = MAP.WEST_LON + ctx.random() * (MAP.EAST_LON - MAP.WEST_LON);
    const latE2 = Math.round(lat * 100);
    const lonE2 = Math.round(lon * 100);
    if (isLand(ctx.landMask, latE2 / 100, lonE2 / 100)) return { latE2, lonE2 };
  }
  return {
    latE2: Math.round(BOTS.EXPLAINER_HOME.lat * 100),
    lonE2: Math.round(BOTS.EXPLAINER_HOME.lon * 100),
  };
}

function profileOf(ctx: Context, type: BotType): FlightProfile {
  const scale = ctx.flightTimeScale !== 1 ? { timeScale: ctx.flightTimeScale } : {};
  return type === 'explainer'
    ? {
        speedKmh: BOTS.EXPLAINER_SPEED_KMH,
        maxEnergy: 0,
        mode: 'adult',
        unlimitedEnergy: true,
        ...scale,
      }
    : {
        speedKmh: BOTS.AUNT_UNCLE_SPEED_KMH,
        maxEnergy: BOTS.AUNT_UNCLE_ENERGY,
        mode: 'adult',
        ...scale,
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

function letterText(bot: BotRow, text: string): string {
  return fill(text, { aunt: bot.first_name ?? '', uncle: bot.first_name ?? '' });
}

/**
 * A bot sends a letter (and gold) with one of its owls: random species and name, flight rules
 * of SPEC 9.4 with the bot values; delivery is an event, the owl is not shown on any map.
 */
export function dispatchBotLetter(
  ctx: Context,
  bot: BotRow,
  text: string,
  gold: number,
  now: number,
  /** Fixed landing time instead of the simulated flight (the aunt's welcome letter, v0.3). */
  fixedArrival?: number,
): { letterId: string; arrivesAt: number } {
  const species = pick(ctx, SPECIES).id;
  const owlName = pick(ctx, OWL_NAMES);
  const profile = profileOf(ctx, bot.type);
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
  const arrivesAt = fixedArrival ?? simulation.arrivals[0]?.at ?? now;
  const letterId = randomId();
  ctx.db.run(
    `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, plaintext,
                          status, owl_name, owl_species)
     VALUES (?, ?, ?, ?, 'small', ?, ?, ?, 'in_flight', ?, ?)`,
    letterId,
    bot.id,
    bot.owner_id,
    gold > 0 ? 'cover_gold' : 'letter',
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
    gold,
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

/** Three bots for a new account (SPEC 10), the day-0 letter already delivered (10.2). */
export function createBots(ctx: Context, userId: string, now: number): void {
  const exists = ctx.db.get('SELECT 1 FROM bots WHERE owner_id = ?', userId);
  if (exists) return;
  const insert = (
    type: BotType,
    firstName: string | null,
    home: { latE2: number; lonE2: number },
  ) => {
    const id = randomId();
    ctx.db.run(
      `INSERT INTO bots (id, owner_id, type, first_name, home_lat, home_lon, in_addressbook)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      userId,
      type,
      firstName,
      home.latE2,
      home.lonE2,
      // Aunt and uncle appear in the address book and on the map with their first letter.
      type === 'explainer' ? 1 : 0,
    );
    const bot = botById(ctx, id);
    if (!bot) throw new Error('bot not created');
    return bot;
  };
  const explainer = insert('explainer', null, {
    latE2: Math.round(BOTS.EXPLAINER_HOME.lat * 100),
    lonE2: Math.round(BOTS.EXPLAINER_HOME.lon * 100),
  });
  const aunt = insert('aunt', pick(ctx, AUNT_NAMES), randomHome(ctx));
  const uncle = insert('uncle', pick(ctx, UNCLE_NAMES), randomHome(ctx));

  // Day 0: already in the letter box, "brought" by an owl of the Erklärbär (SPEC 10.2).
  ctx.db.run(
    `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, plaintext,
                          status, owl_name, owl_species)
     VALUES (?, ?, ?, 'letter', 'small', ?, ?, ?, 'delivered', ?, ?)`,
    randomId(),
    explainer.id,
    userId,
    now,
    now,
    EXPLAINER_LETTERS.day0,
    pick(ctx, OWL_NAMES),
    pick(ctx, SPECIES).id,
  );
  upsertBotChat(ctx, userId, explainer.id, now, 1);
  for (const day of BOTS.EXPLAINER_LETTER_DAYS.filter((day) => day > 0)) {
    ctx.queue.schedule('bot_letter', `${explainer.id}:day${day}`, now + day * TIME.DAY);
  }
  // The aunt's welcome letter lands five minutes after registration (v0.3).
  dispatchBotLetter(
    ctx,
    aunt,
    letterText(aunt, AUNT_LETTERS.welcome),
    0,
    now,
    now + (BOTS.AUNT_FIRST_LETTER_AFTER_MINUTES * TIME.MINUTE) / ctx.flightTimeScale,
  );
  ctx.queue.schedule('bot_gold', aunt.id, now + GOLD.AUNT_GIFT_AFTER_DAYS * TIME.DAY);
  ctx.queue.schedule(
    'bot_letter',
    `${uncle.id}:first`,
    now + BOTS.UNCLE_FIRST_LETTER_AFTER_DAYS * TIME.DAY,
  );
  ctx.queue.schedule('bot_gold', uncle.id, now + GOLD.UNCLE_INHERITANCE_AFTER_DAYS * TIME.DAY);
}

/** Accounts from before stage 5 get their bots once, with the schedule starting now (D-82). */
export function ensureBotsForAllUsers(ctx: Context): number {
  const users = ctx.db.all<{ id: string }>(
    "SELECT id FROM users WHERE state != 'deleting' AND id NOT IN (SELECT owner_id FROM bots)",
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
  if (bot.in_addressbook === 0) {
    // Aunt and uncle appear with their first letter (SPEC 8.8, v0.3).
    ctx.db.run('UPDATE bots SET in_addressbook = 1 WHERE id = ?', bot.id);
    after(() => ctx.hub.notify(bot.owner_id, 'contacts', 'map'));
  }
  upsertBotChat(ctx, bot.owner_id, bot.id, at, shipment.letter_id ? 1 : 0);
  if (shipment.gold > 0) {
    // Gifts of the game, not transfers (SPEC 10.1).
    credit(
      ctx.db,
      bot.owner_id,
      bot.type === 'uncle' ? 'uncle_inheritance' : 'aunt_gift',
      shipment.gold,
      at,
      null,
      botTitle(bot),
    );
    addSystemMessage(
      ctx,
      bot.owner_id,
      'gold_arrived',
      { name: botTitle(bot), amount: shipment.gold, owl: '' },
      at,
      after,
    );
    after(() => ctx.hub.notify(bot.owner_id, 'profile', 'finance'));
  }
  ctx.push.notify(
    bot.owner_id,
    shipment.gold > 0 ? 'gold_arrived' : 'letter_arrived',
    shipment.letter_id,
    at,
    after,
  );
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

export function registerBotHandlers(ctx: Context): void {
  ctx.queue.on('bot_letter', (event) => {
    const [botId, which] = event.ref.split(':');
    const bot = botId ? botById(ctx, botId) : undefined;
    if (!bot || !which) return;
    const text =
      bot.type === 'explainer'
        ? EXPLAINER_LETTERS[which as keyof typeof EXPLAINER_LETTERS]
        : bot.type === 'uncle' && which === 'first'
          ? UNCLE_LETTERS.first
          : undefined;
    if (!text || !claimFixed(ctx, bot, which)) return;
    dispatchBotLetter(ctx, bot, letterText(bot, text), 0, event.logicalAt);
  });
  ctx.queue.on('bot_gold', (event) => {
    const bot = botById(ctx, event.ref);
    if (!bot || bot.type === 'explainer' || !claimFixed(ctx, bot, 'gold')) return;
    const aunt = bot.type === 'aunt';
    dispatchBotLetter(
      ctx,
      bot,
      letterText(bot, aunt ? AUNT_LETTERS.gold : UNCLE_LETTERS.gold),
      aunt ? GOLD.AUNT_GIFT : GOLD.UNCLE_INHERITANCE,
      event.logicalAt,
    );
  });
  ctx.queue.on('bot_deliver', (event, tools) =>
    deliverShipment(ctx, event.ref, event.logicalAt, tools.after),
  );
}
