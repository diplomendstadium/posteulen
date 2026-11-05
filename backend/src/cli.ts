#!/usr/bin/env node
/**
 * posteulen-cli – server administration commands (run as root or the service user).
 * Commands: setup, migrate, check, caddyfile, backup, version, schema-version.
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

    case 'caddyfile': {
      const { values } = parseArgs({
        args: rest,
        options: {
          domain: { type: 'string' },
          'test-mode': { type: 'boolean', default: false },
          'web-root': { type: 'string', default: '/opt/posteulen/current/web/dist' },
          'admin-root': { type: 'string', default: '/opt/posteulen/current/admin/dist' },
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
          localDir: values['local-dir'],
          userPort: 3001,
          adminPort: 3002,
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
        'Aufruf: posteulen-cli <setup|migrate|check|caddyfile|backup|version|schema-version>',
      );
      process.exit(2);
  }
}

main(process.argv.slice(2)).catch((error: unknown) =>
  fail(error instanceof Error ? error.message : String(error)),
);
