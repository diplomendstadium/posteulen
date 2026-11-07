/**
 * Everything that happens to owls over time (SPEC 9.6–9.9): loan owls and their expiry, the
 * menagerie, sickness and treatment, eggs, hatching, naming and gift deadlines of chicks,
 * growing up. All handlers run in the event queue and are idempotent (SPEC 4.5).
 */
import { ACCOUNT, GOLD, MENAGERIE, OWL, TIME } from '@posteulen/shared/constants.ts';
import {
  chickCount,
  giftRequired,
  laysEggs,
  loanIdentities,
  type LoanIdentity,
  menagerieWage,
  pastGracePeriod,
  pickOffer,
  randomOwlName,
  rollsSick,
  speciesPrice,
} from '@posteulen/shared/game/chance.ts';
import { startEnergy } from '@posteulen/shared/game/energy.ts';
import { randomSex, speciesById } from '@posteulen/shared/game/owls.ts';
import { owlNames } from '@posteulen/shared/names-data.ts';
import { languageOf } from '../accounts/language.ts';
import type { Context } from '../context.ts';
import { hmac, randomId, utcDay } from '../security/ids.ts';
import { credit, debit } from '../gold/ledger.ts';
import { HttpError } from '../http/errors.ts';
import { addSystemMessage } from '../messages/system.ts';
import { isActiveDate } from '../contacts/model.ts';
import { currentEnergy, type OwlRow } from './model.ts';
import { backHome, careBonusOf } from './care.ts';

type After = (work: () => void) => void;

function loadOwl(ctx: Context, id: string): OwlRow | undefined {
  return ctx.db.get<OwlRow>('SELECT * FROM owls WHERE id = ?', id);
}

function maxEnergyOf(species: string): number {
  return speciesById(species)?.maxEnergy ?? 0;
}

// ── Menagerie (9.6) ──────────────────────────────────────────────────────────────────────

/** The offer of a day; rolled by the 00:00 job or, if missing (fresh install), on demand. */
export function offerOf(ctx: Context, day: string): string[] {
  const row = ctx.db.get<{ species: string }>(
    'SELECT species FROM menagerie_offers WHERE day = ?',
    day,
  );
  if (row) return JSON.parse(row.species) as string[];
  const species = pickOffer(ctx.random);
  ctx.db.run(
    'INSERT OR IGNORE INTO menagerie_offers (day, species) VALUES (?, ?)',
    day,
    JSON.stringify(species),
  );
  ctx.db.run(
    'DELETE FROM menagerie_offers WHERE day < ?',
    utcDay(Date.parse(`${day}T00:00:00Z`) - 7 * TIME.DAY),
  );
  return offerOf(ctx, day);
}

/**
 * Name, sex and start energy of the loan owls of a day for this user – derived, never stored;
 * the three names differ (9.6).
 */
export function loanIdentitiesFor(
  ctx: Context,
  userId: string,
  day: string,
): Map<string, LoanIdentity> {
  const offer = offerOf(ctx, day);
  // v0.4: same derivation, names from the list of the account's language.
  const identities = loanIdentities(
    offer,
    (species, attempt) =>
      hmac(ctx.keys.loanName, `${userId}|${day}|${species}${attempt === 0 ? '' : `|${attempt}`}`),
    owlNames(languageOf(ctx, userId)),
  );
  return new Map(offer.map((species, index) => [species, identities[index] as LoanIdentity]));
}

/** Why this user cannot borrow this species now, or null (9.6). */
/** Species this user has already borrowed on the given offer day (UTC, v0.3.2). */
export function loanedOn(ctx: Context, userId: string, day: string): string[] {
  return ctx.db
    .all<{ species: string }>(
      'SELECT species FROM loan_days WHERE user_id = ? AND day = ?',
      userId,
      day,
    )
    .map((row) => row.species);
}

/**
 * v0.3.2: per offer day (00:00 UTC) every offered species can be borrowed once – so up to
 * three a day, however many loan owls are still waiting from the day before.
 */
