/** Owl rows, current energy and the view sent to the browser (SPEC 8.5, 9.2, 9.3). */
import { energyNow, displayEnergy } from '@posteulen/shared/game/energy.ts';
import { isDay } from '@posteulen/shared/game/sun.ts';
import {
  canCare,
  canGift,
  canRelease,
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
import { displayName } from '../contacts/model.ts';
import { flightPosition, routeOf, type FlightRow } from '../flights/service.ts';

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
  } | null;
}

export function owlView(ctx: Context, owl: OwlRow, now: number): OwlView {
  const species = speciesById(owl.species);
  const today = utcDay(now);
  const year = new Date(now).getUTCFullYear();
  let absence: OwlView['absence'] = null;
  if (owl.state === 'flying') {
    const flight = activeFlightOf(ctx, owl.id);
    if (flight) {
      const route = routeOf(flight);
      const position = flightPosition(flight, now)?.position;
      absence = {
        daylight: position ? isDay(now, position.lat, position.lon) : true,
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
    ready: isReady(owl),
    stateUntil: owl.state_until,
    loanExpiresAt: owl.loan_expires_at,
    adultAt: owl.adult_at,
    clutchId: owl.clutch_id,
    actions: {
      care: canCare(ownFacts),
      gift: canGift(ownFacts) && owl.name !== null,
      release: canRelease(ownFacts),
      rename: owl.kind === 'own' && (owl.name === null || canRenameInYear(owl.renamed_year, year)),
      treat: owl.state === 'sick',
      menagerie: canLendToMenagerie(ownFacts),
    },
    absence,
  };
}
