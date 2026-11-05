import fs from 'node:fs';
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
import { registerGoldJobs, registerGoldRoutes } from './gold/routes.ts';

export interface App {
  readonly config: Config;
  readonly db: Database;
  readonly secrets: Secrets;
  readonly userApi: FastifyInstance;
  readonly adminApi: FastifyInstance;
  readonly ctx: Context;
  close(): Promise<void>;
}

export class StartupError extends Error {}

/** Checks that database and secrets file belong together (ARCHITECTURE 10.3). */
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
  ctx.push = new PushService(ctx, options.pushSender);
  registerLetterHandlers(ctx);
  registerFlightHandlers(ctx);
  registerGoldJobs(ctx);
  registerUserRoutes(userApi, ctx);
  await registerContactRoutes(userApi, ctx);
  registerLetterRoutes(userApi, ctx);
  registerPushRoutes(userApi, ctx);
  registerOwlRoutes(userApi, ctx);
  registerGoldRoutes(userApi, ctx);
  registerFlightRoutes(userApi, ctx);
  registerAdminRoutes(adminApi, ctx);

  return {
    config,
    db,
    secrets,
    userApi,
    adminApi,
    ctx,
    async close() {
      ctx.queue.stop();
      ctx.hub.shutdown();
      await Promise.allSettled([userApi.close(), adminApi.close()]);
      db.close();
    },
  };
}

/** Starts background work: event queue (with daily jobs) and pending pushes. */
export function startWorkers(app: App): void {
  app.ctx.queue.start();
  app.ctx.push.resendPending(app.ctx.now());
}

export async function listen(app: App): Promise<void> {
  await app.userApi.listen({ host: app.config.host, port: app.config.userPort });
  await app.adminApi.listen({ host: app.config.host, port: app.config.adminPort });
}
