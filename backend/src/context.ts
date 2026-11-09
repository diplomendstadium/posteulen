/**
 * Everything request handlers need, created once per process: database, secrets, derived
 * server keys, clock, rate limits and short-lived in-memory state (D-17).
 */
import { getRandomValues } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { SERVER_CONTEXTS } from '@posteulen/shared/crypto/contexts.ts';
import { SECURITY } from '@posteulen/shared/constants.ts';
import { MASK_BYTES, WORLD_MASK_BYTES } from '@posteulen/shared/map/landmask.ts';
import type { Config } from './config.ts';
import type { Database } from './db/database.ts';
import { deriveServerKey, type Secrets } from './secrets.ts';
import { Altcha } from './security/altcha.ts';
import { Ephemeral, LoginGuard, RateLimiter } from './security/limits.ts';
import { EventHub } from './events/hub.ts';
import { EventQueue } from './queue/queue.ts';
import type { PushService } from './push/service.ts';
import { openAiClient } from './bots/ai.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export interface LoginAttempt {
  readonly kind: 'user' | 'admin' | 'reauth' | 'admin-reauth' | 'bots' | 'bots-reauth';
  readonly userId: string | null;
  readonly nameKey: string;
  readonly ipKey: string;
  readonly serverLoginState: string;
  readonly purpose?: string;
}

export interface Reservation {
  readonly userId: string;
  readonly display: string;
  readonly key: string;
  readonly inviteHmac: Buffer | null;
}

export interface ReauthToken {
  readonly subject: string;
  readonly purpose: string;
}

export interface Context {
  readonly config: Config;
  readonly db: Database;
  readonly secrets: Secrets;
  readonly keys: {
    readonly fakeCredential: Uint8Array;
    readonly nameLock: Uint8Array;
    readonly invite: Uint8Array;
    /** v0.7 */
    readonly voucher: Uint8Array;
    readonly loanName: Uint8Array;
  };
  readonly landMask: Uint8Array;
  /** v0.8: coarse land/water mask of the whole world (bots live anywhere on land). */
  readonly worldMask: Uint8Array;
  readonly altcha: Altcha;
  now(): number;
  readonly guards: {
    readonly names: LoginGuard;
    readonly ips: LoginGuard;
    readonly admin: LoginGuard;
    /** v0.8: the control centre has its own login guard. */
    readonly bots: LoginGuard;
  };
  readonly limits: {
    readonly general: RateLimiter;
    readonly expensive: RateLimiter;
    readonly registration: RateLimiter;
    readonly session: RateLimiter;
    readonly admin: RateLimiter;
    /** v0.8: everything on the control-centre host. */
    readonly bots: RateLimiter;
    /** Push subscription changes and tests per account (v0.6.1). */
    readonly push: RateLimiter;
  };
  readonly attempts: Ephemeral<LoginAttempt>;
  readonly reservations: Ephemeral<Reservation>;
  readonly reauthTokens: Ephemeral<ReauthToken>;
  readonly letterTokens: Ephemeral<TransportToken>;
  readonly hub: EventHub;
  readonly queue: EventQueue;
  /** Set right after creation (needs the context itself). */
  push: PushService;
  /** OpenAI connection (tests inject a fake, SPEC 10.5). */
  readonly ai: import('./bots/ai.ts').AiClient;
  /** Set right after creation: runs due bot replies outside of transactions. */
  botReplies: import('./bots/replies.ts').BotReplies;
  /** v0.8: set right after creation – deliveries of the control-centre bots (AI outside of transactions). */
  centralBots: import('./central/runner.ts').CentralRunner;
  /** Only for automated local tests: flights run this many times faster (1 on servers). */
  readonly flightTimeScale: number;
  /** Uniform random number in [0, 1) – tests inject a fixed sequence (SPEC 17.2). */
  random(): number;
}

/** A prepared transport (letter, gold, gift), valid for 5 minutes (SPEC Anhang L.4). */
export interface TransportToken {
  readonly senderId: string;
  readonly purpose: 'letter' | 'gold' | 'gift';
  /** Own or loan owl, or the chick of a chick gift. */
  readonly owlId: string;
  readonly kind: 'letter' | 'cover_gold' | 'cover_owl' | 'cover_chick';
  /** Gift flight of a chick (9.9). */
  readonly chick?: boolean;
  readonly parchment: 'small' | 'large';
  readonly recipients: readonly string[];
  /** Letters to be sent (none for gold or a gift without a cover letter). */
  readonly letters: readonly {
    readonly recipientId: string;
    readonly letterId: string;
    readonly sentAt: number;
  }[];
  readonly gold: number;
  /** v0.7: rest at each recipient (hours, letters between people only). */
  readonly restHours?: number;
}

