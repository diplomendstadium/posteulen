/**
 * Data of the logged-in app and live updates (SPEC 11.6): while the app is visible a
 * Server-Sent-Events connection delivers hints; on start and on every return to the
 * foreground everything is reloaded. If SSE fails, poll every 60 s – only in the foreground.
 * Nothing runs in the background.
 */
import { OPERATIONS } from '@posteulen/shared/constants.ts';
import { isDay } from '@posteulen/shared/game/sun.ts';
import { api } from './api.ts';
import { account, accountGeneration, onSignOut } from './auth.svelte.ts';
import { syncVault } from './vault.svelte.ts';
import { clearOwlImages, queueOwlImage, showOwlImage } from './overlay.svelte.ts';
import { t, fill } from './i18n.svelte.ts';

export interface ChatSummary {
  readonly peerId: string;
  readonly peerKind: 'user' | 'bot';
  readonly name: string | null;
  readonly isContact: boolean;
  readonly lastActivityAt: number;
  readonly unread: number;
}

export interface Contact {
  readonly userId: string;
  readonly name: string;
  readonly since: number;
  readonly active: boolean;
  readonly keyWarning: boolean;
}

export interface BotContact {
  readonly userId: string;
  readonly name: string;
  /** v0.8: the Erklärbär or a bot of the control centre. */
  readonly type: 'explainer' | 'central';
  /** Own and loan owls of the player may fly to it (control-centre bots decide). */
  readonly playerOwls: boolean;
  /** Writing again possible from (24 hours after the last letter, SPEC 10.1). */
  readonly writableFrom: number | null;
}

export interface NewsItem {
  readonly id: string;
  readonly type: string;
  readonly ref: string | null;
  readonly createdAt: number;
}

export const live = $state<{
  chats: ChatSummary[];
  systemUnread: number;
  contacts: Contact[];
  bots: BotContact[];
  /** v0.7.2: all bots of the account (also those not known yet). */
  allBots: number;
  /** v0.8: "Alle Bots entfernen" chosen – no bot ever writes again. */
  botsDisabled: boolean;
  /** v0.8.2: timed banners of the admin running right now. */
  banners: { id: string; text: string; endsAt: number }[];
  requests: { id: string; label: string; expiresAt: number }[];
  news: NewsItem[];
  pushState: string;
  /** Increments on every chat change so open conversations reload. */
  chatVersion: number;
  owlsVersion: number;
  financeVersion: number;
  mapVersion: number;
}>({
  chats: [],
  systemUnread: 0,
  contacts: [],
  bots: [],
  allBots: 0,
  botsDisabled: false,
  banners: [],
  requests: [],
  news: [],
  pushState: 'none',
  chatVersion: 0,
  owlsVersion: 0,
  financeVersion: 0,
  mapVersion: 0,
});

// v0.6.1: lists of the previous account must not show up for the next one in the same tab.
onSignOut(() => {
  live.chats = [];
  live.systemUnread = 0;
  live.contacts = [];
  live.bots = [];
  live.allBots = 0;
  live.botsDisabled = false;
  live.banners = [];
  live.requests = [];
  live.news = [];
  live.pushState = 'none';
  clearOwlImages();
  queuedHomecomings.clear();
});

type Topic =
  | 'chats'
  | 'contacts'
  | 'news'
  | 'system'
  | 'profile'
  | 'push'
  | 'owls'
  | 'finance'
  | 'map'
  | 'homecomings'
  | 'banners';

/** v0.7.2: homecomings already queued in this tab (no double pictures). */
// Plain Set on purpose: bookkeeping, not rendered state.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const queuedHomecomings = new Set<string>();

/**
 * v0.7.2: an own owl back home is no system message any more, only an overlay: the picture at
 * the window, by day or by candlelight depending on whether it is light at the user's home
 * at the moment it is shown. Several homecomings appear one after another.
 */
async function showHomecomings(current: () => boolean): Promise<void> {
  if (document.visibilityState !== 'visible') return;
  const { homecomings } = await api<{
    homecomings: { id: string; owl: string; species: string; letters: number }[];
  }>('GET', '/api/homecomings');
  if (!current()) return;
  const fresh = homecomings.filter((item) => !queuedHomecomings.has(item.id));
  if (fresh.length === 0) return;
  for (const item of fresh) {
    queuedHomecomings.add(item.id);
    queueOwlImage(() => {
      const home = account.profile?.home;
      const day = home ? isDay(Date.now(), home.lat, home.lon) : true;
      const caption =
        item.letters === 0
          ? fill(t.owls.backHome, { name: item.owl })
          : fill(item.letters === 1 ? t.owls.backHomeLetter : t.owls.backHomeLetters, {
              name: item.owl,
              count: item.letters,
            });
      return { species: item.species, kind: day ? 'homeDay' : 'homeNight', caption };
    });
  }
  await api('POST', '/api/homecomings/seen', { ids: fresh.map((item) => item.id) });
}

export interface SystemMessage {
  readonly id: string;
  readonly type: string;
  readonly params: Record<string, string | number>;
  readonly createdAt: number;
  readonly seen: boolean;
  readonly arrivalImage: string | null;
  readonly arrivalShown: boolean;
}

/**
 * Arrival image for deliveries without a letter (gold, gifted owl, SPEC 9.2.6): shown once,
 * for the most recent landing only.
 */
