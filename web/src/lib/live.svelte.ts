/**
 * Data of the logged-in app and live updates (SPEC 11.6): while the app is visible a
 * Server-Sent-Events connection delivers hints; on start and on every return to the
 * foreground everything is reloaded. If SSE fails, poll every 60 s – only in the foreground.
 * Nothing runs in the background.
 */
import { OPERATIONS } from '@posteulen/shared/constants.ts';
import { isDay } from '@posteulen/shared/game/sun.ts';
import { api } from './api.ts';
import { account, onSignOut, setProfile } from './auth.svelte.ts';
import { currentContext, isCurrent, type AccountContext } from './context.ts';
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
  /** v0.8.5: an owl of this peer is resting here right now. */
  /** v1.4: how many owls of this peer rest here right now (one 🦉 each). */
  readonly owlsResting?: number;
}

export interface Contact {
  readonly userId: string;
  readonly name: string;
  readonly since: number;
  readonly active: boolean;
  readonly keyWarning: boolean;
  /** v1.4: has the most own owls – no owl or chick can be given to them (SPEC 9.2.3). */
  readonly owlsFull?: boolean;
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
  queuedArrivals.clear();
  // SPEC 5.5: the live connection and timers of the previous account end with it; they are
  // opened again for the next account (startLive keeps running for the shell).
  close();
  stopPolling();
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
async function showHomecomings(context: AccountContext): Promise<void> {
  if (document.visibilityState !== 'visible') return;
  const { homecomings } = await api<{
    homecomings: {
      id: string;
      owl: string;
      species: string;
      letters: number;
      /** v1.4: an owl that flew off into freedom (shown once with its freedom picture). */
      kind?: 'home' | 'freedom';
    }[];
  }>('GET', '/api/homecomings', undefined, { context });
  if (!isCurrent(context)) return;
  const fresh = homecomings.filter((item) => !queuedHomecomings.has(item.id));
  if (fresh.length === 0) return;
  for (const item of fresh) {
    queuedHomecomings.add(item.id);
    queueOwlImage(() => {
      const home = account.profile?.home;
      const day = home ? isDay(Date.now(), home.lat, home.lon) : true;
      // v1.4: a bored owl that flew off – once, at the next opportunity (SPEC 9.2.9).
      if (item.kind === 'freedom')
        return {
          species: item.species,
          kind: day ? 'free' : 'freeNight',
          caption: fill(t.owls.flewOff, { name: item.owl }),
        };
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
  await api('POST', '/api/homecomings/seen', { ids: fresh.map((item) => item.id) }, { context });
}

/** v1.1: letters whose arrival image is already queued in this tab (no double pictures). */
// Plain Set on purpose: bookkeeping, not rendered state.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const queuedArrivals = new Set<string>();

/**
 * v1.1: the landing of every owl that brought a letter the user has not seen arrive yet – at
 * the first opportunity (open app, start, sign-in, return), no longer only in the chat. Several
 * appear one after another in the order they landed (SPEC 9.2.6).
 */
async function showArrivals(context: AccountContext): Promise<void> {
  if (document.visibilityState !== 'visible') return;
  const { arrivals } = await api<{
    arrivals: { id: string; owl: string; species: string; kind: string; from: string | null }[];
  }>('GET', '/api/arrivals', undefined, { context });
  if (!isCurrent(context)) return;
  const fresh = arrivals.filter((item) => !queuedArrivals.has(item.id));
  if (fresh.length === 0) return;
  for (const item of fresh) {
    queuedArrivals.add(item.id);
    queueOwlImage(() => ({
      species: item.species,
      kind: item.kind === 'cover_chick' ? 'chick' : 'arrival',
      caption: fill(t.owls.arrivesFrom, {
        name: item.owl,
        from: item.from ?? t.letters.unknown,
      }),
    }));
  }
  await api(
    'POST',
    '/api/letters/arrival-seen',
    { ids: fresh.map((item) => item.id) },
    { context },
  );
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
  const context = currentContext();
  if (!context) return;
  const list =
    messages ??
    (
      await api<{ messages: SystemMessage[] }>('GET', '/api/system-messages', undefined, {
        context,
      })
    ).messages;
  if (!isCurrent(context)) return;
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
  await api(
    'POST',
    '/api/system-messages/arrival-shown',
    { ids: pending.map((m) => m.id) },
    { context },
  );
}

async function refresh(topics: readonly Topic[]): Promise<void> {
  const context = currentContext();
  if (!context || !account.profile) return;
  /** Answers of an earlier account context are dropped (SPEC 5.5). */
  const current = (): boolean => isCurrent(context);
  const get = <T>(path: string): Promise<T> => api<T>('GET', path, undefined, { context });
  const tasks: Promise<void>[] = [];
  if (topics.includes('chats') || topics.includes('system')) {
    tasks.push(
      get<{ chats: ChatSummary[]; system: { unread: number } }>('/api/chats').then((result) => {
        if (!current()) return;
        live.chats = result.chats;
        live.systemUnread = result.system.unread;
        live.chatVersion++;
      }),
    );
  }
  if (topics.includes('contacts')) {
    tasks.push(
      get<{
        contacts: Contact[];
        bots: BotContact[];
        allBots?: number;
        botsDisabled?: boolean;
        requests: { id: string; label: string; expiresAt: number }[];
      }>('/api/contacts').then(async (result) => {
        if (!current()) return;
        live.contacts = result.contacts;
        live.bots = result.bots;
        live.allBots = result.allBots ?? result.bots.length;
        live.botsDisabled = result.botsDisabled ?? false;
        live.requests = result.requests;
        // The vault is synchronised with exactly this context's contact list.
        await syncVault(result.contacts, context);
      }),
    );
  }
  if (topics.includes('news')) {
    tasks.push(
      get<{ news: NewsItem[] }>('/api/news').then((result) => {
        if (current()) live.news = result.news;
      }),
    );
  }
  if (topics.includes('profile')) {
    tasks.push(
      get<{ profile: typeof account.profile }>('/api/sync').then((result) => {
        setProfile(context, result.profile);
      }),
    );
  }
  if (topics.includes('homecomings')) tasks.push(showHomecomings(context));
  // v1.1: new letters can arrive with every change of the chats.
  if (topics.includes('chats')) tasks.push(showArrivals(context));
  if (topics.includes('banners')) {
    tasks.push(
      get<{ banners: { id: string; text: string; endsAt: number }[] }>('/api/banners').then(
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
      get<{ state: string }>('/api/push/status').then((result) => {
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

function stopPolling(): void {
  if (poll) clearInterval(poll);
  poll = null;
  failures = 0;
}

/**
 * The SSE connection belongs to one account context: it carries the expected account (the
 * server refuses it if the session cookie belongs to another account), and its events are
 * ignored once the context ended – a late hint of account A never refreshes account B.
 */
function open(): void {
  const context = currentContext();
  if (!started || source || document.visibilityState !== 'visible' || !context) return;
  const connection = new EventSource(
    `/api/events?account=${encodeURIComponent(context.accountId)}`,
  );
  source = connection;
  connection.addEventListener('changed', (event) => {
    if (!isCurrent(context) || source !== connection) return;
    failures = 0;
    const { topics } = JSON.parse((event as MessageEvent<string>).data) as { topics: Topic[] };
    void refresh(topics);
    // A delivery landed while the app is visible: show its arrival image at once.
    if (topics.includes('system') && document.visibilityState === 'visible') {
      void showSystemArrivals().catch(() => undefined);
    }
  });
  connection.onerror = () => {
    if (!isCurrent(context) || source !== connection) {
      connection.close();
      return;
    }
    failures++;
    if (failures >= 3 && !poll) {
      // SSE does not work here: poll every 60 s while visible (SPEC 11.6).
      close();
      poll = setInterval(() => {
        if (isCurrent(context)) void refreshAll();
        else stopPolling();
      }, OPERATIONS.FOREGROUND_POLL_SECONDS * 1000);
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
    stopPolling();
  }
}

/**
 * The shell is shown (signed in): live updates for the current account. Called again after a
 * change of account in the same tab, it connects for the new account.
 */
export function startLive(): void {
  if (!started) {
    started = true;
    document.addEventListener('visibilitychange', onVisibility);
  }
  void refreshAll();
  open();
}

export function stopLive(): void {
  started = false;
  document.removeEventListener('visibilitychange', onVisibility);
  close();
  stopPolling();
}
