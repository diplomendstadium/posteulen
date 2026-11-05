/**
 * `npm test`: every check of the Definition of Done in one command (SPEC 17).
 * Steps: lint, typecheck, unit tests with coverage, npm audit, shellcheck, build, E2E.
 * `npm test -- --quick` skips build and E2E. The VM test runs separately (`npm run test:vm`).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const quick = process.argv.includes('--quick');
const results: { step: string; ok: boolean; detail?: string }[] = [];

function run(step: string, command: string, args: string[]): boolean {
  console.warn(`\n━━ ${step} ━━`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  const ok = result.status === 0;
  results.push({ step, ok });
  return ok;
}

function shellScripts(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return shellScripts(file);
    if (entry.name.endsWith('.sh')) return [file];
    const head = fs.readFileSync(file, 'utf8').slice(0, 64);
    return head.startsWith('#!/usr/bin/env bash') || head.startsWith('#!/bin/bash') ? [file] : [];
  });
}

/**
 * Audit rule D-26: runtime dependencies must have no findings at all; development
 * dependencies block from severity "high" upwards (lower ones are documented).
 */
function audit(): void {
  console.warn('\n━━ npm audit ━━');
  const runtime = spawnSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8' });
  const all = spawnSync('npm', ['audit', '--audit-level=high'], { encoding: 'utf8' });
  let runtimeCount: number;
  try {
    const parsed = JSON.parse(runtime.stdout) as {
      metadata?: { vulnerabilities?: Record<string, number> };
    };
    const counts = parsed.metadata?.vulnerabilities ?? {};
    runtimeCount = Object.entries(counts)
      .filter(([key]) => key !== 'total')
      .reduce((sum, [, value]) => sum + value, 0);
  } catch {
    runtimeCount = -1;
  }
  const ok = runtimeCount === 0 && all.status === 0;
  console.warn(
    `Laufzeit: ${runtimeCount === -1 ? 'Prüfung fehlgeschlagen' : `${runtimeCount} Funde`}; ` +
      `Entwicklung ab „hoch“: ${all.status === 0 ? 'keine' : 'Funde'}`,
  );
  results.push({ step: 'npm audit', ok });
}

run('Lint und Formatierung', 'npm', ['run', 'lint']);
run('Typprüfung', 'npm', ['run', 'typecheck']);
run('Unit-Tests mit Abdeckung', 'npx', ['vitest', 'run', '--coverage']);
audit();
const scripts = shellScripts('deploy');
if (spawnSync('shellcheck', ['--version']).status !== 0) {
  console.warn('\nshellcheck fehlt – bitte installieren (z. B. „sudo apt install shellcheck“).');
  results.push({ step: 'shellcheck', ok: false });
} else if (scripts.length > 0) {
  run('shellcheck', 'shellcheck', ['--severity=style', '--external-sources', ...scripts]);
}
if (!quick) {
  run('Build', 'npm', ['run', 'build']);
  run('Ende-zu-Ende (Playwright)', 'npx', ['playwright', 'test']);
}

console.warn('\n━━ Ergebnis ━━');
for (const { step, ok } of results) console.warn(`${ok ? '✔' : '✘'} ${step}`);
process.exit(results.every((result) => result.ok) ? 0 : 1);
