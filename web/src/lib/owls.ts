/** Owls, flights, gold and the map – thin wrappers around the API (SPEC 8.5–8.9). */
import type { OwlBadge } from '@posteulen/shared/game/badges.ts';
import type { VacationTrip } from '@posteulen/shared/game/vacation.ts';
import type { Segment } from '@posteulen/shared/game/flight.ts';
import type { Cargo } from '@posteulen/shared/species.ts';
import { api } from './api.ts';
import { sealFor, type PreparedLetters } from './letters.ts';

export interface Owl {
  readonly id: string;
  readonly name: string | null;
  readonly species: string;
  readonly sex: 'f' | 'm';
  readonly kind: 'own' | 'loan' | 'bot';
  readonly state: string;
  readonly isChick: boolean;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly fedToday: boolean;
  readonly pettedToday: boolean;
  /** v0.5 */
  readonly wateredToday: boolean;
  readonly snackedToday: boolean;
  /** v0.10: biscuit and snack possible right now (once a day, again while not full). */
  readonly feedable: boolean;
  readonly snackable: boolean;
  /** v0.10: what the owl can carry. */
  readonly cargo: Cargo;
  /** v0.5: motivation in tenths (8–12). */
  readonly motivation: number;
  /** v0.5.1: time of the last interaction. */
  readonly caredAt: number | null;
  readonly ready: boolean;
  readonly stateUntil: number | null;
  readonly loanExpiresAt: number | null;
  readonly adultAt: number | null;
  readonly clutchId: string | null;
  /** v1.2.4: kilometres flown in all (own owls; null for loan owls). */
  readonly km: number | null;
  /** Badge after the name by the kilometres flown – 🌍, 🌙 or 👑 (SPEC 9.2.1). */
  readonly badge: OwlBadge | null;
  /** v1.3: order of the overview (SPEC 8.5). */
  readonly ownedSince: string;
  readonly createdAt: number;
  readonly awaySince: number | null;
  /** v1.3: in the rescue centre, with the progress in per cent (SPEC 8.13). */
  readonly rescue: { readonly progress: number } | null;
  /** v1.4: bored – its picture until it flies to people with a letter (SPEC 9.2.9). */
  readonly bored: boolean;
  /** v1.4.2: the second look – the second pictures of its species (SPEC 9.2.6). */
  readonly second: boolean;
  /** v1.4: on holiday at the owl care station on Inchlonaig (SPEC 9.12). */
  readonly vacation: {
    readonly phase: 'out' | 'island' | 'back';
    readonly lat: number;
    readonly lon: number;
    readonly islandAt: number | null;
    readonly backAt: number;
    readonly returnsAt: number;
    readonly daylight: boolean;
  } | null;
  readonly actions: {
    readonly care: boolean;
    readonly gift: boolean;
    readonly release: boolean;
    readonly rename: boolean;
    readonly menagerie: boolean;
  };
  readonly absence: {
    readonly purpose: 'letter' | 'gold' | 'gift';
    readonly recipients: readonly (string | null)[];
    readonly returnsAt: number | null;
    /** Daylight where the owl is right now (v0.3: day or night flight picture). */
    readonly daylight: boolean;
    /** v0.5.1: asleep on the way right now. */
    readonly sleeping: boolean;
    /** v0.7: resting at a recipient right now (name null: no contact) until `until`. */
    readonly resting?: { readonly name: string | null; readonly until: number } | null;
    /** v1.1: the next recipient and the expected arrival there (as on the map). */
    readonly nextStop?: { readonly name: string | null; readonly arrivesAt: number } | null;
  } | null;
}

/** v0.7: an owl of someone else resting here for a while (8.5). */
export interface GuestOwl {
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
  /** v0.10: biscuit and snack possible right now. */
  readonly feedable: boolean;
  readonly snackable: boolean;
  readonly caredAt: number | null;
  /** Badge after the name (SPEC 9.2.1). */
  readonly badge?: OwlBadge | null;
  readonly holderId: string;
  readonly holderName: string | null;
  readonly restUntil: number;
  /** v0.8.5: letters for others still on board – a reply comes after them. */
  readonly moreStops?: boolean;
  /** v0.8: the owl of a control-centre bot – no care, only a reply. */
  readonly bot?: boolean;
  /** v1.4.2: the second look of the visiting owl. */
  readonly second?: boolean;
}