/** Uniform in [0, 1) with 53 random bits from the CSPRNG. */
export function secureRandom(): number {
  const [high = 0, low = 0] = getRandomValues(new Uint32Array(2));
  return (high * 2 ** 21 + (low >>> 11)) / 2 ** 53;
}

export const LAND_MASK_FILE = path.resolve(import.meta.dirname, '../../shared/data/landmask.bin');
export const WORLD_MASK_FILE = path.resolve(import.meta.dirname, '../../shared/data/worldmask.bin');

export interface ContextOptions {
  readonly now?: () => number;
  /** Proof-of-work difficulty; tests use a tiny value. */
  readonly altchaMaxCounter?: number;
  /** Only for automated local tests: many accounts from one IP (never on servers). */
  readonly relaxedLimits?: boolean;
  /** Flight time scale for automated local tests (default 1). */
  readonly flightTimeScale?: number;
  readonly random?: () => number;
  /** Replaces the OpenAI client (tests). */
  readonly aiClient?: import('./bots/ai.ts').AiClient;
  /** Replaces the network transport of Web Push (tests). */
  readonly pushSender?: import('./push/service.ts').PushSender;
}

export async function createContext(
  config: Config,
  db: Database,
  secrets: Secrets,
  options: ContextOptions = {},
): Promise<Context> {
  const landMask = new Uint8Array(fs.readFileSync(LAND_MASK_FILE));
  if (landMask.length !== MASK_BYTES) throw new Error('land mask has the wrong size');
  const worldMask = new Uint8Array(fs.readFileSync(WORLD_MASK_FILE));
  if (worldMask.length !== WORLD_MASK_BYTES) throw new Error('world mask has the wrong size');
  const altchaKey = await deriveServerKey(secrets, SERVER_CONTEXTS.ALTCHA);
  const now = options.now ?? Date.now;
  return {
    config,
    db,
    secrets,
    keys: {
      fakeCredential: await deriveServerKey(secrets, SERVER_CONTEXTS.FAKE_CREDENTIAL),
      nameLock: await deriveServerKey(secrets, SERVER_CONTEXTS.NAME_LOCK),
      invite: await deriveServerKey(secrets, SERVER_CONTEXTS.INVITE),
      voucher: await deriveServerKey(secrets, SERVER_CONTEXTS.VOUCHER),
      loanName: await deriveServerKey(secrets, SERVER_CONTEXTS.LOAN_NAME),
    },
    landMask,
    worldMask,
    altcha: new Altcha(Buffer.from(altchaKey).toString('hex'), options.altchaMaxCounter ?? 50_000),
    now,
    guards: {
      names: new LoginGuard(),
      // Per IP more generous: many people may share one address. Local automated tests
      // (relaxed limits, development only) log in hundreds of times from one address: there the
      // per-IP delay never starts; per name everything stays as in production.
      ips: options.relaxedLimits ? new LoginGuard(10_000, 10) : new LoginGuard(20, 10),
      admin: new LoginGuard(),
      bots: new LoginGuard(),
    },
    limits: options.relaxedLimits
      ? {
          general: new RateLimiter(100_000, MINUTE),
          expensive: new RateLimiter(100_000, MINUTE),
          registration: new RateLimiter(100_000, HOUR),
          session: new RateLimiter(100_000, MINUTE),
          admin: new RateLimiter(100_000, MINUTE),
          bots: new RateLimiter(100_000, MINUTE),
          push: new RateLimiter(100_000, HOUR),
        }
      : {
          general: new RateLimiter(600, MINUTE),
          expensive: new RateLimiter(30, MINUTE),
          registration: new RateLimiter(5, HOUR),
          session: new RateLimiter(300, MINUTE),
          admin: new RateLimiter(120, MINUTE),
          bots: new RateLimiter(600, MINUTE),
          push: new RateLimiter(SECURITY.PUSH_CHANGES_PER_HOUR, HOUR),
        },
    attempts: new Ephemeral(),
    reservations: new Ephemeral(),
    reauthTokens: new Ephemeral(),
    letterTokens: new Ephemeral(),
    hub: new EventHub(),
    queue: new EventQueue(db, now),
    push: undefined as unknown as PushService,
    ai: options.aiClient ?? openAiClient,
    botReplies: undefined as unknown as import('./bots/replies.ts').BotReplies,
    centralBots: undefined as unknown as import('./central/runner.ts').CentralRunner,
    flightTimeScale: options.flightTimeScale ?? 1,
    random: options.random ?? secureRandom,
  };
}
