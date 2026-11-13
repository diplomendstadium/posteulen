/** Owl rows, current energy and the view sent to the browser (SPEC 8.5, 9.2, 9.3). */
import { energyNow, displayEnergy } from '@posteulen/shared/game/energy.ts';
import { isDay } from '@posteulen/shared/game/sun.ts';
import {
  canCare,
  canGift,
  releaseAllowed,
  canRenameInYear,
  canLendToMenagerie,
  canTransport,
  isMythical,
  regenerates,
  speciesById,
  type OwlKind,
  type OwlState,
} from '@posteulen/shared/game/owls.ts';
import type { Context } from '../context.ts';
import { HttpError } from '../http/errors.ts';
import { utcDay } from '../security/ids.ts';
import { displayName, findContact } from '../contacts/model.ts';
import { flightPosition, routeOf, type FlightRow } from '../flights/service.ts';
import { botCareToday } from '../central/care.ts';

export interface OwlRow {
  readonly id: string;
  readonly owner_id: string;
  readonly kind: OwlKind;
  readonly species: string;
  readonly sex: 'f' | 'm';
  readonly name: string | null;
  readonly energy: number;
  readonly energy_at: number;
  readonly state: OwlState;
  readonly state_until: number | null;
  readonly is_chick: number;
  readonly owned_since: string;
  readonly renamed_year: number | null;
  readonly fed_on: string | null;
  readonly petted_on: string | null;
  /** v0.5: water and favourite snack (UTC day of the last time). */
  readonly watered_on: string | null;
  readonly snacked_on: string | null;
  /** v0.5: motivation in tenths, 8–12. */
  readonly motivation: number;
  /** v0.5.1: time of the last interaction. */
  readonly cared_at: number | null;
  readonly pending_sickness: number;
  readonly loan_expires_at: number | null;
  readonly adult_at: number | null;
  readonly clutch_id: string | null;
  readonly hatched_at: number | null;
  readonly created_at: number;
}

export function facts(owl: OwlRow): {
  state: OwlState;
  kind: OwlKind;
  isChick: boolean;
  mythical: boolean;
} {
  return {
    state: owl.state,
    kind: owl.kind,
    isChick: owl.is_chick === 1,
    mythical: isMythical(owl.species),
  };
}

/** The caller's own owl (never one on a gift flight – it no longer belongs to them). */
export function ownOwl(ctx: Context, userId: string, owlId: string): OwlRow {
  const owl = ctx.db.get<OwlRow>(
    "SELECT * FROM owls WHERE id = ? AND owner_id = ? AND state != 'gift_flight'",
    owlId,
    userId,
  );
  if (!owl) throw new HttpError(404, 'not_found');
  return owl;
}

export function activeFlightOf(ctx: Context, owlId: string): FlightRow | undefined {
  return ctx.db.get<FlightRow>(
    "SELECT * FROM flights WHERE owl_id = ? AND state = 'active' ORDER BY started_at DESC LIMIT 1",
    owlId,
  );
}

/** Current energy: regenerates at home, follows the flight plan while flying. */
export function currentEnergy(ctx: Context, owl: OwlRow, now: number): number {
  const species = speciesById(owl.species);
  if (!species) return 0;
  if (owl.state === 'flying' || owl.state === 'gift_flight') {
    const flight = activeFlightOf(ctx, owl.id);
    const position = flight ? flightPosition(flight, now) : undefined;
    return position?.energy ?? owl.energy;
  }
  return energyNow(
    { energy: owl.energy, energyAt: owl.energy_at },
    species,
    now,
    regenerates(owl.state),
  );
}

/** Ready for a letter, gold or a gift: adult, at home, healthy and named (9.2.5). */
export function isReady(owl: OwlRow): boolean {
  return canTransport(facts(owl)) && owl.name !== null;
}

export function ownOwlCount(ctx: Context, userId: string): number {
  return (
    ctx.db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM owls WHERE owner_id = ? AND kind = 'own' AND state != 'gift_flight'",
      userId,
    )?.n ?? 0
  );
}