export interface OwlChoice {
  readonly id: string;
  readonly kind: 'own' | 'loan' | 'bot';
  /** A loan owl of the day that is borrowed only on sending (`id` = `loan:<species>`). */
  readonly offer?: boolean;
  readonly name: string;
  readonly species: string;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly arrivals: readonly { recipientId: string; at: number }[];
  readonly returnsAt: number | null;
  /** v0.7: a visiting owl resting here (until `restUntil`) that takes a reply to its holder. */
  readonly guest?: boolean;
  readonly restUntil?: number | null;
  /** v0.8.5: the visiting owl still has letters for others – the reply comes after them. */
  readonly moreStops?: boolean;
  /** v0.10: what the owl can carry (owls of bots: everything). */
  readonly cargo: Cargo;
  /** v0.10: price of a loan offer in tenths. */
  readonly price?: number;
  /** v1.4.2: the second look of an own or visiting owl. */
  readonly second?: boolean;
}

export interface Clutch {
  readonly id: string;
  readonly giftDeadline: number;
  /** v1.4: beyond the most own owls all chicks must be given away (SPEC 9.9). */
  readonly giftAll?: boolean;
}

export function listOwls(): Promise<{
  owls: Owl[];
  guests?: GuestOwl[];
  canBuy: boolean;
  /** v1.4: the most own owls (as many as species) and how many the player has (SPEC 9.2.3). */
  maxOwls: number;
  ownCount: number;
  clutches: Clutch[];
}> {
  return api('GET', '/api/owls');
}

/** v1.4: lends the owl to the post office for 7 days (SPEC 9.7; the path is historical). */
export function lendToPostOffice(id: string): Promise<{ owl: Owl }> {
  return api('POST', `/api/owls/${id}/menagerie`, {});
}

export interface Offer {
  readonly day: string;
  /** v1.1: the team of the day (null for an offer from before v1.1); v1.2: picture inside. */
  readonly team: 'A' | 'B' | 'C' | 'D' | null;
  readonly maxLoans: number;
  readonly loans: number;
  readonly offer: readonly {
    species: string;
    name: string;
    sex: 'f' | 'm';
    loaned: boolean;
    /** v0.10: price in tenths and carrying capacity of the species. */
    price: number;
    cargo: Cargo;
  }[];
}

export function menagerie(): Promise<Offer> {
  return api('GET', '/api/menagerie');
}

export function borrow(species: string): Promise<{ owl: Owl }> {
  return api('POST', '/api/menagerie/loan', { species });
}

export function buyOwl(species: string): Promise<{ owl: Owl }> {
  return api('POST', '/api/owls/buy', { species });
}

export function nameOwl(id: string, name: string): Promise<{ owl: Owl }> {
  return api('POST', `/api/owls/${id}/name`, { name });
}

export function feedOwl(id: string): Promise<{ owl: Owl }> {
  return api('POST', `/api/owls/${id}/feed`, {});
}

export function waterOwl(id: string): Promise<{ owl: Owl }> {
  return api('POST', `/api/owls/${id}/water`, {});
}

export function snackOwl(id: string): Promise<{ owl: Owl }> {
  return api('POST', `/api/owls/${id}/snack`, {});
}

export function petOwl(id: string): Promise<{ owl: Owl }> {
  return api('POST', `/api/owls/${id}/pet`, {});
}

export function releaseOwl(id: string, name: string): Promise<{ ok: true }> {
  return api('POST', `/api/owls/${id}/release`, { name });
}

/**
 * Ready owls with the server's flight preview (SPEC 8.4 step 4). v0.7: `rest` hours at each
 * recipient; `guests` also offers visiting owls that take a reply back to their holder.
 */
export async function previewFlights(
  recipients: readonly string[],
  options: { rest?: number; restLoan?: number; guests?: boolean } = {},
): Promise<OwlChoice[]> {
  return (
    await api<{ owls: OwlChoice[] }>('POST', '/api/flights/preview', {
      recipients,
      ...(options.rest ? { rest: options.rest } : {}),
      // v0.8.5: loan owls rest as long as their own preselection says (also 0).
      ...(options.restLoan !== undefined ? { restLoan: options.restLoan } : {}),
      ...(options.guests ? { guests: true } : {}),
    })
  ).owls;
}

interface PreparedCover extends PreparedLetters {
  readonly arrivesAt: number;
}

async function coverFor(
  prepared: PreparedCover,
  kind: 'cover_gold' | 'cover_owl' | 'cover_chick',
  text: string | null,
): Promise<Record<string, unknown>> {
  if (text === null) return {};
  const [cover] = await sealFor(prepared, kind, 'small', text);
  return cover ? { cover } : {};
}

