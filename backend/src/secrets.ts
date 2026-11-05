import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import * as opaque from '@serenity-kit/opaque';
import webpush from 'web-push';
import * as v from 'valibot';
import { hkdfSha256 } from '@posteulen/shared/crypto/hkdf.ts';
import { SERVER_CONTEXTS } from '@posteulen/shared/crypto/contexts.ts';

/** Contents of the secrets file (SPEC 4.4, ARCHITECTURE 2.5). Never stored in the database. */
export interface Secrets {
  readonly format: 1;
  readonly opaqueServerSetup: string;
  readonly vapid: { readonly publicKey: string; readonly privateKey: string };
  readonly rootSecret: Uint8Array;
}

const base64url = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]+$/));

const SecretsFileSchema = v.strictObject({
  format: v.literal(1),
  opaqueServerSetup: v.pipe(base64url, v.minLength(100), v.maxLength(400)),
  vapid: v.strictObject({
    publicKey: v.pipe(base64url, v.length(87)),
    privateKey: v.pipe(base64url, v.length(43)),
  }),
  rootSecret: v.pipe(base64url, v.length(43)),
});

export class SecretsError extends Error {}

export async function generateSecrets(): Promise<Secrets> {
  await opaque.ready;
  const vapid = webpush.generateVAPIDKeys();
  return {
    format: 1,
    opaqueServerSetup: opaque.server.createSetup(),
    vapid: { publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    rootSecret: new Uint8Array(crypto.randomBytes(32)),
  };
}

function serialize(secrets: Secrets): string {
  return `${JSON.stringify(
    {
      format: secrets.format,
      opaqueServerSetup: secrets.opaqueServerSetup,
      vapid: secrets.vapid,
      rootSecret: Buffer.from(secrets.rootSecret).toString('base64url'),
    },
    null,
    2,
  )}\n`;
}

/**
 * Creates the secrets file exactly once. An existing file is never touched (SPEC 4.4).
 * Written to a temporary file and hard-linked into place, so a crash never leaves a partial
 * file and a concurrent run cannot overwrite (link fails with EEXIST).
 * @returns true if a new file was created, false if one already existed.
 */
export async function createSecretsFileIfMissing(file: string): Promise<boolean> {
  if (fs.existsSync(file)) return false;
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
  const secrets = await generateSecrets();
  const temp = path.join(dir, `.secrets-${crypto.randomBytes(8).toString('hex')}.tmp`);
  const fd = fs.openSync(temp, 'wx', 0o640);
  try {
    fs.writeSync(fd, serialize(secrets));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.linkSync(temp, file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  } finally {
    fs.unlinkSync(temp);
  }
}

export function loadSecrets(file: string): Secrets {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    throw new SecretsError(
      `Geheimnis-Datei fehlt: ${file}. Erzeugen mit „posteulen-cli setup“ – oder die gesicherte Datei zurückspielen.`,
    );
  }
  if ((stat.mode & 0o007) !== 0) {
    throw new SecretsError(
      `Geheimnis-Datei ${file} ist für alle lesbar. Bitte „chmod 0640“ setzen.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new SecretsError(`Geheimnis-Datei ${file} ist kein gültiges JSON.`);
  }
  const result = v.safeParse(SecretsFileSchema, parsed);
  if (!result.success) throw new SecretsError(`Geheimnis-Datei ${file} hat ein ungültiges Format.`);
  const rootSecret = new Uint8Array(Buffer.from(result.output.rootSecret, 'base64url'));
  if (rootSecret.length !== 32) throw new SecretsError('Wurzelgeheimnis hat die falsche Länge.');
  return { ...result.output, rootSecret };
}

/** Derives a purpose-bound server key from the root secret (SPEC 4.4). */
export function deriveServerKey(
  secrets: Secrets,
  context: (typeof SERVER_CONTEXTS)[keyof typeof SERVER_CONTEXTS],
): Promise<Uint8Array> {
  return hkdfSha256(secrets.rootSecret, context);
}

/**
 * Fingerprint stored in the database so that restore and update notice when the secrets file
 * does not belong to the database (ARCHITECTURE 10.3). Reveals nothing about the secrets.
 */
export async function secretsFingerprint(secrets: Secrets): Promise<string> {
  const key = await deriveServerKey(secrets, SERVER_CONTEXTS.BACKUP_CHECK);
  return crypto.createHmac('sha256', key).update('posteulen-secrets-fingerprint').digest('hex');
}
