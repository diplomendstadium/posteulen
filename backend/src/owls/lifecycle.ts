/**
 * Everything that happens to owls over time (SPEC 9.6–9.9): loan owls and their expiry, the
 * menagerie, sickness and treatment, eggs, hatching, naming and gift deadlines of chicks,
 * growing up. All handlers run in the event queue and are idempotent (SPEC 4.5).
 */
import { ACCOUNT, BOREDOM, MENAGERIE, MOTIVATION, OWL, TIME } from '@posteulen/shared/constants.ts';
import { owlLabel } from './globe.ts';
import { assignLook } from './look.ts';
import {
  chickCount,
  giftRequired,
  laysEggs,
  loanIdentities,
  loanNamesOn,
  type LoanIdentity,
  menagerieWage,
  pastGracePeriod,
  pickTeam,
  randomOwlName,
  rollsSick,
  speciesPrice,
  teamSpecies,
} from '@posteulen/shared/game/chance.ts';
import { LOAN_TEAMS, type LoanTeam } from '@posteulen/shared/species.ts';
import { loanStartEnergy as startShare } from '@posteulen/shared/game/energy.ts';
import {
  isMythical,
  loanPrice,
  maxOwnOwls,
  randomSex,
  speciesById,
} from '@posteulen/shared/game/owls.ts';
import { owlNames } from '@posteulen/shared/names-data.ts';
import { admit } from '../rescue/service.ts';
import { languageOf } from '../accounts/language.ts';
import type { Language } from '@posteulen/shared/i18n.ts';
import type { Context } from '../context.ts';
import { hmac, randomId, utcDay } from '../security/ids.ts';
import { credit } from '../gold/ledger.ts';
import { pay } from '../gold/privilege.ts';
import { eggChanceOf, markReady, markUnready } from './pairs.ts';
import { HttpError } from '../http/errors.ts';
import { addSystemMessage } from '../messages/system.ts';
import { ACTIVE_DAY_SQL, isActiveDate } from '../contacts/model.ts';
import { currentEnergy, ownOwlCount, type OwlRow } from './model.ts';
import { backHome, careBonusOf, motivationNight } from './care.ts';
import { boredomDay } from './boredom.ts';
import { limitNotices, owlsCounted } from './limit.ts';
import { sendOwlsOnVacation, usersOnVacation } from './vacation.ts';

type After = (work: () => void) => void;

function loadOwl(ctx: Context, id: string): OwlRow | undefined {
  return ctx.db.get<OwlRow>('SELECT * FROM owls WHERE id = ?', id);
}

function maxEnergyOf(species: string): number {
  return speciesById(species)?.maxEnergy ?? 0;
}

// ── Menagerie (9.6) ──────────────────────────────────────────────────────────────────────

/** The shared offer of a day from before v0.8.5 (only still read for the update day). */
function sharedOffer(ctx: Context, day: string): string[] | null {
  const row = ctx.db.get<{ species: string }>(
    'SELECT species FROM menagerie_offers WHERE day = ?',
    day,
  );
  return row ? (JSON.parse(row.species) as string[]) : null;
}

function storedOffer(
  ctx: Context,
  userId: string,
  day: string,
): { species: string[]; team: LoanTeam | null } | null {
  const row = ctx.db.get<{ species: string; team: string | null }>(
    'SELECT species, team FROM menagerie_user_offers WHERE user_id = ? AND day = ?',
    userId,
    day,
  );
  if (!row) return null;
  const team = row.team !== null && row.team in LOAN_TEAMS ? (row.team as LoanTeam) : null;
  return { species: JSON.parse(row.species) as string[], team };
}

/**
 * v1.1: the species offered to this account on an offer day (9.6) – one whole team, rolled on
 * the account's first request of the day and kept until the next change of day; the team of
 * the day before is left out. Offers from before the update (four single species, v0.8.5) and
 * the shared offer of the update day to v0.8.5 still count for their day.
 */