export async function showSystemArrivals(messages?: readonly SystemMessage[]): Promise<void> {
  const list =
    messages ?? (await api<{ messages: SystemMessage[] }>('GET', '/api/system-messages')).messages;
  const pending = list.filter((message) => message.arrivalImage && !message.arrivalShown);
  const latest = pending.at(-1);
  if (!latest?.arrivalImage) return;
  // `species:chick` marks a chick: its arrival shows the chick picture (9.2.6). v0.7:
  // `species:home` is an own owl back home – on the window sill by day or by candlelight,
  // depending on whether it is light at the user's (fictional) home right now.
  const [species = '', variant] = latest.arrivalImage.split(':');
  const name = String(latest.params['owl'] ?? '');
  if (variant === 'home') {
    const home = account.profile?.home;
    const day = home ? isDay(Date.now(), home.lat, home.lon) : true;
    showOwlImage(species, day ? 'homeDay' : 'homeNight', fill(t.owls.backHome, { name }));
  } else {
    showOwlImage(
      species,
      variant === 'chick' ? 'chick' : 'arrival',
      fill(t.owls.arrives, { name }),
    );
  }
  await api('POST', '/api/system-messages/arrival-shown', { ids: pending.map((m) => m.id) });
}

async function refresh(topics: readonly Topic[]): Promise<void> {
  if (!account.profile) return;
  const generation = accountGeneration();
  /** Answers for an account that has signed out in the meantime are dropped (v0.6.1). */
  const current = (): boolean => generation === accountGeneration();
  const tasks: Promise<void>[] = [];
  if (topics.includes('chats') || topics.includes('system')) {
    tasks.push(
      api<{ chats: ChatSummary[]; system: { unread: number } }>('GET', '/api/chats').then(
        (result) => {
          if (!current()) return;
          live.chats = result.chats;
          live.systemUnread = result.system.unread;
          live.chatVersion++;
        },
      ),
    );
  }
  if (topics.includes('contacts')) {
    tasks.push(
      api<{
        contacts: Contact[];
        bots: BotContact[];
        allBots?: number;
        botsDisabled?: boolean;
        requests: { id: string; label: string; expiresAt: number }[];
      }>('GET', '/api/contacts').then(async (result) => {
        if (!current()) return;
        live.contacts = result.contacts;
        live.bots = result.bots;
        live.allBots = result.allBots ?? result.bots.length;
        live.botsDisabled = result.botsDisabled ?? false;
        live.requests = result.requests;
        await syncVault(result.contacts);
      }),
    );
  }
  if (topics.includes('news')) {
    tasks.push(
      api<{ news: NewsItem[] }>('GET', '/api/news').then((result) => {
        if (current()) live.news = result.news;
      }),
    );
  }
  if (topics.includes('profile')) {
    tasks.push(
      api<{ profile: typeof account.profile }>('GET', '/api/sync').then((result) => {
        if (result.profile && current()) account.profile = result.profile;
      }),
    );
  }
  if (topics.includes('homecomings')) tasks.push(showHomecomings(current));
  if (topics.includes('banners')) {
    tasks.push(
      api<{ banners: { id: string; text: string; endsAt: number }[] }>('GET', '/api/banners').then(
        (result) => {
          if (current()) live.banners = result.banners;
        },
      ),
    );
  }
  if (topics.includes('owls')) live.owlsVersion++;
  if (topics.includes('finance')) live.financeVersion++;
  if (topics.includes('map')) live.mapVersion++;
  if (topics.includes('push')) {
    tasks.push(
      api<{ state: string }>('GET', '/api/push/status').then((result) => {
        if (current()) live.pushState = result.state;
      }),
    );
  }
  await Promise.allSettled(tasks);
}

/**
 * Letters of a chat were just marked read: the chat list and "Neue Post!" show it at once,
 * without a reload (v0.3). The server tells only the sender.
 */
export function markChatRead(peerId: string): void {
  live.chats = live.chats.map((chat) => (chat.peerId === peerId ? { ...chat, unread: 0 } : chat));
}

export function refreshTopics(...topics: Topic[]): Promise<void> {
  return refresh(topics);
}

export function refreshAll(): Promise<void> {
  // v0.7.2: on start, after signing in and on return to the app, waiting homecomings appear.
  return refresh([
    'chats',
    'contacts',
    'news',
    'profile',
    'push',
    'owls',
    'finance',
    'map',
    'homecomings',
    'banners',
  ]);
}

let source: EventSource | null = null;
let poll: ReturnType<typeof setInterval> | null = null;
let failures = 0;
let started = false;

function open(): void {
  if (source || document.visibilityState !== 'visible' || !account.profile) return;
  source = new EventSource('/api/events');
  source.addEventListener('changed', (event) => {
    failures = 0;
    const { topics } = JSON.parse((event as MessageEvent<string>).data) as { topics: Topic[] };
    void refresh(topics);
    // A delivery landed while the app is visible: show its arrival image at once.
    if (topics.includes('system') && document.visibilityState === 'visible') {
      void showSystemArrivals().catch(() => undefined);
    }
  });
  source.onerror = () => {
    failures++;
    if (failures >= 3 && !poll) {
      // SSE does not work here: poll every 60 s while visible (SPEC 11.6).
      close();
      poll = setInterval(() => void refreshAll(), OPERATIONS.FOREGROUND_POLL_SECONDS * 1000);
    }
  };
}

function close(): void {
  source?.close();
  source = null;
}

function onVisibility(): void {
  if (document.visibilityState === 'visible') {
    void refreshAll();
    if (!poll) open();
  } else {
    close();
    if (poll) {
      clearInterval(poll);
      poll = null;
      failures = 0;
    }
  }
}

export function startLive(): void {
  if (started) return;
  started = true;
  document.addEventListener('visibilitychange', onVisibility);
  void refreshAll();
  open();
}

export function stopLive(): void {
  started = false;
  document.removeEventListener('visibilitychange', onVisibility);
  close();
  if (poll) clearInterval(poll);
  poll = null;
}
