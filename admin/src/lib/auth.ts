/** Admin login and password change with OPAQUE (SPEC 13); the password never leaves the browser. */
import { solveChallenge, type Challenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/web/sha';
import { api, ApiError } from './api.ts';

async function opaqueClient() {
  const client = await import('@posteulen/shared/crypto/opaque-client.ts');
  await client.ready();
  return client;
}

const paint = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

interface Start {
  status: 'ok' | 'captcha_required' | 'wait';
  attemptId?: string;
  loginResponse?: string;
  retryAfterSeconds?: number;
}

async function captcha(): Promise<unknown> {
  const challenge = await api<Challenge>('GET', '/api/altcha/challenge');
  const solution = await solveChallenge({ challenge, deriveKey, timeout: 60_000 });
  if (!solution) throw new ApiError(400, { code: 'captcha_invalid' });
  return { challenge, solution: { counter: solution.counter, derivedKey: solution.derivedKey } };
}

export async function login(password: string): Promise<'ok' | 'wrong' | { wait: number }> {
  const client = await opaqueClient();
  const start = client.startLogin(password);
  let first = await api<Start>('POST', '/api/login/start', { startLoginRequest: start.request });
  if (first.status === 'captcha_required') {
    first = await api<Start>('POST', '/api/login/start', {
      startLoginRequest: start.request,
      altcha: await captcha(),
    });
  }
  if (first.status === 'wait') return { wait: first.retryAfterSeconds ?? 60 };
  if (first.status !== 'ok' || !first.loginResponse) return 'wrong';
  await paint();
  const result = client.finishLogin(password, start.state, first.loginResponse);
  if (!result) return 'wrong';
  try {
    await api('POST', '/api/login/finish', {
      attemptId: first.attemptId,
      finishLoginRequest: result.finishRequest,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'login_failed') return 'wrong';
    throw error;
  }
  return 'ok';
}

export async function changePassword(
  current: string,
  next: string,
): Promise<'ok' | 'wrong' | { wait: number }> {
  const client = await opaqueClient();
  const start = client.startLogin(current);
  const first = await api<Start>('POST', '/api/reauth/start', { startLoginRequest: start.request });
  if (first.status === 'wait') return { wait: first.retryAfterSeconds ?? 60 };
  if (first.status !== 'ok' || !first.loginResponse) return 'wrong';
  await paint();
  const result = client.finishLogin(current, start.state, first.loginResponse);
  if (!result) return 'wrong';
  const { token } = await api<{ token: string }>('POST', '/api/reauth/finish', {
    attemptId: first.attemptId,
    finishLoginRequest: result.finishRequest,
  });
  const registration = client.startRegistration(next);
  const { registrationResponse } = await api<{ registrationResponse: string }>(
    'POST',
    '/api/password/start',
    {
      token,
      registrationRequest: registration.request,
    },
  );
  await paint();
  const finish = client.finishRegistration(next, registration.state, registrationResponse);
  await api('POST', '/api/password/finish', { token, registrationRecord: finish.record });
  return 'ok';
}