export function offerOf(ctx: Context, userId: string, day: string): string[] {
  const stored = storedOffer(ctx, userId, day)?.species ?? sharedOffer(ctx, day);
  if (stored) return stored;
  const start = Date.parse(`${day}T00:00:00Z`);
  const previous = storedOffer(ctx, userId, utcDay(start - TIME.DAY))?.team ?? null;
  const team = pickTeam(ctx.random, previous);
  // v1.3.2: the names are rolled in the language of this moment and keep it (9.6).
  ctx.db.run(
    'INSERT OR IGNORE INTO menagerie_user_offers (user_id, day, species, team, language) VALUES (?, ?, ?, ?, ?)',
    userId,
    day,
    JSON.stringify(teamSpecies(team)),
    team,
    languageOf(ctx, userId),
  );
  // Only the day before is needed for the exclusion (two days are kept, as before).
  ctx.db.run(
    'DELETE FROM menagerie_user_offers WHERE user_id = ? AND day < ?',
    userId,
    utcDay(start - 2 * TIME.DAY),
  );
  return storedOffer(ctx, userId, day)?.species ?? [...teamSpecies(team)];
}

/** v1.1: the team of this account's offer on a day (null for an offer from before v1.1). */
export function offerTeamOf(ctx: Context, userId: string, day: string): LoanTeam | null {
  offerOf(ctx, userId, day);
  return storedOffer(ctx, userId, day)?.team ?? null;
}

/** v0.8.5: old shared offers and offers of accounts not seen for days (04:00 clean-up). */
export function cleanUpOffers(ctx: Context, now: number): void {
  const oldest = utcDay(now - 2 * TIME.DAY);
  ctx.db.run('DELETE FROM menagerie_user_offers WHERE day < ?', oldest);
  ctx.db.run('DELETE FROM menagerie_offers WHERE day < ?', oldest);
}

/**
 * v1.3.2: the language the names of a day's offer were rolled in – kept for the whole day, so
 * changing the language does not rename the owls on offer (9.6). An offer from before the
 * update (or the shared offer of v0.8.5) takes the account's language once.
 */
function offerLanguage(ctx: Context, userId: string, day: string): Language {
  const row = ctx.db.get<{ language: string | null }>(
    'SELECT language FROM menagerie_user_offers WHERE user_id = ? AND day = ?',
    userId,
    day,
  );
  if (row?.language === 'de' || row?.language === 'en') return row.language;
  const language = languageOf(ctx, userId);
  if (row) {
    ctx.db.run(
      'UPDATE menagerie_user_offers SET language = ? WHERE user_id = ? AND day = ? AND language IS NULL',
      language,
      userId,
      day,
    );
  }
  return language;
}

/**
 * Name, sex and start energy of the loan owls of a day for this user – derived, never stored;
 * the three names differ (9.6). The names come from the lists of the offer's language.
 */
