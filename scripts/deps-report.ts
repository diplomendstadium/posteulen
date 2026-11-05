/**
 * `npm run deps:report`: lists every installed package (direct and indirect) with version and
 * licence from the lockfile, for DEPENDENCIES.md (SPEC 2.4).
 */
import fs from 'node:fs';
import path from 'node:path';

interface LockPackage {
  version?: string;
  license?: string;
  dev?: boolean;
  link?: boolean;
}

const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8')) as {
  packages: Record<string, LockPackage>;
};
const rows = Object.entries(lock.packages)
  .filter(([key, value]) => key.includes('node_modules/') && !value.link)
  .map(([key, value]) => {
    const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    let license = value.license;
    if (!license) {
      const manifest = path.join(key, 'package.json');
      if (fs.existsSync(manifest)) {
        license = (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { license?: string }).license;
      }
    }
    return {
      name,
      version: value.version ?? '?',
      license: license ?? '(siehe LICENSE)',
      dev: value.dev === true,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const unique = new Map(rows.map((row) => [`${row.name}@${row.version}`, row]));
const byLicense = new Map<string, number>();
for (const row of unique.values())
  byLicense.set(row.license, (byLicense.get(row.license) ?? 0) + 1);

console.log(`| Paket | Version | Lizenz | nur Entwicklung |\n|---|---|---|---|`);
for (const row of unique.values()) {
  console.log(`| ${row.name} | ${row.version} | ${row.license} | ${row.dev ? 'ja' : 'nein'} |`);
}
console.log(`\nLizenzen: ${[...byLicense].map(([l, n]) => `${l} (${n})`).join(', ')}`);
