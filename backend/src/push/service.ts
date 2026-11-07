/**
 * Notifications and Web Push (SPEC 11.2–11.5). A notification stays stored until the service
 * worker confirms it or the user saw it in the app ("Neuigkeiten"). Push payloads carry only
 * an ID and a type – the visible text contains no names and no content.
 */
import type { Context } from '../context.ts';
import { logError } from '../ops/error-log.ts';
import { randomId } from '../security/ids.ts';
import { sendPush, type SendResult, type Subscription, type Vapid } from './transport.ts';

export type NotificationType =
  | 'letter_arrived'
  | 'gold_arrived'
  | 'owl_gift'
  | 'chick_gift'
  | 'eggs_laid'
  | 'chicks_hatched'
  | 'deletion_warning'
  | 'broadcast'
  | 'owl_home'
  | 'push_test';

export type PushSender = (
  subscription: Subscription,
  payload: string,
  vapid: Vapid,
) => Promise<SendResult>;

const CONCURRENCY = 4;

export class PushService {
  private readonly queue: string[] = [];
  private active = 0;
  private readonly ctx: Context;
  private readonly sender: PushSender;
  private readonly vapid: Vapid;
  /** For tests: resolves when the queue is empty. */
  private idleWaiters: (() => void)[] = [];

  constructor(ctx: Context, sender: PushSender = sendPush) {
    this.ctx = ctx;
    this.sender = sender;
    this.vapid = {
      subject: ctx.config.userOrigin.startsWith('https://')
        ? ctx.config.userOrigin
        : 'mailto:admin@posteulen.invalid',
      publicKey: ctx.secrets.vapid.publicKey,
      privateKey: ctx.secrets.vapid.privateKey,
    };
  }

  /** Creates a notification (inside the caller's transaction); push goes out after commit. */
  notify(
    userId: string,
    type: NotificationType,
    ref: string | null,
    now: number,
    after: (work: () => void) => void,
  ): string {
    const id = randomId();
    const hasSubscription =
      this.ctx.db.get('SELECT 1 FROM push_subscriptions WHERE user_id = ?', userId) !== undefined;
    this.ctx.db.run(
      'INSERT INTO notifications (id, user_id, type, ref, created_at, push_state) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      userId,
      type,
      ref,
      now,
      hasSubscription ? 'pending' : 'none',
    );
    after(() => {
      this.ctx.hub.notify(userId, 'news');
      if (hasSubscription) this.enqueue(id);
    });
    return id;
  }

  enqueue(notificationId: string): void {
    this.queue.push(notificationId);
    this.pump();
  }

  /** After a restart: pushes that were not sent yet (created within the last day). */
  resendPending(now: number): void {
    const rows = this.ctx.db.all<{ id: string }>(
      "SELECT id FROM notifications WHERE push_state = 'pending' AND created_at > ?",
      now - 24 * 60 * 60 * 1000,
    );
    for (const row of rows) this.enqueue(row.id);
  }

  idle(): Promise<void> {
    if (this.active === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private pump(): void {
    while (this.active < CONCURRENCY && this.queue.length > 0) {
      const id = this.queue.shift();
      if (!id) break;
      this.active++;
      void this.send(id).finally(() => {
        this.active--;
        this.pump();
        if (this.active === 0 && this.queue.length === 0) {
          const waiters = this.idleWaiters;
          this.idleWaiters = [];
          for (const resolve of waiters) resolve();
        }
      });
    }
  }

  private async send(notificationId: string): Promise<void> {
    const row = this.ctx.db.get<{
      user_id: string;
      type: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      language: string;
    }>(
      `SELECT n.user_id, n.type, s.endpoint, s.p256dh, s.auth, u.language
         FROM notifications n JOIN push_subscriptions s ON s.user_id = n.user_id
         JOIN users u ON u.id = n.user_id
        WHERE n.id = ? AND n.push_state = 'pending'`,
      notificationId,
    );
    if (!row) return;
    let result: SendResult;
    try {
      result = await this.sender(
        row,
        // v0.4: the service worker shows the text in the account's language.
        JSON.stringify({ id: notificationId, type: row.type, lang: row.language }),
        this.vapid,
      );
    } catch {
      result = { error: 'exception' };
    }
    const now = this.ctx.now();
    if ('status' in result && result.status >= 200 && result.status < 300) {
      this.ctx.db.run("UPDATE notifications SET push_state = 'sent' WHERE id = ?", notificationId);
      return;
    }
    this.ctx.db.run("UPDATE notifications SET push_state = 'failed' WHERE id = ?", notificationId);
    if ('status' in result && (result.status === 404 || result.status === 410)) {
      // Subscription gone at the push service (SPEC 11.3).
      this.ctx.db.run(
        'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
        row.user_id,
        row.endpoint,
      );
      this.ctx.hub.notify(row.user_id, 'push');
      return;
    }
    logError(
      this.ctx.db,
      {
        component: 'Push',
        severity: 'warning',
        what: 'Eine Push-Benachrichtigung konnte nicht zugestellt werden.',
        cause:
          'status' in result
            ? `Der Push-Dienst antwortete mit Status ${result.status}.`
            : 'Verbindung zum Push-Dienst fehlgeschlagen oder Adresse nicht erlaubt.',
        action:
          'Meist vorübergehend. Häufen sich die Meldungen, Netzwerk und ausgehende Verbindungen (Port 443) prüfen.',
      },
      now,
    );
  }
}