/** Gold by owl, optionally with a cover letter (SPEC 9.1.4). */
export async function sendGold(
  recipient: string,
  amount: number,
  owlId: string,
  cover: string | null,
): Promise<{ owl: { name: string; species: string }; arrivesAt: number }> {
  const prepared = await api<PreparedCover>('POST', '/api/gold/prepare', {
    recipient,
    amount,
    owlId,
    withCover: cover !== null,
  });
  return api('POST', '/api/gold/send', {
    token: prepared.token,
    ...(await coverFor(prepared, 'cover_gold', cover)),
  });
}

/** Gives an owl away, optionally with a cover letter (SPEC 9.2.7). */
export async function giftOwl(
  owlId: string,
  recipient: string,
  cover: string | null,
): Promise<{ owl: { name: string; species: string }; arrivesAt: number }> {
  const prepared = await api<PreparedCover>('POST', `/api/owls/${owlId}/gift/prepare`, {
    recipient,
    withCover: cover !== null,
  });
  return api('POST', `/api/owls/${owlId}/gift/send`, {
    token: prepared.token,
    ...(await coverFor(prepared, 'cover_owl', cover)),
  });
}

export interface Transaction {
  readonly id: number;
  readonly at: number;
  readonly type: string;
  readonly amount: number;
  /** null: no longer a contact ("unbekannt"); undefined: no counterpart. */
  readonly counterpart?: string | null;
}

export function finance(): Promise<{ gold: number; transactions: Transaction[] }> {
  return api('GET', '/api/finance');
}

export interface MapFlight {
  readonly id: string;
  readonly owl: { readonly name: string; readonly species: string };
  readonly purpose: 'letter' | 'gold' | 'gift';
  readonly stops: readonly {
    readonly name: string | null;
    readonly type: 'deliver' | 'home';
    readonly status: 'pending' | 'done' | 'skipped' | 'resting';
    readonly arrivesAt: number;
    /** v0.8.5: set while the owl rests at this stop. */
    readonly restUntil?: number | null;
    readonly lat: number;
    readonly lon: number;
  }[];
  readonly segments: readonly Segment[];
}

export interface MapInfo {
  readonly home: { readonly lat: number; readonly lon: number };
  readonly contacts: readonly {
    readonly id: string;
    readonly name: string | null;
    readonly bot: boolean;
    readonly lat: number;
    readonly lon: number;
  }[];
  readonly flights: readonly MapFlight[];
  /** v1.4: own owls on holiday and the island of the owl care station (SPEC 9.12, 12.1). */
  readonly vacation?: {
    readonly island: { readonly lat: number; readonly lon: number };
    readonly owls: readonly {
      readonly id: string;
      readonly owl: { readonly name: string; readonly species: string };
      readonly trip: VacationTrip;
    }[];
  };
}

export function mapInfo(): Promise<MapInfo> {
  return api('GET', '/api/map');
}

/** The holder gives one chick of a clutch away (SPEC 9.9). */
export async function giftChick(
  clutchId: string,
  chickId: string,
  recipient: string,
  cover: string | null,
): Promise<{ owl: { name: string; species: string }; arrivesAt: number }> {
  const prepared = await api<PreparedCover>('POST', `/api/clutches/${clutchId}/gift/prepare`, {
    chickId,
    recipient,
    withCover: cover !== null,
  });
  return api('POST', `/api/clutches/${clutchId}/gift/send`, {
    token: prepared.token,
    ...(await coverFor(prepared, 'cover_chick', cover)),
  });
}

/** v1.3: an owl in the rescue centre – own (sick) or wild (SPEC 8.13). */
export interface RescueOwl {
  readonly id: string;
  readonly name: string;
  readonly species: string;
  readonly sex: 'f' | 'm';
  readonly progress: number;
  readonly today: Readonly<Record<RescueAction, boolean>>;
  readonly healed: boolean;
  /** Badge after the name (SPEC 9.2.1). */
  readonly badge?: OwlBadge | null;
}

export type RescueAction = 'medicine' | 'feed' | 'snack' | 'pet' | 'water';

export function getRescue(): Promise<{
  own: RescueOwl[];
  wild: RescueOwl[];
  prices: { feed: number; snack: number };
}> {
  return api('GET', '/api/rescue');
}

export function rescueCare(
  who: 'own' | 'wild',
  id: string,
  action: RescueAction,
): Promise<{ progress: number; counted: boolean; healed: boolean }> {
  return api('POST', `/api/rescue/${who}/${id}/${action}`, {});
}

export function releaseWild(id: string): Promise<{ stays: boolean; owlId: string | null }> {
  return api('POST', `/api/rescue/wild/${id}/release`, {});
}