export function loanProblem(ctx: Context, userId: string, species: string, now: number) {
  const day = utcDay(now);
  if (!offerOf(ctx, day).includes(species)) return 'loan_not_offered';
  const today = loanedOn(ctx, userId, day);
  if (today.length >= MENAGERIE.LOANS_PER_DAY) return 'loan_limit';
  if (today.includes(species)) return 'loan_species';
  return null;
}

/** Start energy of a loan owl, known in advance (9.6). */
export function loanStartEnergy(identity: LoanIdentity, species: string): number {
  const kind = speciesById(species);
  if (!kind) throw new Error('unknown species');
  return startEnergy(kind, identity.energyShare);
}

/** Borrow (inside a transaction): checks, 0.1 gold, the new loan owl (9.6). */
export function borrow(ctx: Context, userId: string, species: string, now: number): OwlRow {
  const problem = loanProblem(ctx, userId, species, now);
  if (problem) throw new HttpError(400, problem);
  debit(ctx.db, userId, 'loan', GOLD.LOAN_PRICE, now);
  const day = utcDay(now);
  ctx.db.run('DELETE FROM loan_days WHERE user_id = ? AND day < ?', userId, day);
  ctx.db.run(
    'INSERT INTO loan_days (user_id, day, species) VALUES (?, ?, ?)',
    userId,
    day,
    species,
  );
  return loanOwl(ctx, userId, species, now);
}