export function loanIdentitiesFor(
  ctx: Context,
  userId: string,
  day: string,
): Map<string, LoanIdentity> {
  const offer = offerOf(ctx, userId, day);
  // Same derivation in both languages; the names from the lists of the offer's language.
  const language = offerLanguage(ctx, userId, day);
  const identities = loanIdentities(
    offer,
    (species, attempt) =>
      hmac(ctx.keys.loanName, `${userId}|${day}|${species}${attempt === 0 ? '' : `|${attempt}`}`),
    // Names suit the sex and rotate in groups by day, so none comes back on the two
    // following days (Anhang D).
    (sex) => loanNamesOn(day, owlNames(language, sex)),
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
 * the size of the offer a day, however many loan owls are still waiting from the day before.
 */
export function loanProblem(ctx: Context, userId: string, species: string, now: number) {
  const day = utcDay(now);
  if (!offerOf(ctx, userId, day).includes(species)) return 'loan_not_offered';
  const today = loanedOn(ctx, userId, day);
  // v1.1: as many as the offer has species (a whole team; four on offers from before).
  if (today.length >= offerOf(ctx, userId, day).length) return 'loan_limit';
  if (today.includes(species)) return 'loan_species';
  return null;
}

/**
 * v0.8.5: the loan owl borrowed for this species on this offer day still exists (waiting or on
 * its way). Loan owls are kept with the offer day as `owned_since` and deleted when they vanish.
 */
export function loanStillHere(ctx: Context, userId: string, species: string, day: string): boolean {
  return (
    ctx.db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM owls WHERE owner_id = ? AND kind = 'loan' AND species = ? AND owned_since = ?",
      userId,
      species,
      day,
    )?.n !== 0
  );
}

/** Start energy of a loan owl (75–100 %), known in advance (9.6). */
export function loanStartEnergy(identity: LoanIdentity, species: string): number {
  const kind = speciesById(species);
  if (!kind) throw new Error('unknown species');
  return startShare(kind, identity.energyShare);
}

/** Borrow (inside a transaction): checks, the price of the species, the new loan owl (9.6). */
export function borrow(ctx: Context, userId: string, species: string, now: number): OwlRow {
  const problem = loanProblem(ctx, userId, species, now);
  if (problem) throw new HttpError(400, problem);
  // v0.10: 0.2 gold for species that carry gold, otherwise 0.1 gold.
  pay(ctx.db, userId, 'loan', loanPrice(species), now);
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
                       loan_expires_at, motivation)
     VALUES (?, ?, 'loan', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    identity.motivation,
  );
  ctx.queue.schedule('loan_expire', id, now + MENAGERIE.LOAN_EXPIRY_HOURS * TIME.HOUR);
  const owl = loadOwl(ctx, id);
  if (!owl) throw new Error('loan failed');
  return owl;
}

// ── Gelege und Küken (9.9) ───────────────────────────────────────────────────────────────

/**
 * After every return home of a female own adult owl: eggs (1/100; v1.3.1 twice or three times
 * as likely with a partner, 9.9), else a pending sickness.
 */
