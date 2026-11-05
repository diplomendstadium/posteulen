/**
 * Account state and the client side of registration, login, logout and password change
 * (SPEC 5.2–5.6). Crypto libraries are loaded on demand (large WASM modules).
 */
import { api, ApiError, onUnauthorized } from './api.ts';
import { clearKeys, loadKeys, saveKeys, type LocalKeys } from './crypto/keystore.ts';
import { solveCaptcha } from './captcha.ts';

export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly gold: number;
  readonly home: { readonly lat: number; readonly lon: number };
  readonly createdOn: string;
  /** Year of the last name change (once per calendar year, SPEC 7.4). */
  readonly nameChangedYear: number | null;
  /** First day (UTC) on which the home may change again (SPEC 7.3). */
  readonly homeChangeFrom: string;
}

export const account = $state<{
  checked: boolean;
  profile: Profile | null;
  keys: LocalKeys | null;
  notice: string | null;
}>({
  checked: false,
  profile: null,
  keys: null,
  notice: null,
});

async function cryptoModules() {
  const [client, keys, encoding] = await Promise.all([
    import('@posteulen/shared/crypto/opaque-client.ts'),
    import('@posteulen/shared/crypto/keypackage.ts'),
    import('@posteulen/shared/crypto/encoding.ts'),
  ]);
  await client.ready();
  return { client, keys, encoding };
}

/** Lets the browser paint a "please wait" before the Argon2id work blocks it. */
const paint = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 30));

async function forget(): Promise<void> {
  account.profile = null;
  account.keys = null;
  await clearKeys().catch(() => undefined);
}

onUnauthorized(() => {
  void forget();
});

/** App start: is there a valid session and are the local keys there? (SPEC 5.5) */
export async function restore(): Promise<void> {
  try {
    const session = await api<{ state: 'none' | 'expired' | 'active'; profile?: Profile }>(
      'GET',
      '/api/session',
    );
    if (session.state !== 'active' || !session.profile) {
      await forget();
      return;
    }
    const profile = session.profile;
    const keys = await loadKeys();
    if (!keys || keys.userId !== profile.id) {
      // A session without local keys is useless: log out cleanly.
      await api('POST', '/api/logout', {}).catch(() => undefined);
      await forget();
    } else {
      account.profile = profile;
      account.keys = keys;
    }
  } catch (error) {
    if (!(error instanceof ApiError) || error.status === 401) await forget();
  } finally {
    account.checked = true;
  }
}

export type LoginOutcome = 'ok' | 'wrong' | { wait: number };

interface LoginStart {
  status: 'ok' | 'captcha_required' | 'wait';
  attemptId?: string;
  loginResponse?: string;
  retryAfterSeconds?: number;
}

