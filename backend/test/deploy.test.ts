/**
 * Version choice of install.sh and posteulen-update (SPEC 16.3): the newest tag by Semantic
 * Versioning, where a pre-release (v0.1.0-stufe.6) is older than the release (v0.1.0).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LIB = path.resolve(import.meta.dirname, '../../deploy/lib.sh');

function newestTag(tags: readonly string[]): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'posteulen-tags-'));
  try {
    const git = (...args: string[]) =>
      spawnSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@invalid', ...args], {
        encoding: 'utf8',
      });
    git('init', '-q');
    git('commit', '-q', '--allow-empty', '-m', 'x');
    for (const tag of tags) git('tag', tag);
    const result = spawnSync('bash', ['-c', 'source "$1"; newest_tag "$2"', '_', LIB, repo], {
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

describe('newest_tag (deploy/lib.sh)', () => {
  it('die fertige Version ist neuer als ihre Stufen', () => {
    expect(newestTag(['v0.1.0-stufe.5', 'v0.1.0-stufe.6', 'v0.1.0'])).toBe('v0.1.0');
  });

  it('Stufen werden numerisch verglichen', () => {
    expect(newestTag(['v0.1.0-stufe.6', 'v0.1.0-stufe.10', 'v0.1.0-stufe.9'])).toBe(
      'v0.1.0-stufe.10',
    );
  });

  it('eine spätere Vorabversion schlägt eine frühere fertige Version', () => {
    expect(newestTag(['v0.1.0', 'v0.2.0-stufe.1', 'v0.1.10'])).toBe('v0.2.0-stufe.1');
    expect(newestTag(['v0.2.0-stufe.1', 'v0.2.0', 'v0.1.0'])).toBe('v0.2.0');
  });

  it('ohne Tags leer', () => {
    expect(newestTag([])).toBe('');
  });
});