export interface OwlView {
  readonly id: string;
  readonly name: string | null;
  readonly species: string;
  readonly sex: 'f' | 'm';
  readonly kind: OwlKind;
  readonly state: OwlState;
  readonly isChick: boolean;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly fedToday: boolean;
  readonly pettedToday: boolean;
  /** v0.5: water and favourite snack today; motivation in tenths (8–12). */
  readonly wateredToday: boolean;
  readonly snackedToday: boolean;
  readonly motivation: number;
  /** v0.5.1: time of the last interaction (nap picture only ten minutes after it). */
  readonly caredAt: number | null;
  readonly ready: boolean;
  /** End of brooding, treatment or menagerie. */
  readonly stateUntil: number | null;
  readonly loanExpiresAt: number | null;
  readonly adultAt: number | null;
  readonly clutchId: string | null;
  readonly actions: {
    readonly care: boolean;
    readonly gift: boolean;
    readonly release: boolean;
    readonly rename: boolean;
    readonly treat: boolean;
    readonly menagerie: boolean;
  };
  readonly absence: {
    readonly purpose: string;
    readonly recipients: readonly (string | null)[];
    readonly returnsAt: number | null;
    /** Daylight where the owl is right now: picks the day or night flight picture (v0.3). */
    readonly daylight: boolean;
    /** v0.5.1: asleep on the way right now (sleeping picture). */
    readonly sleeping: boolean;
    /** v0.7: resting at a recipient right now – with whom (null: no contact) and until when. */
    readonly resting: { readonly name: string | null; readonly until: number } | null;
  } | null;
}

/** v0.7: an owl of someone else resting here for a while (8.5) – it can be cared for. */
export interface GuestView {
  readonly id: string;
  readonly name: string;
  readonly species: string;
  readonly sex: 'f' | 'm';
  readonly loan: boolean;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly motivation: number;
  readonly fedToday: boolean;
  readonly pettedToday: boolean;
  readonly wateredToday: boolean;
  readonly snackedToday: boolean;
  readonly caredAt: number | null;
  /** Whose owl it is: their user ID and current name (null if no longer a contact). */
  readonly holderId: string;
  readonly holderName: string | null;
  readonly restUntil: number;
  /** v0.8.5: letters for others still on board – a reply comes after them (names private). */
  readonly moreStops: boolean;
}

export function guestView(
  ctx: Context,
  owl: OwlRow,
  flight: FlightRow,
  index: number,
  now: number,
): GuestView {
  const today = utcDay(now);
  const stop = routeOf(flight)[index];
  return {
    id: owl.id,
    name: owl.name ?? flight.owl_name,
    species: owl.species,
    sex: owl.sex,
    loan: owl.kind === 'loan',
    energy: displayEnergy(currentEnergy(ctx, owl, now)),
    maxEnergy: speciesById(owl.species)?.maxEnergy ?? 0,
    motivation: owl.motivation,
    fedToday: owl.fed_on === today,
    pettedToday: owl.petted_on === today,
    wateredToday: owl.watered_on === today,
    snackedToday: owl.snacked_on === today,
    caredAt: owl.cared_at,
    holderId: flight.holder_id,
    holderName: stop
      ? findContact(ctx.db, stop.userId, flight.holder_id)
        ? displayName(ctx.db, flight.holder_id)
        : null
      : null,
    restUntil: stop?.restUntil ?? now,
    moreStops: routeOf(flight).some(
      (later, at) => at > index && later.type === 'deliver' && later.status === 'pending',
    ),
  };
}

/**
 * v0.8: the owl of a control-centre bot resting at the player (SPEC 10.7): it has no owl row –
 * name, species and motivation come from its flight, the sex from the bot. Players cannot care
 * for it (`bot`), but can hand it a reply.
 */
