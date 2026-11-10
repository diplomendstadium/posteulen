/**
 * Live updates while the app is visible (SPEC 11.6): Server-Sent Events carrying only hints
 * ("chats changed"), never content. The client then fetches what it needs.
 */
import type { ServerResponse } from 'node:http';

export type Topic =
  | 'chats'
  | 'contacts'
  | 'news'
  | 'system'
  | 'profile'
  | 'push'
  | 'owls'
  | 'finance'
  | 'map'
  /** v0.7.2: an own owl came home (overlay). */
  | 'homecomings'
  /** v0.8.2: timed banners of the admin. */
  | 'banners';

const MAX_PER_USER = 3;
const HEARTBEAT_MS = 25_000;

export class EventHub {
  private readonly streams = new Map<string, Set<ServerResponse>>();
  private readonly heartbeat: NodeJS.Timeout;

  constructor() {
    this.heartbeat = setInterval(() => {
      for (const set of this.streams.values()) for (const stream of set) stream.write(': ping\n\n');
    }, HEARTBEAT_MS);
    this.heartbeat.unref?.();
  }

  add(userId: string, stream: ServerResponse): void {
    const set = this.streams.get(userId) ?? new Set<ServerResponse>();
    if (set.size >= MAX_PER_USER) {
      const oldest = set.values().next().value;
      if (oldest) {
        oldest.end();
        set.delete(oldest);
      }
    }
    set.add(stream);
    this.streams.set(userId, set);
    stream.on('close', () => {
      set.delete(stream);
      if (set.size === 0) this.streams.delete(userId);
    });
  }

  notify(userId: string, ...topics: Topic[]): void {
    const set = this.streams.get(userId);
    if (!set) return;
    const data = `event: changed\ndata: ${JSON.stringify({ topics })}\n\n`;
    for (const stream of set) stream.write(data);
  }

  /** v0.7: a hint to everybody connected (e.g. the daily gold, which reaches all accounts). */
  notifyAll(...topics: Topic[]): void {
    const data = `event: changed\ndata: ${JSON.stringify({ topics })}\n\n`;
    for (const set of this.streams.values()) for (const stream of set) stream.write(data);
  }

  /** Ends all streams of a user (logout, login elsewhere). */
  close(userId: string): void {
    for (const stream of this.streams.get(userId) ?? []) stream.end();
    this.streams.delete(userId);
  }

  connected(userId: string): number {
    return this.streams.get(userId)?.size ?? 0;
  }

  shutdown(): void {
    clearInterval(this.heartbeat);
    for (const set of this.streams.values()) for (const stream of set) stream.end();
    this.streams.clear();
  }
}