export function loanOwl(ctx: Context, userId: string, species: string, now: number): OwlRow {
  const day = utcDay(now);
  const identity = loanIdentitiesFor(ctx, userId, day).get(species);
  if (!identity) throw new Error('species not offered');
  const id = randomId();
  ctx.db.run(
    `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at,
                       loan_expires_at)
     VALUES (?, ?, 'loan', ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    species,
    identity.sex,
    identity.name,
    loanStartEnergy(identity, species),
    now,
    day,
    now,
    now + MENAGERIE.LOAN_EXPIRY_HOURS * TIME.HOUR,
  );
  ctx.queue.schedule('loan_expire', id, now + MENAGERIE.LOAN_EXPIRY_HOURS * TIME.HOUR);
  const owl = loadOwl(ctx, id);
  if (!owl) throw new Error('loan failed');
  return owl;
}

// ── Gelege und Küken (9.9) ───────────────────────────────────────────────────────────────

/** After every return home of a female own adult owl: eggs (1/100), else a pending sickness. */
export function afterReturnHome(ctx: Context, owlId: string, at: number, after: After): void {
  const owl = loadOwl(ctx, owlId);
  if (!owl || owl.kind !== 'own' || owl.is_chick === 1) return;
  if (owl.sex === 'f' && laysEggs(ctx.random())) {
    // Brooding wins over a sickness rolled during the flight (9.8).
    ctx.db.run(
      "UPDATE owls SET state = 'brooding', state_until = ?, pending_sickness = 0 WHERE id = ?",
      at + OWL.BROODING_DAYS * TIME.DAY,
      owlId,
    );
    ctx.queue.schedule('hatch', owlId, at + OWL.BROODING_DAYS * TIME.DAY);
    addSystemMessage(ctx, owl.owner_id, 'eggs_laid', { owl: owl.name ?? '' }, at, after);
    ctx.push.notify(owl.owner_id, 'eggs_laid', owlId, at, after);
    return;
  }
  if (owl.pending_sickness === 1) {
    ctx.db.run("UPDATE owls SET state = 'sick', pending_sickness = 0 WHERE id = ?", owlId);
    addSystemMessage(ctx, owl.owner_id, 'owl_sick', { owl: owl.name ?? '' }, at, after);
  }
}

function hatch(ctx: Context, motherId: string, at: number, after: After): void {
  const mother = loadOwl(ctx, motherId);
  if (!mother || mother.state !== 'brooding') return;
  ctx.db.run(
    "UPDATE owls SET state = 'home', state_until = NULL, energy = ?, energy_at = ? WHERE id = ?",
    currentEnergy(ctx, mother, at),
    at,
    motherId,
  );
  const count = chickCount(ctx.random());
  const clutchId = randomId();
  ctx.db.run(
    'INSERT INTO clutches (id, owner_id, species, hatched_at, gift_state) VALUES (?, ?, ?, ?, ?)',
    clutchId,
    mother.owner_id,
    mother.species,
    at,
    giftRequired(count) ? 'open' : 'none',
  );
  for (let i = 0; i < count; i++) {
    const id = randomId();
    ctx.db.run(
      `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, is_chick, adult_at,
                         owned_since, created_at, clutch_id, hatched_at)
       VALUES (?, ?, 'own', ?, ?, NULL, ?, ?, 1, ?, ?, ?, ?, ?)`,
      id,
      mother.owner_id,
      mother.species,
      randomSex(ctx.random()),
      maxEnergyOf(mother.species),
      at,
      at + OWL.CHICK_ADULT_AT_MOTHER_DAYS * TIME.DAY,
      utcDay(at),
      at,
      clutchId,
      at,
    );
    ctx.queue.schedule('chick_adult', id, at + OWL.CHICK_ADULT_AT_MOTHER_DAYS * TIME.DAY);
  }
  ctx.queue.schedule('clutch_names', clutchId, at + OWL.CHICK_NAME_DEADLINE_HOURS * TIME.HOUR);
  if (giftRequired(count)) {
    ctx.queue.schedule('clutch_gift', clutchId, at + OWL.CHICK_GIFT_DEADLINE_HOURS * TIME.HOUR);
    ctx.queue.schedule(
      'clutch_reminder',
      clutchId,
      at + (OWL.CHICK_GIFT_DEADLINE_HOURS - 4) * TIME.HOUR,
    );
  }
  addSystemMessage(
    ctx,
    mother.owner_id,
    giftRequired(count) ? 'chicks_hatched_gift' : 'chicks_hatched',
    { owl: mother.name ?? '', count },
    at,
    after,
  );
  ctx.push.notify(mother.owner_id, 'chicks_hatched', clutchId, at, after);
  after(() => ctx.hub.notify(mother.owner_id, 'owls'));
}

/** Unnamed chicks get random names after 24 hours (9.9). */
function nameDeadline(ctx: Context, clutchId: string, after: After): void {
  const chicks = ctx.db.all<{ id: string; owner_id: string }>(
    'SELECT id, owner_id FROM owls WHERE clutch_id = ? AND name IS NULL',
    clutchId,
  );
  for (const chick of chicks) {
    const names = owlNames(languageOf(ctx, chick.owner_id));
    ctx.db.run(
      'UPDATE owls SET name = ? WHERE id = ?',
      randomOwlName(ctx.random(), names),
      chick.id,
    );
    after(() => ctx.hub.notify(chick.owner_id, 'owls'));
  }
}

/** Active human contacts of a user (for the lot, 9.9). */
export function activeContacts(ctx: Context, userId: string, now: number): string[] {
  return ctx.db
    .all<{ other: string; last_active_date: string; state: string }>(
      `SELECT u.id AS other, u.last_active_date, u.state FROM contacts c
         JOIN users u ON u.id = CASE WHEN c.user_lo = ? THEN c.user_hi ELSE c.user_lo END
        WHERE (c.user_lo = ? OR c.user_hi = ?) AND c.warn_lo = 0 AND c.warn_hi = 0`,
      userId,
      userId,
      userId,
    )
    .filter((row) => row.state !== 'deleting' && isActiveDate(row.last_active_date, now))
    .map((row) => row.other);
}

export type ChickGiftStarter = (
  ctx: Context,
  input: { holderId: string; chickId: string; recipient: string; now: number },
) => void;

let startChickGift: ChickGiftStarter | undefined;

/** Registered by the transport module (avoids an import cycle). */
export function setChickGiftStarter(starter: ChickGiftStarter): void {
  startChickGift = starter;
}

/** After 24 hours without a decision: lot among active human contacts, else keep all (9.9). */
function giftDeadline(ctx: Context, clutchId: string, at: number, after: After): void {
  const clutch = ctx.db.get<{ owner_id: string; gift_state: string }>(
    'SELECT owner_id, gift_state FROM clutches WHERE id = ?',
    clutchId,
  );
  if (!clutch || clutch.gift_state !== 'open') return;
  const contacts = activeContacts(ctx, clutch.owner_id, at);
  const chicks = ctx.db.all<{ id: string; name: string | null }>(
    "SELECT id, name FROM owls WHERE clutch_id = ? AND owner_id = ? AND is_chick = 1 AND state = 'home' ORDER BY id",
    clutchId,
    clutch.owner_id,
  );
  if (contacts.length === 0 || chicks.length === 0 || !startChickGift) {
    ctx.db.run("UPDATE clutches SET gift_state = 'kept' WHERE id = ?", clutchId);
    addSystemMessage(ctx, clutch.owner_id, 'clutch_kept', {}, at, after);
    return;
  }
  const recipient = contacts[Math.floor(ctx.random() * contacts.length)] ?? contacts[0] ?? '';
  const chick = chicks[Math.floor(ctx.random() * chicks.length)] ?? chicks[0];
  if (!chick) return;
  // The lot has no cover letter (9.9).
  startChickGift(ctx, { holderId: clutch.owner_id, chickId: chick.id, recipient, now: at });
  ctx.db.run("UPDATE clutches SET gift_state = 'sent' WHERE id = ?", clutchId);
  const name = ctx.db.get<{ name_display: string }>(
    'SELECT name_display FROM users WHERE id = ?',
    recipient,
  );
  addSystemMessage(
    ctx,
    clutch.owner_id,
    'clutch_lot',
    { owl: chick.name ?? '', name: name?.name_display ?? '' },
    at,
    after,
  );
  after(() => ctx.hub.notify(clutch.owner_id, 'owls', 'map'));
}

function giftReminder(ctx: Context, clutchId: string, at: number, after: After): void {
  const clutch = ctx.db.get<{ owner_id: string; gift_state: string }>(
    'SELECT owner_id, gift_state FROM clutches WHERE id = ?',
    clutchId,
  );
  if (clutch?.gift_state === 'open') {
    addSystemMessage(ctx, clutch.owner_id, 'clutch_reminder', {}, at, after);
  }
}

function chickAdult(ctx: Context, chickId: string, at: number, after: After): void {
  const chick = loadOwl(ctx, chickId);
  // A chick on its gift flight grows up after its arrival (9.9).
  if (!chick || chick.is_chick !== 1 || chick.state !== 'home') return;
  ctx.db.run(
    'UPDATE owls SET is_chick = 0, adult_at = NULL, energy = ?, energy_at = ? WHERE id = ?',
    maxEnergyOf(chick.species),
    at,
    chickId,
  );
  addSystemMessage(ctx, chick.owner_id, 'chick_adult', { owl: chick.name ?? '' }, at, after);
  after(() => ctx.hub.notify(chick.owner_id, 'owls'));
}

/** (Re)schedules growing up of a chick (gift arrival: +7 days; return: not before day 14). */
export function scheduleAdult(ctx: Context, chickId: string, at: number): void {
  ctx.queue.cancel('chick_adult', chickId);
  ctx.db.run('UPDATE owls SET adult_at = ? WHERE id = ?', at, chickId);
  ctx.queue.schedule('chick_adult', chickId, at);
}

// ── Krankheit (9.8) ──────────────────────────────────────────────────────────────────────

function sicknessRoll(ctx: Context, day: string, at: number, after: After): void {
  const activeSince = utcDay(at - ACCOUNT.INACTIVE_AFTER_DAYS * TIME.DAY);
  const owls = ctx.db.all<OwlRow>(
    `SELECT o.* FROM owls o JOIN users u ON u.id = o.owner_id
      WHERE o.kind = 'own' AND o.is_chick = 0 AND o.state IN ('home', 'flying')
        AND o.pending_sickness = 0 AND u.state != 'deleting' AND u.last_active_date >= ?`,
    activeSince,
  );
  for (const owl of owls) {
    if (!pastGracePeriod(owl.owned_since, day)) continue;
    if (!rollsSick(ctx.random(), careBonusOf(ctx, owl, day, at))) continue;
    if (owl.state === 'flying') {
      // Takes effect at the next arrival home (9.8).
      ctx.db.run('UPDATE owls SET pending_sickness = 1 WHERE id = ?', owl.id);
      continue;
    }
    ctx.db.run("UPDATE owls SET state = 'sick' WHERE id = ?", owl.id);
    addSystemMessage(ctx, owl.owner_id, 'owl_sick', { owl: owl.name ?? '' }, at, after);
    after(() => ctx.hub.notify(owl.owner_id, 'owls'));
  }
}

function treatmentEnd(ctx: Context, owlId: string, at: number, after: After): void {
  const owl = loadOwl(ctx, owlId);
  if (!owl || (owl.state !== 'self_care' && owl.state !== 'vet')) return;
  if (owl.state_until !== null && owl.state_until > at) return;
  // Energy at the vet did not regenerate (away from home): continue from the stored value.
  ctx.db.run(
    "UPDATE owls SET state = 'home', state_until = NULL, energy_at = ? WHERE id = ?",
    owl.state === 'vet' ? at : owl.energy_at,
    owlId,
  );
  backHome(ctx, owlId, at);
  addSystemMessage(ctx, owl.owner_id, 'owl_healthy', { owl: owl.name ?? '' }, at, after);
  after(() => ctx.hub.notify(owl.owner_id, 'owls'));
}

// ── Menagerie (9.7) ──────────────────────────────────────────────────────────────────────

function menagerieEnd(ctx: Context, owlId: string, at: number, after: After): void {
  const owl = loadOwl(ctx, owlId);
  if (!owl || owl.state !== 'menagerie') return;
  ctx.db.run(
    "UPDATE owls SET state = 'home', state_until = NULL, energy = ?, energy_at = ? WHERE id = ?",
    maxEnergyOf(owl.species),
    at,
    owlId,
  );
  backHome(ctx, owlId, at);
  const wage = menagerieWage(speciesPrice(owl.species));
  if (wage > 0) credit(ctx.db, owl.owner_id, 'menagerie_wage', wage, at);
  addSystemMessage(
    ctx,
    owl.owner_id,
    'menagerie_done',
    { owl: owl.name ?? '', amount: wage },
    at,
    after,
  );
  afterReturnHome(ctx, owlId, at, after);
  after(() => ctx.hub.notify(owl.owner_id, 'owls', 'profile', 'finance'));
}

function loanExpire(ctx: Context, owlId: string, at: number, after: After): void {
  const owl = loadOwl(ctx, owlId);
  // A loan owl that is already flying delivers first (it vanishes after the delivery).
  if (!owl || owl.kind !== 'loan' || owl.state !== 'home') return;
  ctx.db.run('DELETE FROM owls WHERE id = ?', owlId);
  addSystemMessage(ctx, owl.owner_id, 'loan_expired', { owl: owl.name ?? '' }, at, after);
  after(() => ctx.hub.notify(owl.owner_id, 'owls'));
}

export function registerLifecycleHandlers(ctx: Context): void {
  ctx.queue.on('loan_expire', (event, tools) =>
    loanExpire(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('menagerie_end', (event, tools) =>
    menagerieEnd(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('treatment_end', (event, tools) =>
    treatmentEnd(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('hatch', (event, tools) => hatch(ctx, event.ref, event.logicalAt, tools.after));
  ctx.queue.on('clutch_names', (event, tools) => nameDeadline(ctx, event.ref, tools.after));
  ctx.queue.on('clutch_gift', (event, tools) =>
    giftDeadline(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('clutch_reminder', (event, tools) =>
    giftReminder(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('chick_adult', (event, tools) =>
    chickAdult(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.registerDaily({
    name: 'menagerie_offer',
    hourUtc: MENAGERIE.OFFER_HOUR_UTC,
    catchUpEveryDay: false,
    run: (day) => void offerOf(ctx, day),
  });
  ctx.queue.registerDaily({
    name: 'sickness',
    hourUtc: OWL.SICKNESS_HOUR_UTC,
    catchUpEveryDay: false,
    run: (day, logicalAt, tools) => sicknessRoll(ctx, day, logicalAt, tools.after),
  });
}