export function botGuestView(
  ctx: Context,
  flight: FlightRow,
  index: number,
  now: number,
): GuestView & { readonly bot: true } {
  const stop = routeOf(flight)[index];
  const bot = ctx.db.get<{ name: string; owl_sex: 'f' | 'm' }>(
    'SELECT name, owl_sex FROM central_bots WHERE id = ?',
    flight.holder_id,
  );
  const profile = JSON.parse(flight.profile) as { motivation?: number };
  const info = flightPosition(flight, now);
  const care = botCareToday(ctx, flight.id, utcDay(now));
  return {
    id: flight.id,
    name: flight.owl_name,
    species: flight.owl_species,
    // A loan owl of a bot gets a sex from its flight ID (stable on every view).
    sex:
      flight.owl_kind === 'bot'
        ? (bot?.owl_sex ?? 'f')
        : flight.id.charCodeAt(0) % 2 === 0
          ? 'f'
          : 'm',
    loan: flight.owl_kind === 'loan',
    energy: displayEnergy(info?.energy ?? 0),
    maxEnergy: speciesById(flight.owl_species)?.maxEnergy ?? 0,
    motivation: Math.round((profile.motivation ?? 1) * 10),
    // v0.8.3: cared for like every guest (free; SPEC 10.7).
    fedToday: care.has('feed'),
    pettedToday: care.has('pet'),
    wateredToday: care.has('water'),
    snackedToday: care.has('snack'),
    caredAt: null,
    holderId: flight.holder_id,
    holderName: bot?.name ?? null,
    restUntil: stop?.restUntil ?? now,
    // A bot owl flies to one player only.
    moreStops: false,
    bot: true,
  };
}

export function owlView(
  ctx: Context,
  owl: OwlRow,
  now: number,
  ownCount: number = ownOwlCount(ctx, owl.owner_id),
): OwlView {
  const species = speciesById(owl.species);
  const today = utcDay(now);
  const year = new Date(now).getUTCFullYear();
  let absence: OwlView['absence'] = null;
  if (owl.state === 'flying') {
    const flight = activeFlightOf(ctx, owl.id);
    if (flight) {
      const route = routeOf(flight);
      const info = flightPosition(flight, now);
      const position = info?.position;
      const resting = route.find((stop) => stop.status === 'resting');
      absence = {
        daylight: position ? isDay(now, position.lat, position.lon) : true,
        sleeping: info?.phase === 'sleep',
        resting: resting
          ? { name: displayName(ctx.db, resting.userId), until: resting.restUntil ?? now }
          : null,
        purpose: flight.purpose,
        recipients: route
          .filter((stop) => stop.type === 'deliver' && stop.status === 'pending')
          .map((stop) => displayName(ctx.db, stop.userId)),
        returnsAt: route.find((stop) => stop.type === 'home')?.arrivesAt ?? null,
      };
    }
  }
  const ownFacts = facts(owl);
  return {
    id: owl.id,
    name: owl.name,
    species: owl.species,
    sex: owl.sex,
    kind: owl.kind,
    state: owl.state,
    isChick: owl.is_chick === 1,
    energy: displayEnergy(currentEnergy(ctx, owl, now)),
    maxEnergy: species?.maxEnergy ?? 0,
    fedToday: owl.fed_on === today,
    pettedToday: owl.petted_on === today,
    wateredToday: owl.watered_on === today,
    snackedToday: owl.snacked_on === today,
    motivation: owl.motivation,
    caredAt: owl.cared_at,
    ready: isReady(owl),
    stateUntil: owl.state_until,
    loanExpiresAt: owl.loan_expires_at,
    adultAt: owl.adult_at,
    clutchId: owl.clutch_id,
    actions: {
      care: canCare(ownFacts),
      gift: canGift(ownFacts) && owl.name !== null,
      release: releaseAllowed(ownFacts, ownCount),
      rename: owl.kind === 'own' && (owl.name === null || canRenameInYear(owl.renamed_year, year)),
      treat: owl.state === 'sick',
      menagerie: canLendToMenagerie(ownFacts),
    },
    absence,
  };
}
