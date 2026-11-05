/** Owls, flights, gold and the map – thin wrappers around the API (SPEC 8.5–8.9). */
import type { Segment } from '@posteulen/shared/game/flight.ts';
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
  readonly ready: boolean;
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
    readonly papeterie: boolean;
  };
  readonly absence: {
    readonly purpose: 'letter' | 'gold' | 'gift';
    readonly recipients: readonly (string | null)[];
    readonly returnsAt: number | null;
  } | null;
}

export interface OwlChoice {
  readonly id: string;
  readonly kind: 'own' | 'loan' | 'bot';
  readonly name: string;
  readonly species: string;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly arrivals: readonly { recipientId: string; at: number }[];
  readonly returnsAt: number | null;
}

export interface Clutch {
  readonly id: string;
  readonly giftDeadline: number;
}

export function listOwls(): Promise<{ owls: Owl[]; canBuy: boolean; clutches: Clutch[] }> {
  return api('GET', '/api/owls');
}

export function treatOwl(id: string, kind: 'self' | 'vet'): Promise<{ owl: Owl }> {
  return api('POST', `/api/owls/${id}/treat`, { kind });
}

export function lendToPapeterie(id: string): Promise<{ owl: Owl }> {
  return api('POST', `/api/owls/${id}/papeterie`, {});
}

export interface Offer {
  readonly day: string;
  readonly maxLoans: number;
  readonly loans: number;
  readonly offer: readonly { species: string; name: string; sex: 'f' | 'm'; loaned: boolean }[];
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

export function petOwl(id: string): Promise<{ owl: Owl }> {
  return api('POST', `/api/owls/${id}/pet`, {});
}

export function releaseOwl(id: string): Promise<{ ok: true }> {
  return api('POST', `/api/owls/${id}/release`, {});
}

/** Ready owls with the server's flight preview (SPEC 8.4 step 4). */
export async function previewFlights(recipients: readonly string[]): Promise<OwlChoice[]> {
  return (await api<{ owls: OwlChoice[] }>('POST', '/api/flights/preview', { recipients })).owls;
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
    readonly status: 'pending' | 'done' | 'skipped';
    readonly arrivesAt: number;
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
