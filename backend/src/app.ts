import fs from 'node:fs';
import * as opaque from '@serenity-kit/opaque';
import type { FastifyInstance } from 'fastify';
import type { Config } from './config.ts';
import { openDatabase, type Database } from './db/database.ts';
import { loadMigrations, migrate, schemaState } from './db/migrate.ts';
import { buildApi } from './http/server.ts';
import { loadSecrets, secretsFingerprint, type Secrets } from './secrets.ts';
import { createContext, type Context, type ContextOptions } from './context.ts';
import { registerUserRoutes } from './auth/user-routes.ts';
import { registerAdminRoutes } from './admin/admin-routes.ts';
import { registerContactRoutes } from './contacts/routes.ts';
import { registerLetterHandlers, registerLetterRoutes } from './letters/routes.ts';
import { registerPushRoutes } from './push/routes.ts';
import { PushService } from './push/service.ts';
import { registerFlightHandlers } from './flights/service.ts';
import { registerFlightRoutes } from './flights/routes.ts';
import { registerOwlRoutes } from './owls/routes.ts';
import { registerLifecycleHandlers } from './owls/lifecycle.ts';
import { registerAccountHandlers } from './accounts/lifecycle.ts';
import { registerAccountRoutes } from './accounts/routes.ts';
import { ensureBotsForAllUsers, registerBotHandlers } from './bots/service.ts';
import {
  ensureDonationSchedules,
  registerDonationHandler,
  sendUpdateNotes,
} from './messages/periodic.ts';
import { BotReplies, registerReplyHandler } from './bots/replies.ts';
import { registerBotRoutes } from './bots/routes.ts';
import { registerGoldJobs, registerGoldRoutes } from './gold/routes.ts';
import { removeRelatives } from './bots/relatives.ts';
import { logError } from './ops/error-log.ts';
import { CentralRunner } from './central/runner.ts';
import { registerCentralHandlers } from './central/service.ts';
import { registerBotsCentreRoutes } from './central/routes.ts';

export interface App {
  readonly config: Config;
  readonly db: Database;
  readonly secrets: Secrets;
  readonly userApi: FastifyInstance;
  readonly adminApi: FastifyInstance;
  /** v0.8: the bots control centre. */
  readonly botsApi: FastifyInstance;
  readonly ctx: Context;
  close(): Promise<void>;
}

export class StartupError extends Error {}

/** Checks that database and secrets file belong together (SPEC Anhang L.7). */
export async function verifySecretsFingerprint(db: Database, secrets: Secrets): Promise<void> {
  const expected = await secretsFingerprint(secrets);
  const row = db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'secrets_fingerprint'");
  if (row === undefined) {
    db.run("INSERT INTO meta (key, value) VALUES ('secrets_fingerprint', ?)", expected);
  } else if (row.value !== expected) {
    throw new StartupError(
      'Die Geheimnis-Datei passt nicht zu dieser Datenbank. Bitte die zugehörige gesicherte Geheimnis-Datei zurückspielen.',
    );
  }
}

export async function createApp(config: Config, options: ContextOptions = {}): Promise<App> {
  await opaque.ready;
  const secrets = loadSecrets(config.secretsFile);
  fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  const db = openDatabase(config.databaseFile);
  try {
    const migrations = loadMigrations();
    const state = schemaState(db, migrations);
    if (state.kind === 'too_new') {
      throw new StartupError(
        `Die Datenbank (Schema ${state.version}) ist neuer als diese Programmversion (Schema ${state.latest}). Start abgebrochen.`,
      );
    }
    if (state.kind === 'pending') {
      if (config.env === 'production') {
        throw new StartupError(
          `Datenbank-Migrationen stehen aus (Schema ${state.version} → ${state.latest}). Bitte „posteulen-cli migrate“ ausführen.`,
        );
      }
      migrate(db, migrations);
    }
    await verifySecretsFingerprint(db, secrets);
  } catch (error) {
    db.close();
    throw error;
  }

  const hsts = config.env === 'production';
  const logLevel = config.env === 'test' ? undefined : config.logLevel;
  const ctx = await createContext(config, db, secrets, options);
  const userApi = buildApi({ kind: 'user', origin: config.userOrigin, db, hsts, logLevel });
  const adminApi = buildApi({ kind: 'admin', origin: config.adminOrigin, db, hsts, logLevel });
  const botsApi = buildApi({ kind: 'bots', origin: config.botsOrigin, db, hsts, logLevel });
  ctx.push = new PushService(ctx, options.pushSender);
  ctx.botReplies = new BotReplies(ctx, ctx.ai);
  ctx.centralBots = new CentralRunner(ctx, ctx.ai);
  registerLetterHandlers(ctx);
  registerFlightHandlers(ctx);
  registerLifecycleHandlers(ctx);
  registerAccountHandlers(ctx);
  registerBotHandlers(ctx);
  registerReplyHandler(ctx);
  registerCentralHandlers(ctx);
  // v0.8: aunt and uncle are gone – at every start, so also again after a rollback (SPEC Anhang T).
  // v0.8.1: a failure here must never keep the server from starting – it is logged and tried
  // again at the next start (the whole clean-up is one transaction).
  try {
    removeRelatives(ctx);
  } catch (error) {
    logError(
      db,
      {
        component: 'Bots',
        severity: 'error',
        what: 'Tante und Onkel konnten beim Start nicht entfernt werden.',
        cause: error instanceof Error ? error.message : 'Unerwarteter Fehler.',
        action: 'Wird beim nächsten Start erneut versucht. Bitte melden.',
      },
      ctx.now(),
    );
  }
  // Accounts from before stage 5 get their Erklärbär once (D-82).
  ensureBotsForAllUsers(ctx);
  // v0.3: donation requests every five weeks, notes about an update for every account.
  registerDonationHandler(ctx);
  ensureDonationSchedules(ctx);
  sendUpdateNotes(ctx);
  registerGoldJobs(ctx);
  registerUserRoutes(userApi, ctx);
  await registerContactRoutes(userApi, ctx);
  registerLetterRoutes(userApi, ctx);
  registerPushRoutes(userApi, ctx);
  registerOwlRoutes(userApi, ctx);
  registerGoldRoutes(userApi, ctx);
  registerFlightRoutes(userApi, ctx);
  registerAccountRoutes(userApi, ctx);
  registerBotRoutes(userApi, ctx);
  registerAdminRoutes(adminApi, ctx);
  registerBotsCentreRoutes(botsApi, ctx);

  return {
    config,
    db,
    secrets,
    userApi,
    adminApi,
    botsApi,
    ctx,
    async close() {
      ctx.queue.stop();
      ctx.hub.shutdown();
      await Promise.allSettled([userApi.close(), adminApi.close(), botsApi.close()]);
      db.close();
    },
  };
}

/** Starts background work: event queue (with daily jobs) and pending pushes. */
export function startWorkers(app: App): void {
  app.ctx.queue.start();
  app.ctx.botReplies.kick();
  app.ctx.centralBots.kick();
  app.ctx.push.resendPending(app.ctx.now());
}

export async function listen(app: App): Promise<void> {
  await app.userApi.listen({ host: app.config.host, port: app.config.userPort });
  await app.adminApi.listen({ host: app.config.host, port: app.config.adminPort });
  await app.botsApi.listen({ host: app.config.host, port: app.config.botsPort });
}
