/**
 * `npm run dev`: backend with --watch plus Vite dev servers for web (5173) and admin (5174).
 * Dev servers inject styles at runtime, so the strict CSP is only active in `npm start`.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve('data');
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

const env = {
  ...process.env,
  POSTEULEN_ENV: 'development',
  POSTEULEN_DATA_DIR: dataDir,
  POSTEULEN_SECRETS_FILE: path.join(dataDir, 'secrets.json'),
  POSTEULEN_USER_ORIGIN: 'http://localhost:5173',
  POSTEULEN_ADMIN_ORIGIN: 'http://localhost:5174',
  POSTEULEN_LOG_LEVEL: 'info',
};

const children: ChildProcess[] = [];
function start(name: string, command: string, args: string[]): void {
  const child = spawn(command, args, { stdio: 'inherit', env });
  child.on('exit', (code) => {
    console.warn(`${name} beendet (${code ?? 'Signal'}).`);
    for (const other of children) other.kill('SIGTERM');
    process.exit(code ?? 0);
  });
  children.push(child);
}

const setup = spawn('node', ['backend/src/cli.ts', 'setup'], { stdio: 'inherit', env });
setup.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  start('Backend', 'node', ['--watch', 'backend/src/main.ts']);
  start('Web', 'npx', ['vite', '--config', 'web/vite.config.ts', 'web']);
  start('Admin', 'npx', ['vite', '--config', 'admin/vite.config.ts', 'admin']);
});

process.on('SIGINT', () => {
  for (const child of children) child.kill('SIGTERM');
});