export function afterReturnHome(ctx: Context, owlId: string, at: number, after: After): void {
  const owl = loadOwl(ctx, owlId);
  if (!owl || owl.kind !== 'own' || owl.is_chick === 1) return;
  // The phoenix never lays eggs (v0.5).
  const chance = owl.sex === 'f' && !isMythical(owl.species) ? eggChanceOf(ctx, owl, at) : 0;
  if (chance > 0 && laysEggs(ctx.random(), chance)) {
    // Brooding wins over a sickness rolled during the flight (9.8).
    ctx.db.run(
      "UPDATE owls SET state = 'brooding', state_until = ?, pending_sickness = 0 WHERE id = ?",
      at + OWL.BROODING_DAYS * TIME.DAY,
      owlId,
    );
    ctx.queue.schedule('hatch', owlId, at + OWL.BROODING_DAYS * TIME.DAY);
    markUnready(ctx, owlId, at);
    addSystemMessage(ctx, owl.owner_id, 'eggs_laid', { owl: owlLabel(owl) }, at, after);
    ctx.push.notify(owl.owner_id, 'eggs_laid', owlId, at, after);
    return;
  }
  if (owl.pending_sickness === 1) {
    // v1.3: a sick owl goes straight to the rescue centre (SPEC 9.8).
    admit(ctx, owl, at, after);
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
  markReady(ctx, motherId, at);
  const count = chickCount(ctx.random());
  const clutchId = randomId();
  // v1.4: beyond the most own owls all chicks of the clutch must be given away (9.9).
  const giftAll = ownOwlCount(ctx, mother.owner_id) + count > maxOwnOwls();
  const mustGive = giftAll || giftRequired(count);
  ctx.db.run(
    'INSERT INTO clutches (id, owner_id, species, hatched_at, gift_state, gift_all) VALUES (?, ?, ?, ?, ?, ?)',
    clutchId,
    mother.owner_id,
    mother.species,
    at,
    mustGive ? 'open' : 'none',
    giftAll ? 1 : 0,
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
    assignLook(ctx, id);
    ctx.queue.schedule('chick_adult', id, at + OWL.CHICK_ADULT_AT_MOTHER_DAYS * TIME.DAY);
  }
  ctx.queue.schedule('clutch_names', clutchId, at + OWL.CHICK_NAME_DEADLINE_HOURS * TIME.HOUR);
  if (mustGive) {
    ctx.queue.schedule('clutch_gift', clutchId, at + OWL.CHICK_GIFT_DEADLINE_HOURS * TIME.HOUR);
    // v1.5.0: a reminder every day until the chick is given away (before: only the last day).
    ctx.queue.schedule(
      'clutch_reminder',
      clutchId,
      at + OWL.CHICK_GIFT_REMINDER_EVERY_HOURS * TIME.HOUR,
    );
  }
  addSystemMessage(
    ctx,
    mother.owner_id,
    giftAll ? 'chicks_hatched_gift_all' : mustGive ? 'chicks_hatched_gift' : 'chicks_hatched',
    { owl: owlLabel(mother), count, max: maxOwnOwls() },
    at,
    after,
  );
  // The mother is free again; during a holiday she flies to the island (her chicks once named).
  sendOwlsOnVacation(ctx, mother.owner_id, at, after);
  ctx.push.notify(mother.owner_id, 'chicks_hatched', clutchId, at, after);
  // v1.5.0: the profile carries the clutch to give away (banner and daily notice, 9.9).
  after(() => ctx.hub.notify(mother.owner_id, 'owls', 'profile'));
}

/** Unnamed chicks get random names after 24 hours (9.9). */
function nameDeadline(ctx: Context, clutchId: string, at: number, after: After): void {
  const chicks = ctx.db.all<{ id: string; owner_id: string; sex: 'f' | 'm' }>(
    'SELECT id, owner_id, sex FROM owls WHERE clutch_id = ? AND name IS NULL',
    clutchId,
  );
  for (const chick of chicks) {
    // A name that suits the chick's sex (Anhang D).
    const names = owlNames(languageOf(ctx, chick.owner_id), chick.sex);
    ctx.db.run(
      'UPDATE owls SET name = ? WHERE id = ?',
      randomOwlName(ctx.random(), names),
      chick.id,
    );
    after(() => ctx.hub.notify(chick.owner_id, 'owls'));
  }
  const owner = chicks[0]?.owner_id;
  if (owner) sendOwlsOnVacation(ctx, owner, at, after);
}

/** Active human contacts of a user (for the lot, 9.9). */
export function activeContacts(ctx: Context, userId: string, now: number): string[] {
  return ctx.db
    .all<{ other: string; last_active_date: string; state: string }>(
      `SELECT u.id AS other, ${ACTIVE_DAY_SQL('u')} AS last_active_date, u.state FROM contacts c
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

/**
 * After five days without a decision: lot among active human contacts below the most own owls,
 * else keep all (9.9). One chick – or, beyond the limit, every chick still at home, each to a
 * contact that still has room for it.
 */
function giftDeadline(ctx: Context, clutchId: string, at: number, after: After): void {
  const clutch = ctx.db.get<{ owner_id: string; gift_state: string; gift_all: number }>(
    'SELECT owner_id, gift_state, gift_all FROM clutches WHERE id = ?',
    clutchId,
  );
  if (!clutch || clutch.gift_state !== 'open') return;
  const chicks = ctx.db.all<{ id: string; name: string | null; km_flown: number }>(
    "SELECT id, name, km_flown FROM owls WHERE clutch_id = ? AND owner_id = ? AND is_chick = 1 AND state = 'home' ORDER BY id",
    clutchId,
    clutch.owner_id,
  );
  // Room per contact, counting the chicks this lot already sends there.
  const room = new Map(
    activeContacts(ctx, clutch.owner_id, at).map((id) => [id, maxOwnOwls() - owlsCounted(ctx, id)]),
  );
  const toGive =
    clutch.gift_all === 1 ? chicks : [chicks[Math.floor(ctx.random() * chicks.length)]];
  let sent = 0;
  for (const chick of toGive) {
    const open = [...room].filter(([, left]) => left > 0).map(([id]) => id);
    if (!chick || open.length === 0 || !startChickGift) break;
    const recipient = open[Math.floor(ctx.random() * open.length)] ?? open[0] ?? '';
    // The lot has no cover letter (9.9).
    startChickGift(ctx, { holderId: clutch.owner_id, chickId: chick.id, recipient, now: at });
    room.set(recipient, (room.get(recipient) ?? 1) - 1);
    sent++;
    const name = ctx.db.get<{ name_display: string }>(
      'SELECT name_display FROM users WHERE id = ?',
      recipient,
    );
    addSystemMessage(
      ctx,
      clutch.owner_id,
      'clutch_lot',
      { owl: owlLabel(chick), name: name?.name_display ?? '' },
      at,
      after,
    );
  }
  if (sent === 0) {
    ctx.db.run("UPDATE clutches SET gift_state = 'kept' WHERE id = ?", clutchId);
    addSystemMessage(ctx, clutch.owner_id, 'clutch_kept', {}, at, after);
  } else {
    ctx.db.run(
      'UPDATE clutches SET gift_state = ? WHERE id = ?',
      sent < toGive.length ? 'kept' : 'sent',
      clutchId,
    );
    if (sent < toGive.length) addSystemMessage(ctx, clutch.owner_id, 'clutch_kept', {}, at, after);
  }
  // The chicks that stay are free now; during a holiday they fly to the island.
  sendOwlsOnVacation(ctx, clutch.owner_id, at, after);
  after(() => ctx.hub.notify(clutch.owner_id, 'owls', 'map', 'profile'));
}

/**
 * v1.5.0: every day until the chick is given away a reminder with the days left – 4, 3, 2 and
 * on the last day "by this time tomorrow" (9.9). Reminders scheduled before v1.5.0 (one day
 * before the lot) are simply the last one.
 */
function giftReminder(ctx: Context, clutchId: string, at: number, after: After): void {
  const clutch = ctx.db.get<{
    owner_id: string;
    gift_state: string;
    gift_all: number;
    hatched_at: number;
  }>('SELECT owner_id, gift_state, gift_all, hatched_at FROM clutches WHERE id = ?', clutchId);
  if (clutch?.gift_state !== 'open') return;
  const deadline = clutch.hatched_at + OWL.CHICK_GIFT_DEADLINE_HOURS * TIME.HOUR;
  const days = Math.max(1, Math.round((deadline - at) / TIME.DAY));
  // v1.4: beyond the limit every chick still at home (wording variant "all").
  const params: Record<string, string | number> = { days };
  if (clutch.gift_all === 1) params['cargo'] = 'all';
  addSystemMessage(ctx, clutch.owner_id, 'clutch_reminder', params, at, after);
  const next = at + OWL.CHICK_GIFT_REMINDER_EVERY_HOURS * TIME.HOUR;
  if (next < deadline) ctx.queue.schedule('clutch_reminder', clutchId, next);
  after(() => ctx.hub.notify(clutch.owner_id, 'profile'));
}

function chickAdult(ctx: Context, chickId: string, at: number, after: After): void {
  const chick = loadOwl(ctx, chickId);
  // A chick on its gift flight grows up after its arrival (9.9); on holiday it grows up there.
  if (!chick || chick.is_chick !== 1 || (chick.state !== 'home' && chick.state !== 'vacation'))
    return;
  ctx.db.run(
    'UPDATE owls SET is_chick = 0, adult_at = NULL, energy = ?, energy_at = ? WHERE id = ?',
    maxEnergyOf(chick.species),
    at,
    chickId,
  );
  addSystemMessage(ctx, chick.owner_id, 'chick_adult', { owl: owlLabel(chick) }, at, after);
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
        AND o.pending_sickness = 0 AND u.state != 'deleting' AND ${ACTIVE_DAY_SQL('u')} >= ?`,
    activeSince,
  );
  // v1.4: during a holiday no owl of the player falls ill (9.12).
  const vacation = usersOnVacation(ctx);
  for (const owl of owls) {
    if (vacation.has(owl.owner_id)) continue;
    // v1.3: the phoenix never falls ill (SPEC 9.2.2).
    if (isMythical(owl.species)) continue;
    if (!pastGracePeriod(owl.owned_since, day)) continue;
    if (!rollsSick(ctx.random(), careBonusOf(ctx, owl, day, at))) continue;
    if (owl.state === 'flying') {
      // Takes effect at the next arrival home (9.8).
      ctx.db.run('UPDATE owls SET pending_sickness = 1 WHERE id = ?', owl.id);
      continue;
    }
    // v1.3: straight to the rescue centre, with system message and push (SPEC 9.8, 11.2).
    admit(ctx, owl, at, after);
  }
}

/**
 * Altbestand: the end of a treatment by the player or the owl vet. Since v1.3 there is no such
 * treatment (the update made such owls healthy); events still queued do nothing.
 */
function treatmentEnd(): void {
  // Nothing to do.
}

// ── Verleih an das Postamt (9.7) ──────────────────────────────────────────────────────────────────────

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
    { owl: owlLabel(owl), amount: wage },
    at,
    after,
  );
  afterReturnHome(ctx, owlId, at, after);
  sendOwlsOnVacation(ctx, owl.owner_id, at, after);
  after(() => ctx.hub.notify(owl.owner_id, 'owls', 'profile', 'finance'));
}

