/**
 * The owl rescue centre (SPEC 8.13, 9.8): sick own owls are nursed here, together with three
 * wild sick owls per account. Five interactions – medicine, biscuit, snack, petting, water – each
 * possible once a day (petting as often as one likes) and counted once a day. The server rolls
 * everything: interactions needed, the wild owls and whether a healed wild owl stays.
 */
import { GOLD, MOTIVATION, RESCUE } from '@posteulen/shared/constants.ts';
import { owlLabel } from '../owls/globe.ts';
import { energyAfterFeeding, energyAfterSnack } from '@posteulen/shared/game/energy.ts';
import { isGlobetrotter } from '@posteulen/shared/game/gifts.ts';
import type { Interaction } from '@posteulen/shared/game/motivation.ts';
import { randomSex, speciesById } from '@posteulen/shared/game/owls.ts';
import {
  ownCareNeeded,
  pickWildSpecies,
  rescueActionAllowed,
  rescueActionCounts,
  rescueProgress,
  wildCareNeeded,
  wildOwlStays,
  type RescueAction,
} from '@posteulen/shared/game/rescue.ts';
import { randomOwlName } from '@posteulen/shared/game/chance.ts';
import { owlNames } from '@posteulen/shared/names-data.ts';
import type { Context } from '../context.ts';
import { languageOf } from '../accounts/language.ts';
import { countInteraction } from '../accounts/stats.ts';
import { payCare } from '../gold/privilege.ts';
import { markReady, markUnready } from '../owls/pairs.ts';
import { HttpError } from '../http/errors.ts';
import { addSystemMessage } from '../messages/system.ts';
import { randomId, utcDay } from '../security/ids.ts';
import { interact, backHome } from '../owls/care.ts';
import { currentEnergy, type OwlRow } from '../owls/model.ts';

type After = (work: () => void) => void;

const DAY_COLUMN: Readonly<Record<RescueAction, string>> = {
  medicine: 'medicine_on',
  feed: 'feed_on',
  snack: 'snack_on',
  pet: 'pet_on',
  water: 'water_on',
};

interface CareDays {
  readonly medicine_on: string | null;
  readonly feed_on: string | null;
  readonly snack_on: string | null;
  readonly pet_on: string | null;
  readonly water_on: string | null;
}

interface CaseRow extends CareDays {
  readonly owl_id: string;
  readonly needed: number;
  readonly done: number;
  readonly admitted_at: number;
}

interface WildRow extends CareDays {
  readonly id: string;
  readonly user_id: string;
  readonly slot: number;
  readonly species: string;
  readonly sex: 'f' | 'm';
  readonly name: string;
  readonly needed: number;
  readonly done: number;
  readonly created_at: number;
  readonly healed_at: number | null;
  readonly stays: number | null;
}

function lastOn(row: CareDays, action: RescueAction): string | null {
  return row[DAY_COLUMN[action] as keyof CareDays];
}

/** What was done today (for the buttons): each action, and whether it is possible right now. */
function todayOf(row: CareDays, today: string) {
  const done: Record<RescueAction, boolean> = {
    medicine: lastOn(row, 'medicine') === today,
    feed: lastOn(row, 'feed') === today,
    snack: lastOn(row, 'snack') === today,
    pet: lastOn(row, 'pet') === today,
    water: lastOn(row, 'water') === today,
  };
  return done;
}

// ── Admission ─────────────────────────────────────────────────────────────────────────────

/**
 * A sick own owl goes to the rescue centre (SPEC 9.8): it needs 6–25 interactions, rolled now;
 * the player only ever sees the progress in per cent.
 */
export function admit(ctx: Context, owl: OwlRow, at: number, after: After): void {
  ctx.db.run("UPDATE owls SET state = 'sick', pending_sickness = 0 WHERE id = ?", owl.id);
  markUnready(ctx, owl.id, at);
  ctx.db.run(
    'INSERT OR IGNORE INTO rescue_cases (owl_id, needed, admitted_at) VALUES (?, ?, ?)',
    owl.id,
    ownCareNeeded(ctx.random()),
    at,
  );
  addSystemMessage(ctx, owl.owner_id, 'owl_sick', { owl: owlLabel(owl) }, at, after);
  ctx.push.notify(owl.owner_id, 'owl_sick', owl.id, at, after);
  after(() => ctx.hub.notify(owl.owner_id, 'owls'));
}

/** When the owl came into the rescue centre (null if not there). */
export function admittedAt(ctx: Context, owlId: string): number | null {
  return (
    ctx.db.get<{ admitted_at: number }>(
      'SELECT admitted_at FROM rescue_cases WHERE owl_id = ?',
      owlId,
    )?.admitted_at ?? null
  );
}

// ── Wild owls ─────────────────────────────────────────────────────────────────────────────