export async function login(
  name: string,
  password: string,
  onStep: (step: string) => void = () => undefined,
): Promise<LoginOutcome> {
  const { client, keys, encoding } = await cryptoModules();
  const start = client.startLogin(password);
  let first = await api<LoginStart>('POST', '/api/login/start', {
    name,
    startLoginRequest: start.request,
  });
  if (first.status === 'captcha_required') {
    onStep('captcha');
    first = await api<LoginStart>('POST', '/api/login/start', {
      name,
      startLoginRequest: start.request,
      altcha: await solveCaptcha(),
    });
  }
  if (first.status === 'wait') return { wait: first.retryAfterSeconds ?? 60 };
  if (first.status !== 'ok' || !first.loginResponse) return 'wrong';
  onStep('password');
  await paint();
  const result = client.finishLogin(password, start.state, first.loginResponse);
  if (!result) return 'wrong';
  let finish;
  try {
    finish = await api<{
      userId: string;
      deletionCancelled: boolean;
      keyPackage: import('@posteulen/shared/crypto/keypackage.ts').KeyPackage;
      ed25519Public: string;
      x25519Public: string;
      profile: Profile;
    }>('POST', '/api/login/finish', {
      attemptId: first.attemptId,
      finishLoginRequest: result.finishRequest,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'login_failed') return 'wrong';
    throw error;
  }
  const unlocked = await keys.unlockAccount(finish.userId, finish.keyPackage, result.exportKey, {
    ed25519: encoding.fromBase64Url(finish.ed25519Public),
    x25519: encoding.fromBase64Url(finish.x25519Public),
  });
  await saveKeys(finish.userId, unlocked);
  unlocked.masterKey.fill(0);
  account.profile = finish.profile;
  account.keys = await loadKeys();
  account.notice = finish.deletionCancelled ? 'deletionCancelled' : null;
  return 'ok';
}

export interface Registration {
  readonly name: string;
  readonly password: string;
  readonly inviteCode?: string;
  readonly home: { lat: number; lon: number };
}

export async function register(
  input: Registration,
  onStep: (step: string) => void = () => undefined,
): Promise<void> {
  const { client, keys, encoding } = await cryptoModules();
  onStep('captcha');
  const altcha = await solveCaptcha();
  const start = client.startRegistration(input.password);
  const first = await api<{ reservationId: string; userId: string; registrationResponse: string }>(
    'POST',
    '/api/register/start',
    {
      name: input.name,
      altcha,
      registrationRequest: start.request,
      ...(input.inviteCode ? { inviteCode: input.inviteCode } : {}),
    },
  );
  onStep('keys');
  await paint();
  const finish = client.finishRegistration(input.password, start.state, first.registrationResponse);
  const created = await keys.createAccountKeys(first.userId, finish.exportKey);
  const done = await api<{ userId: string; profile: Profile }>('POST', '/api/register/finish', {
    reservationId: first.reservationId,
    registrationRecord: finish.record,
    ed25519Public: encoding.toBase64Url(created.account.identity.ed25519Public),
    x25519Public: encoding.toBase64Url(created.account.identity.x25519Public),
    keyPackage: created.keyPackage,
    home: input.home,
  });
  await saveKeys(done.userId, created.account);
  created.account.masterKey.fill(0);
  account.profile = done.profile;
  account.keys = await loadKeys();
}

export async function logout(): Promise<void> {
  await api('POST', '/api/logout', {}).catch(() => undefined);
  await forget();
}

type Reauth = {
  reauth: {
    token: string;
    keyPackage: import('@posteulen/shared/crypto/keypackage.ts').KeyPackage;
  };
  result: { exportKey: Uint8Array };
};

/** Fresh OPAQUE login before a critical action (SPEC 5.6, 7.5). */
async function reauthenticate(
  password: string,
  purpose: 'password' | 'delete',
  onChecking: () => void = () => undefined,
): Promise<Reauth | 'wrong' | { wait: number }> {
  const { client } = await cryptoModules();
  const start = client.startLogin(password);
  let first = await api<LoginStart>('POST', '/api/reauth/start', {
    purpose,
    startLoginRequest: start.request,
  });
  if (first.status === 'captcha_required') {
    first = await api<LoginStart>('POST', '/api/reauth/start', {
      purpose,
      startLoginRequest: start.request,
      altcha: await solveCaptcha(),
    });
  }
  if (first.status === 'wait') return { wait: first.retryAfterSeconds ?? 60 };
  if (first.status !== 'ok' || !first.loginResponse) return 'wrong';
  onChecking();
  await paint();
  const result = client.finishLogin(password, start.state, first.loginResponse);
  if (!result) return 'wrong';
  const reauth = await api<Reauth['reauth']>('POST', '/api/reauth/finish', {
    attemptId: first.attemptId,
    finishLoginRequest: result.finishRequest,
  });
  return { reauth, result };
}

/** Deletes the account after a fresh password check; logged out at once (SPEC 7.5). */
export async function deleteAccount(password: string): Promise<'ok' | 'wrong' | { wait: number }> {
  const checked = await reauthenticate(password, 'delete');
  if (checked === 'wrong' || 'wait' in checked) return checked;
  await api('POST', '/api/account/delete', { token: checked.reauth.token });
  await forget();
  return 'ok';
}

export async function changeName(name: string): Promise<void> {
  const { profile } = await api<{ profile: Profile }>('PATCH', '/api/account/name', { name });
  account.profile = profile;
}

export async function changeHome(home: { lat: number; lon: number }): Promise<void> {
  const { profile } = await api<{ profile: Profile }>('PATCH', '/api/account/home', { home });
  account.profile = profile;
}

/**
 * Password change (SPEC 5.6): fresh OPAQUE login with the old password, new registration,
 * the unchanged master key re-wrapped; record and package replaced in one request.
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
  onStep: (step: string) => void = () => undefined,
): Promise<'ok' | 'wrong' | { wait: number }> {
  const { client, keys } = await cryptoModules();
  const checked = await reauthenticate(oldPassword, 'password', () => onStep('old'));
  if (checked === 'wrong' || 'wait' in checked) return checked;
  const { reauth, result } = checked;
  onStep('new');
  await paint();
  const registration = client.startRegistration(newPassword);
  const { registrationResponse } = await api<{ registrationResponse: string }>(
    'POST',
    '/api/password/start',
    {
      token: reauth.token,
      registrationRequest: registration.request,
    },
  );
  const finish = client.finishRegistration(newPassword, registration.state, registrationResponse);
  const userId = account.profile?.id ?? '';
  const keyPackage = await keys.rewrapMasterKey(
    userId,
    reauth.keyPackage,
    result.exportKey,
    finish.exportKey,
  );
  await api('POST', '/api/password/finish', {
    token: reauth.token,
    registrationRecord: finish.record,
    keyPackage,
  });
  return 'ok';
}
