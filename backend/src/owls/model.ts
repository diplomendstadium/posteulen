/** Owl rows, current energy and the view sent to the browser (SPEC 8.5, 9.2, 9.3). */
import { energyNow, displayEnergy } from '@posteulen/shared/game/energy.ts';
import { isDay } from '@posteulen/shared/game/sun.ts';
import { OWL, TIME } from '@posteulen/shared/constants.ts';
import { owlBadge, owlDisplayName, type OwlBadge } from '@posteulen/shared/game/badges.ts';
import { rescueProgress } from '@posteulen/shared/game/rescue.ts';
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
  canFeedAgain,
  cargoOf,
} from '@posteulen/shared/game/owls.ts';
import type { Cargo } from '@posteulen/shared/species.ts';
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
  /** v1.3.1: rested with a male of her species at a recipient (pair rule, 9.9). */
  readonly mate_met?: number;
  /** v1.2.4: kilometres flown in all. */
  readonly km_flown: number;
  /** v1.3: the 🌍 badge was announced. */
  readonly globe_announced?: number;
  readonly moon_announced?: number;
  readonly crown_announced?: number;
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
  /** v0.10: biscuit and snack possible right now (once a day, again while not full). */
  readonly feedable: boolean;
  readonly snackable: boolean;
  /** v0.10: what the owl can carry (SPEC 9.2.1). */
  readonly cargo: Cargo;
  readonly motivation: number;
  /** v0.5.1: time of the last interaction (nap picture only ten minutes after it). */
  readonly caredAt: number | null;
  readonly ready: boolean;
  /** End of brooding, treatment or menagerie. */
  readonly stateUntil: number | null;
  readonly loanExpiresAt: number | null;
  readonly adultAt: number | null;
  readonly clutchId: string | null;
  /** v1.2.4: kilometres flown in all (own owls; null for loan and visiting owls). */
  readonly km: number | null;
  /** Badge after the name by the kilometres flown – 🌍, 🌙 or 👑 (SPEC 9.2.1). */
  readonly badge: OwlBadge | null;
  /** v1.3: order of the overview (SPEC 8.5): since when the player has it, created, away since. */
  readonly ownedSince: string;
  readonly createdAt: number;
  readonly awaySince: number | null;
  /** v1.3: in the rescue centre (sick), with the progress in per cent (SPEC 8.13). */
  readonly rescue: { readonly progress: number } | null;
  readonly actions: {
    readonly care: boolean;
    readonly gift: boolean;
    readonly release: boolean;
    readonly rename: boolean;
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
    /** v1.1: the next recipient on the way and the expected arrival there (as on the map). */
    readonly nextStop: { readonly name: string | null; readonly arrivesAt: number } | null;
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
  /** v0.10: biscuit and snack possible right now (bot owls: once a day, free). */
  readonly feedable: boolean;
  readonly snackable: boolean;
  readonly caredAt: number | null;
  /** Badge after the name (SPEC 9.2.1). */
  readonly badge: OwlBadge | null;
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
  const energy = displayEnergy(currentEnergy(ctx, owl, now));
  const maxEnergy = speciesById(owl.species)?.maxEnergy ?? 0;
  return {
    id: owl.id,
    // With the badge of an owl that has flown far (SPEC 9.2.1).
    name: owlDisplayName(owl.name ?? flight.owl_name, owlBadge(owl.km_flown)),
    species: owl.species,
    sex: owl.sex,
    loan: owl.kind === 'loan',
    energy,
    maxEnergy,
    motivation: owl.motivation,
    fedToday: owl.fed_on === today,
    pettedToday: owl.petted_on === today,
    wateredToday: owl.watered_on === today,
    snackedToday: owl.snacked_on === today,
    feedable: canFeedAgain({ fedToday: owl.fed_on === today, energy, maxEnergy }),
    snackable: canFeedAgain({ fedToday: owl.snacked_on === today, energy, maxEnergy }),
    caredAt: owl.cared_at,
    badge: owlBadge(owl.km_flown),
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
    // Bot owls stay at once a day (free, SPEC 10.7).
    feedable: !care.has('feed'),
    snackable: !care.has('snack'),
    caredAt: null,
    badge: null,
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
  let awaySince: number | null = null;
  if (owl.state === 'flying') {
    const flight = activeFlightOf(ctx, owl.id);
    if (flight) {
      awaySince = flight.started_at;
      const route = routeOf(flight);
      const info = flightPosition(flight, now);
      const position = info?.position;
      const resting = route.find((stop) => stop.status === 'resting');
      const next = route.find((stop) => stop.status === 'pending');
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
        nextStop:
          next?.type === 'deliver'
            ? { name: displayName(ctx.db, next.userId), arrivesAt: next.arrivesAt }
            : null,
      };
    }
  }
  const ownFacts = facts(owl);
  const energy = displayEnergy(currentEnergy(ctx, owl, now));
  const maxEnergy = species?.maxEnergy ?? 0;
  const rescue =
    owl.state === 'sick'
      ? ctx.db.get<{ needed: number; done: number; admitted_at: number }>(
          'SELECT needed, done, admitted_at FROM rescue_cases WHERE owl_id = ?',
          owl.id,
        )
      : undefined;
  // v1.3: since when the owl has been away or busy (SPEC 8.5: away longest first).
  if (owl.state === 'sick') awaySince = rescue?.admitted_at ?? null;
  else if (owl.state === 'menagerie' && owl.state_until !== null)
    awaySince = owl.state_until - OWL.MENAGERIE_DAYS * TIME.DAY;
  else if (owl.state === 'brooding' && owl.state_until !== null)
    awaySince = owl.state_until - OWL.BROODING_DAYS * TIME.DAY;
  else if (owl.is_chick === 1)
    awaySince = Math.max(owl.hatched_at ?? 0, Date.parse(`${owl.owned_since}T00:00:00Z`));
  else if (owl.state === 'home' && owl.name === null) awaySince = owl.created_at;
  return {
    id: owl.id,
    name: owl.name,
    species: owl.species,
    sex: owl.sex,
    kind: owl.kind,
    state: owl.state,
    isChick: owl.is_chick === 1,
    energy,
    maxEnergy,
    fedToday: owl.fed_on === today,
    pettedToday: owl.petted_on === today,
    wateredToday: owl.watered_on === today,
    snackedToday: owl.snacked_on === today,
    feedable: canFeedAgain({ fedToday: owl.fed_on === today, energy, maxEnergy }),
    snackable: canFeedAgain({ fedToday: owl.snacked_on === today, energy, maxEnergy }),
    cargo: cargoOf(owl.species),
    motivation: owl.motivation,
    caredAt: owl.cared_at,
    ready: isReady(owl),
    stateUntil: owl.state_until,
    loanExpiresAt: owl.loan_expires_at,
    adultAt: owl.adult_at,
    clutchId: owl.clutch_id,
    // v1.2.4: kilometres flown in all – only for own owls (not loan or visiting owls).
    km: owl.kind === 'own' ? Math.round(owl.km_flown) : null,
    badge: owl.kind === 'own' ? owlBadge(owl.km_flown) : null,
    ownedSince: owl.owned_since,
    createdAt: owl.created_at,
    awaySince,
    rescue: rescue ? { progress: rescueProgress(rescue.done, rescue.needed) } : null,
    actions: {
      care: canCare(ownFacts),
      gift: canGift(ownFacts) && owl.name !== null,
      release: releaseAllowed(ownFacts, ownCount),
      rename: owl.kind === 'own' && (owl.name === null || canRenameInYear(owl.renamed_year, year)),
      menagerie: canLendToMenagerie(ownFacts),
    },
    absence,
  };
}
