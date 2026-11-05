import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createSecretsFileIfMissing,
  loadSecrets,
  secretsFingerprint,
  SecretsError,
} from '../src/secrets.ts';
import { tempDir } from './helpers.ts';

describe('secrets file (SPEC 4.4)', () => {
  it('is created once with mode 0640 and never overwritten', async () => {
    const file = path.join(tempDir(), 'etc', 'secrets.json');
    expect(await createSecretsFileIfMissing(file)).toBe(true);
    expect(fs.statSync(file).mode & 0o777).toBe(0o640);
    const before = fs.readFileSync(file, 'utf8');
    expect(await createSecretsFileIfMissing(file)).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
    expect(fs.readdirSync(path.dirname(file))).toEqual(['secrets.json']);
  });

  it('loads valid secrets with a 32-byte root secret', async () => {
    const file = path.join(tempDir(), 'secrets.json');
    await createSecretsFileIfMissing(file);
    const secrets = loadSecrets(file);
    expect(secrets.rootSecret).toHaveLength(32);
    expect(secrets.opaqueServerSetup.length).toBeGreaterThan(100);
    expect(await secretsFingerprint(secrets)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects missing, world-readable, malformed or incomplete files', async () => {
    const dir = tempDir();
    expect(() => loadSecrets(path.join(dir, 'missing.json'))).toThrow(SecretsError);

    const file = path.join(dir, 'secrets.json');
    await createSecretsFileIfMissing(file);
    fs.chmodSync(file, 0o644);
    expect(() => loadSecrets(file)).toThrow(/für alle lesbar/);
    fs.chmodSync(file, 0o640);

    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '{', { mode: 0o600 });
    expect(() => loadSecrets(bad)).toThrow(/kein gültiges JSON/);
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    fs.writeFileSync(bad, JSON.stringify({ ...parsed, extra: 1 }), { mode: 0o600 });
    expect(() => loadSecrets(bad)).toThrow(/ungültiges Format/);
  });

  it('gives different fingerprints for different secrets', async () => {
    const a = path.join(tempDir(), 'a.json');
    const b = path.join(tempDir(), 'b.json');
    await createSecretsFileIfMissing(a);
    await createSecretsFileIfMissing(b);
    expect(await secretsFingerprint(loadSecrets(a))).not.toBe(
      await secretsFingerprint(loadSecrets(b)),
    );
  });
});
