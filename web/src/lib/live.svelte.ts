/**
 * Data of the logged-in app and live updates (SPEC 11.6): while the app is visible a
 * Server-Sent-Events connection delivers hints; on start and on every return to the
 * foreground everything is reloaded. If SSE fails, poll every 60 s – only in the foreground.
 * Nothing runs in the background.
 */
import { OPERATIONS } from '@posteulen/shared/constants.ts';
import { api } from './api.ts';
import { account } from './auth.svelte.ts';
import { syncVault } from './vault.svelte.ts';

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
  requests: { id: string; label: string; expiresAt: number }[];
  news: NewsItem[];
  pushState: string;
  /** Increments on every chat change so open conversations reload. */
  chatVersion: number;
}>({
  chats: [],
  systemUnread: 0,
  contacts: [],
  requests: [],
  news: [],
  pushState: 'none',
  chatVersion: 0,
});

type Topic = 'chats' | 'contacts' | 'news' | 'system' | 'profile' | 'push';

async function refresh(topics: readonly Topic[]): Promise<void> {
  if (!account.profile) return;
  const tasks: Promise<void>[] = [];
  if (topics.includes('chats') || topics.includes('system')) {
    tasks.push(
      api<{ chats: ChatSummary[]; system: { unread: number } }>('GET', '/api/chats').then(
        (result) => {
          live.chats = result.chats;
          live.systemUnread = result.system.unread;
          live.chatVersion++;
        },
      ),
    );
  }
  if (topics.includes('contacts')) {
    tasks.push(
      api<{ contacts: Contact[]; requests: { id: string; label: string; expiresAt: number }[] }>(
        'GET',
        '/api/contacts',
      ).then(async (result) => {
        live.contacts = result.contacts;
        live.requests = result.requests;
        await syncVault(result.contacts);
      }),
    );
  }
  if (topics.includes('news')) {
    tasks.push(
      api<{ news: NewsItem[] }>('GET', '/api/news').then((result) => {
        live.news = result.news;
      }),
    );
  }
  if (topics.includes('profile')) {
    tasks.push(
      api<{ profile: typeof account.profile }>('GET', '/api/sync').then((result) => {
        if (result.profile) account.profile = result.profile;
      }),
    );
  }
  if (topics.includes('push')) {
    tasks.push(
      api<{ state: string }>('GET', '/api/push/status').then((result) => {
        live.pushState = result.state;
      }),
    );
  }
  await Promise.allSettled(tasks);
}

export function refreshTopics(...topics: Topic[]): Promise<void> {
  return refresh(topics);
}

export function refreshAll(): Promise<void> {
  return refresh(['chats', 'contacts', 'news', 'profile', 'push']);
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
