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

/** v1.4.3: asks for the code of the second factor (`wrong`: the last one did not fit). */
export type AskCode = (wrong: boolean) => Promise<string | null>;

export type Outcome = 'ok' | 'wrong' | 'code' | 'cancelled' | { wait: number };

export async function login(
  password: string,
  askCode: AskCode = async () => null,
): Promise<Outcome> {
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
  let answer: { twoFactor?: boolean; ticket?: string };
  try {
    answer = await api<{ twoFactor?: boolean; ticket?: string }>('POST', '/api/login/finish', {
      attemptId: first.attemptId,
      finishLoginRequest: result.finishRequest,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'login_failed') return 'wrong';
    throw error;
  }
  // v1.4.3: with a second factor the server waits for a code (SPEC 5.11).
  let wrong = false;
  while (answer.twoFactor === true && answer.ticket) {
    const code = await askCode(wrong);
    if (code === null) return 'cancelled';
    try {
      await api('POST', '/api/login/two-factor', { ticket: answer.ticket, code });
      return 'ok';
    } catch (error) {
      if (error instanceof ApiError && error.code === 'two_factor_wrong') {
        wrong = true;
        continue;
      }
      if (error instanceof ApiError && error.code === 'login_failed') return 'wrong';
      throw error;
    }
  }
  return 'ok';
}

/** Fresh login before the password change or switching the second factor (v1.4.3 with code). */
async function reauth(
  password: string,
  purpose: 'password' | 'two_factor',
  code?: string,
): Promise<{ token: string } | 'wrong' | 'code' | { wait: number }> {
  const client = await opaqueClient();
  const start = client.startLogin(password);
  const first = await api<Start>('POST', '/api/reauth/start', {
    startLoginRequest: start.request,
    purpose,
  });
  if (first.status === 'wait') return { wait: first.retryAfterSeconds ?? 60 };
  if (first.status !== 'ok' || !first.loginResponse) return 'wrong';
  await paint();
  const result = client.finishLogin(password, start.state, first.loginResponse);
  if (!result) return 'wrong';
  try {
    return await api<{ token: string }>('POST', '/api/reauth/finish', {
      attemptId: first.attemptId,
      finishLoginRequest: result.finishRequest,
      ...(code !== undefined && code.trim() !== '' ? { code: code.trim() } : {}),
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'two_factor_wrong') return 'code';
    if (error instanceof ApiError && error.code === 'login_failed') return 'wrong';
    throw error;
  }
}

export interface TwoFactorState {
  readonly active: boolean;
  readonly backupLeft: number;
}

/** v1.4.3: whether the second factor of this panel is on (SPEC 5.11). */
export async function twoFactorState(): Promise<TwoFactorState> {
  const me = await api<{ twoFactor?: TwoFactorState }>('GET', '/api/me');
  return me.twoFactor ?? { active: false, backupLeft: 0 };
}

export async function startTwoFactor(
  password: string,
): Promise<{ secret: string; uri: string } | 'wrong' | 'code' | { wait: number }> {
  const checked = await reauth(password, 'two_factor');
  if (typeof checked === 'string' || 'wait' in checked) return checked;
  return api<{ secret: string; uri: string }>('POST', '/api/two-factor/setup', {
    token: checked.token,
  });
}

export async function enableTwoFactor(code: string): Promise<string[]> {
  const result = await api<{ backupCodes: string[] }>('POST', '/api/two-factor/enable', {
    code: code.trim(),
  });
  return result.backupCodes;
}

export async function disableTwoFactor(
  password: string,
  code: string,
): Promise<'ok' | 'wrong' | 'code' | { wait: number }> {
  const checked = await reauth(password, 'two_factor', code);
  if (typeof checked === 'string' || 'wait' in checked) return checked;
  await api('POST', '/api/two-factor/disable', { token: checked.token });
  return 'ok';
}

export async function changePassword(
  current: string,
  next: string,
  code?: string,
): Promise<'ok' | 'wrong' | 'code' | { wait: number }> {
  const client = await opaqueClient();
  const checked = await reauth(current, 'password', code);
  if (typeof checked === 'string' || 'wait' in checked) return checked;
  const { token } = checked;
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
