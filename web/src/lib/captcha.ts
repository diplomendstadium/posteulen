/** Solves the self-hosted ALTCHA proof of work in the browser (SPEC 5.10). */
import { solveChallenge, type Challenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/web/sha';
import { api } from './api.ts';

export async function solveCaptcha(path = '/api/altcha/challenge'): Promise<unknown> {
  const challenge = await api<Challenge>('GET', path);
  const solution = await solveChallenge({ challenge, deriveKey, timeout: 60_000 });
  if (!solution) throw new Error('captcha');
  return { challenge, solution: { counter: solution.counter, derivedKey: solution.derivedKey } };
}
