import path from 'node:path';

export type Environment = 'production' | 'development' | 'test';

export interface Config {
  readonly env: Environment;
  readonly dataDir: string;
  readonly databaseFile: string;
  readonly secretsFile: string;
  /** Exact origins each API accepts (SPEC 4.3). */
  readonly userOrigin: string;
  readonly adminOrigin: string;
  readonly host: '127.0.0.1';
  readonly userPort: number;
  readonly adminPort: number;
  readonly logLevel: string;
}

function readEnvironment(value: string | undefined): Environment {
  if (value === undefined || value === 'production') return 'production';
  if (value === 'development' || value === 'test') return value;
  throw new Error(`POSTEULEN_ENV ungültig: ${value}`);
}

function readPort(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error(`Port ungültig: ${value}`);
  return port;
}

function readDomain(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) {
    throw new Error(`POSTEULEN_DOMAIN ungültig: ${value}`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const environment = readEnvironment(env['POSTEULEN_ENV']);
  const dataDir = path.resolve(env['POSTEULEN_DATA_DIR'] ?? '/var/lib/posteulen');
  const domain = readDomain(env['POSTEULEN_DOMAIN']);
  const userOrigin = env['POSTEULEN_USER_ORIGIN'] ?? (domain ? `https://${domain}` : undefined);
  const adminOrigin =
    env['POSTEULEN_ADMIN_ORIGIN'] ?? (domain ? `https://admin.${domain}` : undefined);
  if (userOrigin === undefined || adminOrigin === undefined) {
    throw new Error('POSTEULEN_DOMAIN (oder beide Origins) muss gesetzt sein.');
  }
  return {
    env: environment,
    dataDir,
    databaseFile: path.join(dataDir, 'posteulen.sqlite'),
    secretsFile: path.resolve(env['POSTEULEN_SECRETS_FILE'] ?? '/etc/posteulen/secrets.json'),
    userOrigin: new URL(userOrigin).origin,
    adminOrigin: new URL(adminOrigin).origin,
    host: '127.0.0.1',
    userPort: readPort(env['POSTEULEN_USER_PORT'], 3001),
    adminPort: readPort(env['POSTEULEN_ADMIN_PORT'], 3002),
    logLevel: env['POSTEULEN_LOG_LEVEL'] ?? 'info',
  };
}