function loanExpire(ctx: Context, owlId: string, at: number, after: After): void {
  const owl = loadOwl(ctx, owlId);
  // A loan owl that is already flying delivers first (it vanishes after the delivery).
  if (!owl || owl.kind !== 'loan' || owl.state !== 'home') return;
  ctx.db.run('DELETE FROM owls WHERE id = ?', owlId);
  addSystemMessage(ctx, owl.owner_id, 'loan_expired', { owl: owlLabel(owl) }, at, after);
  after(() => ctx.hub.notify(owl.owner_id, 'owls'));
}

export function registerLifecycleHandlers(ctx: Context): void {
  ctx.queue.on('loan_expire', (event, tools) =>
    loanExpire(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('menagerie_end', (event, tools) =>
    menagerieEnd(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('treatment_end', () => treatmentEnd());
  ctx.queue.on('hatch', (event, tools) => hatch(ctx, event.ref, event.logicalAt, tools.after));
  ctx.queue.on('clutch_names', (event, tools) =>
    nameDeadline(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('clutch_gift', (event, tools) =>
    giftDeadline(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('clutch_reminder', (event, tools) =>
    giftReminder(ctx, event.ref, event.logicalAt, tools.after),
  );
  ctx.queue.on('chick_adult', (event, tools) =>
    chickAdult(ctx, event.ref, event.logicalAt, tools.after),
  );
  // v0.5: motivation −0.1 every night, also for owls on the way or in the Menagerie.
  ctx.queue.registerDaily({
    name: 'motivation',
    hourUtc: MOTIVATION.DECAY_HOUR_UTC,
    catchUpEveryDay: true,
    run: () => motivationNight(ctx),
  });
  // v0.8.5: no shared offer at 00:00 any more – each account rolls its own (offerOf).
  ctx.queue.registerDaily({
    name: 'sickness',
    hourUtc: OWL.SICKNESS_HOUR_UTC,
    catchUpEveryDay: false,
    run: (day, logicalAt, tools) => sicknessRoll(ctx, day, logicalAt, tools.after),
  });
  // v1.4: bored owls (9.2.9) and the weekly note at the most own owls (9.2.3).
  ctx.queue.registerDaily({
    name: 'boredom',
    hourUtc: BOREDOM.HOUR_UTC,
    catchUpEveryDay: false,
    run: (_day, logicalAt, tools) => {
      boredomDay(ctx, logicalAt, tools.after);
      limitNotices(ctx, logicalAt, tools.after);
    },
  });
}