function rollWild(ctx: Context, userId: string, slot: number, now: number): void {
  const species = pickWildSpecies(ctx.random());
  const sex = randomSex(ctx.random());
  const name = randomOwlName(ctx.random(), owlNames(languageOf(ctx, userId), sex));
  ctx.db.run(
    `INSERT INTO rescue_wild (id, user_id, slot, species, sex, name, needed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    randomId(),
    userId,
    slot,
    species.id,
    sex,
    name,
    wildCareNeeded(species.price, ctx.random()),
    now,
  );
}

/**
 * v1.3.1: there is one wild sick owl (rolled on the first visit and after it leaves). Accounts
 * that still have wild owls from before (three until v1.3.0) get a new one only once all of
 * them have left.
 */
export function ensureWild(ctx: Context, userId: string, now: number): void {
  const count =
    ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM rescue_wild WHERE user_id = ?', userId)
      ?.n ?? 0;
  for (let slot = count; slot < RESCUE.WILD_SLOTS; slot++) rollWild(ctx, userId, slot, now);
}

// ── View ──────────────────────────────────────────────────────────────────────────────────

export interface RescueOwlView {
  readonly id: string;
  readonly name: string;
  readonly species: string;
  readonly sex: 'f' | 'm';
  readonly progress: number;
  readonly today: Readonly<Record<RescueAction, boolean>>;
  readonly healed: boolean;
  /** v1.3: 🌍 after the name (own owls only). */
  readonly globetrotter?: boolean;
}

export function rescueView(
  ctx: Context,
  userId: string,
  now: number,
): { own: RescueOwlView[]; wild: RescueOwlView[]; prices: { feed: number; snack: number } } {
  const today = utcDay(now);
  ensureWild(ctx, userId, now);
  const own = ctx.db
    .all<CaseRow & { name: string | null; species: string; sex: 'f' | 'm'; km_flown: number }>(
      `SELECT c.*, o.name, o.species, o.sex, o.km_flown FROM rescue_cases c JOIN owls o ON o.id = c.owl_id
        WHERE o.owner_id = ? AND o.state = 'sick' ORDER BY c.admitted_at, o.id`,
      userId,
    )
    .map((row) => ({
      id: row.owl_id,
      name: row.name ?? '',
      species: row.species,
      sex: row.sex,
      progress: rescueProgress(row.done, row.needed),
      today: todayOf(row, today),
      healed: false,
      globetrotter: isGlobetrotter(row.km_flown),
    }));
  const wild = ctx.db
    .all<WildRow>('SELECT * FROM rescue_wild WHERE user_id = ? ORDER BY slot', userId)
    .map((row) => ({
      id: row.id,
      name: row.name,
      species: row.species,
      sex: row.sex,
      progress: rescueProgress(row.done, row.needed),
      today: todayOf(row, today),
      healed: row.healed_at !== null,
    }));
  return { own, wild, prices: { feed: GOLD.FEED_PRICE, snack: GOLD.SNACK_PRICE } };
}

// ── Interactions ──────────────────────────────────────────────────────────────────────────

export interface CareResult {
  readonly progress: number;
  /** The interaction counted towards getting well (once a day per kind). */
  readonly counted: boolean;
  /** Just got well with this interaction. */
  readonly healed: boolean;
}

function chargeFor(ctx: Context, userId: string, action: RescueAction, now: number): void {
  // v1.3.1: from the pouch while it holds some, free for privileged players (9.1.6, 9.1.7).
  if (action === 'feed') payCare(ctx.db, userId, 'feed', GOLD.FEED_PRICE, now);
  if (action === 'snack') payCare(ctx.db, userId, 'snack', GOLD.SNACK_PRICE, now);
}

/** An interaction with an own sick owl in the rescue centre (inside the caller's transaction). */
export function careForOwn(
  ctx: Context,
  userId: string,
  owlId: string,
  action: RescueAction,
  now: number,
  after: After,
): CareResult {
  const today = utcDay(now);
  const owl = ctx.db.get<OwlRow>(
    "SELECT * FROM owls WHERE id = ? AND owner_id = ? AND state = 'sick'",
    owlId,
    userId,
  );
  const rescue = ctx.db.get<CaseRow>('SELECT * FROM rescue_cases WHERE owl_id = ?', owlId);
  if (!owl || !rescue) throw new HttpError(404, 'not_found');
  const last = lastOn(rescue, action);
  if (!rescueActionAllowed(action, last, today)) throw new HttpError(400, 'rescue_done_today');
  chargeFor(ctx, userId, action, now);
  const counts = rescueActionCounts(last, today);
  const done = rescue.done + (counts ? 1 : 0);
  ctx.db.run(
    `UPDATE rescue_cases SET ${DAY_COLUMN[action]} = ?, done = ? WHERE owl_id = ?`,
    today,
    done,
    owlId,
  );
  // The four usual interactions work on an own owl as at home (energy, motivation, care days).
  if (action !== 'medicine') {
    const species = speciesById(owl.species);
    const energy =
      species && action === 'feed'
        ? energyAfterFeeding(currentEnergy(ctx, owl, now), species)
        : species && action === 'snack'
          ? energyAfterSnack(currentEnergy(ctx, owl, now), species)
          : undefined;
    interact(
      ctx,
      owl,
      action as Interaction,
      today,
      now,
      energy === undefined ? undefined : { value: energy, at: now },
    );
  } else {
    ctx.db.run('UPDATE owls SET cared_at = ? WHERE id = ?', now, owlId);
  }
  countInteraction(ctx, userId, action);
  const healed = done >= rescue.needed;
  if (healed) heal(ctx, owl, now, after);
  return { progress: rescueProgress(done, rescue.needed), counted: counts, healed };
}

/** An own owl got well: back home, healthy (SPEC 9.8). */
function heal(ctx: Context, owl: OwlRow, now: number, after: After): void {
  ctx.db.run('DELETE FROM rescue_cases WHERE owl_id = ?', owl.id);
  ctx.db.run(
    "UPDATE owls SET state = 'home', state_until = NULL, energy = ?, energy_at = ? WHERE id = ?",
    currentEnergy(ctx, { ...owl, state: 'sick' }, now),
    now,
    owl.id,
  );
  backHome(ctx, owl.id, now);
  markReady(ctx, owl.id, now);
  addSystemMessage(ctx, owl.owner_id, 'owl_healthy', { owl: owlLabel(owl) }, now, after);
  after(() => ctx.hub.notify(owl.owner_id, 'owls'));
}

/** An interaction with a wild sick owl (inside the caller's transaction). */
export function careForWild(
  ctx: Context,
  userId: string,
  wildId: string,
  action: RescueAction,
  now: number,
): CareResult {
  const today = utcDay(now);
  const wild = ctx.db.get<WildRow>(
    'SELECT * FROM rescue_wild WHERE id = ? AND user_id = ?',
    wildId,
    userId,
  );
  if (!wild) throw new HttpError(404, 'not_found');
  if (wild.healed_at !== null) throw new HttpError(400, 'rescue_healed');
  const last = lastOn(wild, action);
  if (!rescueActionAllowed(action, last, today)) throw new HttpError(400, 'rescue_done_today');
  chargeFor(ctx, userId, action, now);
  const counts = rescueActionCounts(last, today);
  const done = wild.done + (counts ? 1 : 0);
  const healed = done >= wild.needed;
  ctx.db.run(
    `UPDATE rescue_wild SET ${DAY_COLUMN[action]} = ?, done = ?, healed_at = ?, stays = ? WHERE id = ?`,
    today,
    done,
    healed ? now : null,
    // Where it flies is rolled now by the server and only shown later (SPEC 8.13).
    healed ? (wildOwlStays(ctx.random()) ? 1 : 0) : null,
    wildId,
  );
  countInteraction(ctx, userId, action);
  return { progress: rescueProgress(done, wild.needed), counted: counts, healed };
}

/**
 * "Find out where [name] flies": a healed wild owl leaves the rescue centre – back into freedom,
 * or it stays with the player as a post owl (may exceed the limit of 50 owls, like a gift). A new
 * wild owl comes once none is left (v1.3.1).
 */
export function releaseWild(
  ctx: Context,
  userId: string,
  wildId: string,
  now: number,
  after: After,
): { stays: boolean; owlId: string | null } {
  const wild = ctx.db.get<WildRow>(
    'SELECT * FROM rescue_wild WHERE id = ? AND user_id = ?',
    wildId,
    userId,
  );
  if (!wild) throw new HttpError(404, 'not_found');
  if (wild.healed_at === null || wild.stays === null) throw new HttpError(400, 'rescue_not_healed');
  ctx.db.run('DELETE FROM rescue_wild WHERE id = ?', wildId);
  let owlId: string | null = null;
  if (wild.stays === 1) {
    owlId = randomId();
    const species = speciesById(wild.species);
    ctx.db.run(
      `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, motivation, created_at)
       VALUES (?, ?, 'own', ?, ?, ?, ?, ?, ?, ?, ?)`,
      owlId,
      userId,
      wild.species,
      wild.sex,
      wild.name,
      species?.maxEnergy ?? 0,
      now,
      utcDay(now),
      MOTIVATION.START,
      now,
    );
    addSystemMessage(ctx, userId, 'rescue_joined', { owl: wild.name }, now, after);
  }
  ensureWild(ctx, userId, now);
  after(() => ctx.hub.notify(userId, 'owls'));
  return { stays: wild.stays === 1, owlId };
}
