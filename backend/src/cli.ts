#!/usr/bin/env node
/**
 * posteulen-cli – server administration commands (run as root or the service user).
 * Commands: setup, migrate, check, admin-init, admin-reset, bots-init, bots-reset, bots-export,
 * bots-import, caddyfile, backup, version, schema-version.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { VERSION } from '@posteulen/shared/version.ts';
import { loadConfig } from './config.ts';
import { openDatabase } from './db/database.ts';
import { loadMigrations, migrate, schemaState } from './db/migrate.ts';
import { createSecretsFileIfMissing, loadSecrets } from './secrets.ts';
import { verifySecretsFingerprint } from './app.ts';
import { generateCaddyfile } from './ops/caddyfile.ts';
import { adminExists, setInitialAdminPassword } from './admin/admin-auth.ts';
import { createContext } from './context.ts';
import { applyImport, exportBots, planImport } from './central/transfer.ts';

function fail(message: string): never {
  console.error(`Fehler: ${message}`);
  process.exit(1);
}

function configFromEnv() {
  try {
    return loadConfig({ POSTEULEN_DOMAIN: 'localhost.invalid', ...process.env });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  switch (command) {
    case 'version':
      console.log(VERSION);
      return;

    case 'schema-version':
      console.log(loadMigrations().length);
      return;

    case 'setup': {
      const config = configFromEnv();
      const created = await createSecretsFileIfMissing(config.secretsFile);
      console.log(
        created
          ? `Geheimnis-Datei erzeugt: ${config.secretsFile}`
          : `Geheimnis-Datei vorhanden – unverändert: ${config.secretsFile}`,
      );
      return;
    }

    case 'migrate': {
      const config = configFromEnv();
      const secrets = loadSecrets(config.secretsFile);
      fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
      const db = openDatabase(config.databaseFile);
      try {
        const applied = migrate(db);
        await verifySecretsFingerprint(db, secrets);
        console.log(
          applied.length === 0
            ? 'Datenbank ist aktuell.'
            : `Migrationen ausgeführt: ${applied.join(', ')}`,
        );
      } finally {
        db.close();
      }
      return;
    }

    case 'check': {
      const config = configFromEnv();
      const secrets = loadSecrets(config.secretsFile);
      if (!fs.existsSync(config.databaseFile)) fail(`Datenbank fehlt: ${config.databaseFile}`);
      const db = openDatabase(config.databaseFile);
      try {
        const state = schemaState(db, loadMigrations());
        if (state.kind !== 'current') fail(`Schema-Stand: ${JSON.stringify(state)}`);
        await verifySecretsFingerprint(db, secrets);
        console.log(`OK – Version ${VERSION}, Schema ${state.version}`);
      } finally {
        db.close();
      }
      return;
    }

    case 'admin-init':
    case 'admin-reset': {
      // admin-init: only if no administrator exists yet (install); admin-reset: always (SPEC 13).
      const config = configFromEnv();
      const secrets = loadSecrets(config.secretsFile);
      const db = openDatabase(config.databaseFile);
      try {
        if (schemaState(db, loadMigrations()).kind !== 'current')
          fail('Bitte zuerst „posteulen-cli migrate“ ausführen.');
        if (command === 'admin-init' && adminExists(db)) {
          console.log('Adminzugang vorhanden – unverändert.');
          return;
        }
        const password = await setInitialAdminPassword(db, secrets.opaqueServerSetup);
        console.log(`ADMIN-ERSTPASSWORT: ${password}`);
        console.log('Es wird nur jetzt angezeigt. Beim ersten Login muss es geändert werden.');
      } finally {
        db.close();
      }
      return;
    }

    case 'bots-init':
    case 'bots-reset': {
      // v0.8: own password of the bots control centre – created once (install or the first update
      // with the control centre), never again on later updates; bots-reset always (SPEC 10.12).
      const config = configFromEnv();
      const secrets = loadSecrets(config.secretsFile);
      const db = openDatabase(config.databaseFile);
      try {
        if (schemaState(db, loadMigrations()).kind !== 'current')
          fail('Bitte zuerst „posteulen-cli migrate“ ausführen.');
        if (command === 'bots-init' && adminExists(db, 'bots_admin')) {
          console.log('Zugang zum Bots-Kontrollzentrum vorhanden – unverändert.');
          return;
        }
        const password = await setInitialAdminPassword(db, secrets.opaqueServerSetup, 'bots_admin');
        console.log(`BOTS-ERSTPASSWORT: ${password}`);
        console.log('Es wird nur jetzt angezeigt. Beim ersten Login muss es geändert werden.');
      } finally {
        db.close();
      }
      return;
    }

    case 'bots-export':
    case 'bots-import': {
      // v0.8: bot definitions and events with pictures as a ZIP file (SPEC Anhang S) – daily into
      // the backup folder; the import restores them on a new server (adds, never overwrites).
      const { values } = parseArgs({
        args: rest,
        options: {
          out: { type: 'string' },
          file: { type: 'string' },
          apply: { type: 'boolean', default: false },
        },
      });
      const config = configFromEnv();
      const secrets = loadSecrets(config.secretsFile);
      const db = openDatabase(config.databaseFile);
      // A light context (no workers, no routes): the service may run at the same time.
      const app = { ctx: await createContext(config, db, secrets) };
      try {
        if (schemaState(db, loadMigrations()).kind !== 'current')
          fail('Bitte zuerst „posteulen-cli migrate“ ausführen.');
        if (command === 'bots-export') {
          if (!values.out) fail('--out fehlt');
          const out = path.resolve(values.out);
          if (fs.existsSync(out)) fail(`Zieldatei existiert bereits: ${out}`);
          fs.writeFileSync(out, exportBots(app.ctx), { mode: 0o600 });
          console.log(out);
        } else {
          if (!values.file) fail('--file fehlt');
          const zip = fs.readFileSync(path.resolve(values.file));
          const plan = values.apply ? applyImport(app.ctx, zip) : planImport(app.ctx, zip);
          for (const bot of plan.bots) {
            const events = bot.events.reduce<Record<string, number>>((count, event) => {
              count[event.action] = (count[event.action] ?? 0) + 1;
              return count;
            }, {});
            console.log(
              `${bot.name}: ${{ new: 'neu (Entwurf)', merge: 'ergänzt', conflict: `übersprungen (${bot.conflict ?? 'Konflikt'})` }[bot.action]} – Events: ${events['planned'] ?? 0} geplant, ${events['past'] ?? 0} ins Archiv, ${events['skip'] ?? 0} übersprungen`,
            );
          }
          console.log(
            values.apply
              ? 'Import abgeschlossen.'
              : 'Nur Vorschau – nichts geändert. Zum Importieren „--apply“ anhängen.',
          );
        }
      } finally {
        db.close();
      }
      return;
    }

    case 'caddyfile': {
      const { values } = parseArgs({
        args: rest,
        options: {
          domain: { type: 'string' },
          'test-mode': { type: 'boolean', default: false },
          'web-root': { type: 'string', default: '/opt/posteulen/current/web/dist' },
          'admin-root': { type: 'string', default: '/opt/posteulen/current/admin/dist' },
          'bots-root': { type: 'string', default: '/opt/posteulen/current/bots/dist' },
          'local-dir': { type: 'string', default: '/etc/posteulen/local' },
        },
      });
      if (!values.domain) fail('--domain fehlt');
      process.stdout.write(
        generateCaddyfile({
          domain: values.domain,
          testMode: values['test-mode'],
          webRoot: values['web-root'],
          adminRoot: values['admin-root'],
          botsRoot: values['bots-root'],
          localDir: values['local-dir'],
          userPort: 3001,
          adminPort: 3002,
          botsPort: 3003,
        }),
      );
      return;
    }

    case 'backup': {
      const { values } = parseArgs({ args: rest, options: { out: { type: 'string' } } });
      if (!values.out) fail('--out fehlt');
      const out = path.resolve(values.out);
      if (fs.existsSync(out)) fail(`Zieldatei existiert bereits: ${out}`);
      const config = configFromEnv();
      const db = openDatabase(config.databaseFile);
      try {
        db.raw.prepare('VACUUM INTO ?').run(out);
      } finally {
        db.close();
      }
      fs.chmodSync(out, 0o600);
      console.log(out);
      return;
    }

    default:
      console.error(
        'Aufruf: posteulen-cli <setup|migrate|check|admin-init|admin-reset|bots-init|bots-reset|bots-export|bots-import|caddyfile|backup|version|schema-version>',
      );
      process.exit(2);
  }
}

main(process.argv.slice(2)).catch((error: unknown) =>
  fail(error instanceof Error ? error.message : String(error)),
);
