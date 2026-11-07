import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp, StartupError } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { openDatabase } from '../src/db/database.ts';
import { createSecretsFileIfMissing } from '../src/secrets.ts';
import { generateCaddyfile } from '../src/ops/caddyfile.ts';
import { CSP_APP } from '@posteulen/shared/security/headers.ts';
import { tempDir } from './helpers.ts';

async function setup(env: 'production' | 'test' = 'test') {
  const dir = tempDir();
  const secretsFile = path.join(dir, 'secrets.json');
  await createSecretsFileIfMissing(secretsFile);
  const config = loadConfig({
    POSTEULEN_ENV: env,
    POSTEULEN_DATA_DIR: path.join(dir, 'data'),
    POSTEULEN_SECRETS_FILE: secretsFile,
    POSTEULEN_DOMAIN: 'posteulen.test',
  });
  return { dir, secretsFile, config };
}

describe('startup checks (SPEC 16.3, SPEC Anhang L.7)', () => {
  it('refuses to start in production with pending migrations', async () => {
    const { config } = await setup('production');
    await expect(createApp(config)).rejects.toThrow(/posteulen-cli migrate/);
  });

  it('refuses a database with a newer schema', async () => {
    const { config } = await setup();
    fs.mkdirSync(config.dataDir, { recursive: true });
    const db = openDatabase(config.databaseFile);
    db.exec('PRAGMA user_version = 999');
    db.close();
    await expect(createApp(config)).rejects.toThrow(StartupError);
  });

  it('notices a secrets file that does not belong to the database', async () => {
    const { config, secretsFile } = await setup();
    const app = await createApp(config);
    await app.close();
    fs.unlinkSync(secretsFile);
    await createSecretsFileIfMissing(secretsFile);
    await expect(createApp(config)).rejects.toThrow(/passt nicht zu dieser Datenbank/);
  });
});

describe('config', () => {
  it('derives both origins from the domain', () => {
    const config = loadConfig({ POSTEULEN_DOMAIN: 'posteulen.de' });
    expect(config.userOrigin).toBe('https://posteulen.de');
    expect(config.adminOrigin).toBe('https://admin.posteulen.de');
    expect(config.host).toBe('127.0.0.1');
    expect(config.env).toBe('production');
  });

  it('rejects invalid values', () => {
    expect(() => loadConfig({})).toThrow(/POSTEULEN_DOMAIN/);
    expect(() => loadConfig({ POSTEULEN_DOMAIN: 'bad domain' })).toThrow();
    expect(() => loadConfig({ POSTEULEN_DOMAIN: 'a.de', POSTEULEN_ENV: 'x' })).toThrow();
    expect(() => loadConfig({ POSTEULEN_DOMAIN: 'a.de', POSTEULEN_USER_PORT: '0' })).toThrow();
  });
});

describe('Caddyfile (SPEC 2.2, 16.2)', () => {
  const options = {
    domain: 'posteulen.de',
    testMode: false,
    webRoot: '/opt/posteulen/current/web/dist',
    adminRoot: '/opt/posteulen/current/admin/dist',
    localDir: '/etc/posteulen/local',
    userPort: 3001,
    adminPort: 3002,
  };

  it('serves both hosts with security headers and without access log or IPs', () => {
    const caddyfile = generateCaddyfile(options);
    expect(caddyfile).toContain('posteulen.de {');
    expect(caddyfile).toContain('admin.posteulen.de {');
    expect(caddyfile).toContain('reverse_proxy 127.0.0.1:3001');
    expect(caddyfile).toContain('reverse_proxy 127.0.0.1:3002');
    expect(caddyfile).toContain(CSP_APP);
    expect(caddyfile).toContain('Strict-Transport-Security');
    expect(caddyfile).toContain('request>remote_ip delete');
    expect(caddyfile).toContain('request>client_ip delete');
    expect(caddyfile).toContain('exclude http.log.access http.stdlib');
    expect(caddyfile).not.toMatch(/^\s*log\s*$/m);
    expect(caddyfile).toContain('import /etc/posteulen/local/admin-*.caddy');
    expect(caddyfile).not.toContain('tls internal');
  });

  it('uses the internal CA in test mode', () => {
    expect(generateCaddyfile({ ...options, testMode: true })).toContain('tls internal');
  });

  it('rejects injection through domain or paths', () => {
    expect(() => generateCaddyfile({ ...options, domain: 'a.de {\n}' })).toThrow();
    expect(() => generateCaddyfile({ ...options, webRoot: '/x y' })).toThrow();
  });
});
