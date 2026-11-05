/**
 * `npm start`: one command for a local, production-like start (Stufenbericht „Start“).
 * Installs dependencies if needed, builds web/ and admin/, then runs the preview server.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!fs.existsSync('node_modules')) run('npm', ['ci']);
run('npm', ['run', 'build']);
run('node', ['backend/src/dev/preview.ts']);
