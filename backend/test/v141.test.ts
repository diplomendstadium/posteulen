/**
 * Version 1.4.1 (server scripts, SPEC 16.3): releases without image sources, only the active and
 * the previous release, building in staging, a temporary repository with just the one version
 * that is needed (shallow, still signature-checked) and an npm download cache of its own.
 *
 * The functions of deploy/lib.sh work on fixed paths below /opt/posteulen. The tests declare
 * PE_OPT and PE_NPM_CACHE as read-only before loading the library, so every path points into a
 * temporary directory instead (the library's own declaration of both then fails harmlessly).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');
const LIB = path.join(ROOT, 'deploy/lib.sh');

let base: string;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'posteulen-v141-'));
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

/** Runs a snippet with deploy/lib.sh loaded and all paths inside the temporary directory. */
function lib(
  script: string,
  ...args: string[]
): { status: number; stdout: string; stderr: string } {
  const opt = path.join(base, 'opt');
  fs.mkdirSync(opt, { recursive: true });
  const result = spawnSync(
    'bash',
    [
      '-c',
      `readonly PE_OPT="$1" PE_NPM_CACHE="$2"; source "$3" 2>/dev/null; shift 3; ${script}`,
      '_',
      opt,
      path.join(base, 'npm-cache'),
      LIB,
      ...args,
    ],
    { encoding: 'utf8' },
  );
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

function touch(file: string, content = 'x'): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** A release directory; `built` adds the three dist directories. */
function release(name: string, built: boolean): string {
  const dir = path.join(base, 'opt', 'releases', name);
  touch(path.join(dir, 'images', 'Schleiereule.png'));
  touch(path.join(dir, 'web', 'src', 'generated', 'owl-images', 'schleiereule-480.webp'));
  touch(path.join(dir, 'backend', 'src', 'cli.ts'));
  touch(path.join(dir, 'backend', 'migrations', '0001_start.sql'));
  touch(path.join(dir, 'shared', 'src', 'version.ts'), "export const VERSION = '1.4.1';\n");
  touch(path.join(dir, 'node_modules', 'fastify', 'package.json'));
  if (built) {
    for (const ui of ['web', 'admin', 'bots']) touch(path.join(dir, ui, 'dist', 'index.html'));
  }
  return dir;
}

const exists = (...parts: string[]): boolean => fs.existsSync(path.join(...parts));

describe('releases without what only the build needed (v1.4.1)', () => {
  it('trim_release removes image sources and intermediate images, keeps what runs', () => {
    const dir = release('v1.4.1-abc', true);
    expect(lib('trim_release "$1"', dir).status).toBe(0);
    expect(exists(dir, 'images')).toBe(false);
    expect(exists(dir, 'web/src/generated/owl-images')).toBe(false);
    for (const kept of [
      'backend/src/cli.ts',
      'backend/migrations/0001_start.sql',
      'shared/src/version.ts',
      'node_modules/fastify/package.json',
      'web/dist/index.html',
      'admin/dist/index.html',
      'bots/dist/index.html',
    ]) {
      expect(exists(dir, kept), kept).toBe(true);
    }
  });

  it('trim_release leaves a release that is not built yet alone (it still needs the sources)', () => {
    const dir = release('v1.4.1-abc', false);
    expect(lib('trim_release "$1"', dir).status).toBe(0);
    expect(exists(dir, 'images/Schleiereule.png')).toBe(true);
  });

  it('prune_releases keeps only the active and the previous release (and named ones)', () => {
    const old = release('v1.3.2-aaa', true);
    const previous = release('v1.4.0-bbb', true);
    const active = release('v1.4.1-ccc', true);
    const building = release('v1.4.2-ddd', false);
    const state = path.join(base, 'opt', 'state');
    touch(path.join(state, 'previous-release'), `${previous}\n`);
    fs.symlinkSync(active, path.join(base, 'opt', 'current'));
    expect(lib('prune_releases "$1"', building).status).toBe(0);
    expect(fs.existsSync(old)).toBe(false);
    expect(fs.existsSync(previous)).toBe(true);
    expect(fs.existsSync(active)).toBe(true);
    // Kept releases lose their image sources, the one being built keeps them.
    expect(exists(previous, 'images')).toBe(false);
    expect(exists(active, 'images')).toBe(false);
    expect(exists(building, 'images/Schleiereule.png')).toBe(true);
    // Without the protection the one being built goes, too.
    expect(lib('prune_releases').status).toBe(0);
    expect(fs.existsSync(building)).toBe(false);
    expect(fs.existsSync(previous) && fs.existsSync(active)).toBe(true);
  });

  it('clean_staging removes everything left over except the running update', () => {
    const staging = path.join(base, 'opt', 'staging');
    touch(path.join(staging, 'v1.4.0-abc', 'images', 'x.png'));
    touch(path.join(staging, 'repo.Ab12cd', 'HEAD'));
    touch(path.join(staging, 'v1.4.1-def', 'deploy', 'update.sh'));
    expect(lib('clean_staging "$1"', path.join(staging, 'v1.4.1-def')).status).toBe(0);
    expect(fs.readdirSync(staging)).toEqual(['v1.4.1-def']);
    expect(lib('clean_staging').status).toBe(0);
    expect(fs.readdirSync(staging)).toEqual([]);
  });

  it('remove_legacy_repo removes the permanent update repository of versions up to 1.4.0', () => {
    touch(path.join(base, 'opt', 'repo', 'objects', 'pack', 'pack-1.pack'));
    expect(lib('remove_legacy_repo >/dev/null').status).toBe(0);
    expect(exists(base, 'opt', 'repo')).toBe(false);
    // A second time (or on a fresh installation) there is nothing to do.
    expect(lib('remove_legacy_repo').status).toBe(0);
  });
});

describe('one version, shallow, in a temporary repository (v1.4.1)', () => {
  function git(cwd: string, ...args: string[]): string {
    const result = spawnSync(
      'git',
      ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@invalid', ...args],
      { encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  }

  /** A source repository with history, three signed tags and a big file in old commits. */
  function source(): { url: string; signers: string; tags: string[] } {
    const src = path.join(base, 'src');
    fs.mkdirSync(src);
    git(src, 'init', '-q');
    const key = path.join(base, 'key');
    spawnSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', key, '-C', 't']);
    const tags = ['v1.4.0', 'v1.4.1-stufe.1', 'v1.4.1'];
    for (const [i, tag] of tags.entries()) {
      // Every commit changes the big file – old versions must never be downloaded.
      touch(path.join(src, 'images', 'big.bin'), `${i}`.repeat(200_000));
      touch(
        path.join(src, 'shared', 'src', 'version.ts'),
        `export const VERSION = '${tag.slice(1)}';\n`,
      );
      touch(path.join(src, 'CHANGELOG.md'), `# ${tag}\n`);
      git(src, 'add', '-A');
      git(src, 'commit', '-q', '-m', tag);
      git(src, '-c', 'gpg.format=ssh', '-c', `user.signingkey=${key}`, 'tag', '-s', '-m', tag, tag);
    }
    git(src, 'config', 'uploadpack.allowFilter', 'true');
    const signers = path.join(base, 'allowed_signers');
    fs.writeFileSync(
      signers,
      `t namespaces="git" ${fs.readFileSync(`${key}.pub`, 'utf8').split(' ').slice(0, 2).join(' ')}\n`,
    );
    return { url: `file://${src}`, signers, tags };
  }

  it('finds the newest tag without downloading, fetches only that version and checks it', () => {
    const { url, signers } = source();
    const result = lib(
      `repo=$(temp_repo "$1")
       [[ $repo == "$PE_STAGING"/repo.* ]] || exit 11
       tag=$(newest_remote_tag "$repo")
       echo "tag=$tag"
       echo "remote=$(remote_commit "$repo" "$tag")"
       fetch_release "$repo" "$tag"
       echo "commit=$(release_commit "$repo" "$tag")"
       verify_release_tag "$repo" "$tag" "$2" >/dev/null && echo "signature=ok"
       echo "commits=$(git -C "$repo" rev-list --count --all)"
       echo "name=$(release_name "$tag" "$(release_commit "$repo" "$tag")")"
       git -C "$repo" archive "$(release_commit "$repo" "$tag")" | tar -t | sort | tr '\\n' ' '`,
      url,
      signers,
    );
    expect(result.status, result.stderr).toBe(0);
    const out = result.stdout;
    // A finished release is newer than its pre-releases.
    expect(out).toContain('tag=v1.4.1\n');
    const commit = /commit=([0-9a-f]{12})/.exec(out)![1]!;
    expect(out).toContain(`remote=${commit}`);
    expect(out).toContain('signature=ok');
    // Shallow: only the one commit, no history.
    expect(out).toContain('commits=1\n');
    expect(out).toContain(`name=v1.4.1-${commit}`);
    expect(out).toContain('images/big.bin');
  });

  it('the light fetch has no file contents and loads a single file only when asked', () => {
    const { url } = source();
    const result = lib(
      `repo=$(temp_repo "$1")
       fetch_release "$repo" v1.4.0 light
       commit=$(release_commit "$repo" v1.4.0)
       git -C "$repo" count-objects -v | sed -n 's/^size-pack: /pack=/p'
       git -C "$repo" show "$commit:CHANGELOG.md"`,
      url,
    );
    expect(result.status, result.stderr).toBe(0);
    // The big file (200 KB) is not part of the light fetch.
    expect(Number(/pack=(\d+)/.exec(result.stdout)![1])).toBeLessThan(50);
    expect(result.stdout).toContain('# v1.4.0');
  });

  it('an unknown version is refused, a full commit ID works', () => {
    const { url } = source();
    const result = lib(
      `repo=$(temp_repo "$1")
       if fetch_release "$repo" v9.9.9; then echo unknown=fetched; else echo unknown=refused; fi
       sha=$(git ls-remote "$1" 'refs/tags/v1.4.0^{}' | cut -f1)
       fetch_release "$repo" "$sha" && echo "sha=$(release_commit "$repo" "$sha") $(remote_commit "$repo" "$sha")"`,
      url,
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('unknown=refused');
    expect(result.stdout).toMatch(/sha=([0-9a-f]{12}) \1/);
  });

  it('repo_url turns a local path into a file:// address', () => {
    const conf = path.join(base, 'posteulen.conf');
    fs.writeFileSync(conf, 'POSTEULEN_REPO=/srv/posteulen.git\n');
    const result = spawnSync(
      'bash',
      ['-c', 'readonly PE_CONF="$1"; source "$2" 2>/dev/null; repo_url', '_', conf, LIB],
      { encoding: 'utf8' },
    );
    expect(result.stdout).toBe('file:///srv/posteulen.git');
  });
});

describe('order of the steps in the scripts (v1.4.1)', () => {
  const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
  const code = (file: string): string =>
    read(file)
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');

  it('no script keeps a permanent repository any more', () => {
    for (const file of ['deploy/install.sh', 'deploy/posteulen-update', 'deploy/update.sh']) {
      expect(code(file), file).not.toMatch(/git clone|PE_REPO\b|fetch --tags/);
    }
    expect(code('deploy/update.sh')).toMatch(/remove_legacy_repo/);
    expect(code('deploy/install.sh')).toMatch(/remove_legacy_repo/);
  });

  it('posteulen-update checks everything before it loads and unpacks the full version', () => {
    const script = code('deploy/posteulen-update');
    const light = script.indexOf('fetch_release "$meta" "$target" light');
    const verify = script.indexOf('verify_release_tag "$meta"');
    const older = script.indexOf('version_older');
    const full = script.indexOf('fetch_release "$full" "$target"');
    const again = script.indexOf('verify_release_tag "$full"');
    const archive = script.indexOf('git -C "$full" archive');
    for (const step of [light, verify, older, full, again, archive])
      expect(step).toBeGreaterThan(0);
    expect(light).toBeLessThan(verify);
    expect(verify).toBeLessThan(older);
    expect(older).toBeLessThan(full);
    expect(full).toBeLessThan(again);
    expect(again).toBeLessThan(archive);
    // Unpacked into staging, cleaned up before anything else happens.
    expect(script).toMatch(/staging="\$PE_STAGING\//);
    expect(script.indexOf('clean_staging')).toBeLessThan(light);
    expect(script.indexOf('prune_releases')).toBeLessThan(light);
  });

  it('update.sh cleans up before the build and discards a failed release', () => {
    const script = code('deploy/update.sh');
    const prune = script.indexOf('prune_releases "$RELEASE"');
    const build = script.indexOf('build_release "$RELEASE"');
    const move = script.indexOf('mv -T "$RELEASE"');
    const backup = script.indexOf('backup.sh" --reason update');
    expect(prune).toBeGreaterThan(0);
    expect(prune).toBeLessThan(build);
    expect(build).toBeLessThan(move);
    expect(move).toBeLessThan(backup);
    expect(script).toMatch(/trap discard_failed EXIT/);
    // The cleanup after success keeps exactly the active and the previous release.
    expect(script.lastIndexOf('prune_releases')).toBeGreaterThan(
      script.indexOf('>"$PE_STATE/previous-release"'),
    );
  });

  it('the build uses its own npm cache and empties it every time', () => {
    const lib = code('deploy/lib.sh');
    expect(lib).toMatch(/npm_config_cache=\$PE_NPM_CACHE/);
    const body = lib.slice(lib.indexOf('build_release() {'));
    expect(body.match(/rm -rf "\$PE_NPM_CACHE"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(body).toMatch(/trim_release "\$dir"/);
    expect(lib).not.toMatch(/PE_RELEASES_KEPT/);
  });
});
