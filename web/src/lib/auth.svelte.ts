/**
 * Account state and the client side of registration, login, logout and password change
 * (SPEC 5.2–5.6). Crypto libraries are loaded on demand (large WASM modules).
 */
import { api, ApiError, onAccountMismatch, onUnauthorized } from './api.ts';
import { clearKeys, loadKeys, saveKeys, type LocalKeys } from './crypto/keystore.ts';
import {
  beginContext,
  contextGeneration,
  currentContext,
  endContext,
  isCurrent,
  type AccountContext,
} from './context.ts';
import { announceAuthChange, onAuthChangedElsewhere } from './auth-sync.ts';
import { solveCaptcha } from './captcha.ts';
import type { Language } from '@posteulen/shared/i18n.ts';
import { i18n } from './i18n.svelte.ts';

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
  readonly homeChangesLeft: number;
  readonly letterRetentionDays: number;
  readonly lettersPrint: boolean;
  /** v0.8.2 */
  readonly linksClickable?: boolean;
  /** Language of the account (v0.4). */
  readonly language: Language;
  /** Today's daily wage in tenths (v0.4). */
  readonly dailyGold: number;
  /** v0.7.1: a message to the admin was already sent today (UTC). */
  readonly feedbackSentToday?: boolean;
}

/** "Benachrichtigungen sind nicht bestätigt" hidden until the next login (v0.3). */
const PUSH_HINT_KEY = 'posteulen.pushHintHidden';

function storedPushHintHidden(): boolean {
  try {
    return localStorage.getItem(PUSH_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export const account = $state<{
  checked: boolean;
  profile: Profile | null;
  keys: LocalKeys | null;
  notice: string | null;
  pushHintHidden: boolean;
}>({
  checked: false,
  profile: null,
  keys: null,
  notice: null,
  pushHintHidden: storedPushHintHidden(),
});

export function setPushHintHidden(hidden: boolean): void {
  account.pushHintHidden = hidden;
  try {
    if (hidden) localStorage.setItem(PUSH_HINT_KEY, '1');
    else localStorage.removeItem(PUSH_HINT_KEY);
  } catch {
    // Without storage the hint stays hidden for this visit only.
  }
}

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

/**
 * State in memory that belongs to the signed-in account (contact vault, lists). It is dropped
 * together with the keys whenever the account context ends (SPEC 5.5).
 */
// Plain bookkeeping, not state the page shows.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const signOutListeners = new Set<() => void>();

export function onSignOut(listener: () => void): void {
  signOutListeners.add(listener);
}

/**
 * Changes with every authentication change (sign-in, restored session, sign-out, session
 * switched in another tab). Code that awaits the server checks it before storing the answer,
 * so work still running for a previous account cannot refill the state of the next one.
 */
export function accountGeneration(): number {
  return contextGeneration();
}

/** Drops the account state in memory (keys, vault, lists) and ends the context. */
function dropLocalState(): void {
  endContext();
  account.profile = null;
  account.keys = null;
  for (const listener of signOutListeners) listener();
}

/**
 * Sign-out of one account context: memory and the locally stored keys of exactly this account
 * go. A late call for an earlier context (e.g. a 401 of session A arriving after B signed in)
 * changes nothing.
 */
async function forget(context: AccountContext | null = currentContext()): Promise<void> {
  if (context && !isCurrent(context)) return;
  const accountId = context?.accountId ?? account.profile?.id ?? null;
  dropLocalState();
  if (accountId) await clearKeys(accountId).catch(() => false);
  announceAuthChange();
}

/**
 * Profile and keys are published together, and only if they belong to the same account – a
 * profile of B is never used with keys of A. Starts a new account context.
 */
function publish(profile: Profile, keys: LocalKeys): AccountContext {
  if (profile.id !== keys.userId) throw new Error('account_keys_mismatch');
  const context = beginContext(profile.id);
  account.profile = profile;
  account.keys = keys;
  return context;
}

/** Stores a newer profile of the same account (never one of another account or context). */
export function setProfile(context: AccountContext, profile: Profile | null | undefined): void {
  if (!profile || !isCurrent(context) || profile.id !== context.accountId) return;
  account.profile = profile;
}

onUnauthorized((context) => {
  if (isCurrent(context)) void forget(context);
});

// The session cookie belongs to another account by now (another tab or window signed in):
// drop this tab's state and take over the valid session, if its keys are here.
onAccountMismatch((context) => {
  if (!isCurrent(context)) return;
  dropLocalState();
  void restore({ quiet: true });
});

onAuthChangedElsewhere(() => {
  dropLocalState();
  void restore({ quiet: true });
});

// bfcache (iPad, Safari): a page shown again from the cache may hold an account that is no
// longer signed in here – check the session again.
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void restore({ quiet: true });
  });
}

let restoring: Promise<void> | null = null;

/**
 * App start and every resumption: is there a valid session and are its local keys there?
 * (SPEC 5.5) `quiet`: triggered by another tab or the server's account binding – a missing key
 * record then only signs this tab out, without ending the session (the other tab may still be
 * storing its keys and will announce itself).
 */
export function restore(options: { quiet?: boolean } = {}): Promise<void> {
  if (restoring) return restoring.then(() => restoreOnce(options));
  restoring = restoreOnce(options).finally(() => {
    restoring = null;
  });
  return restoring;
}

async function restoreOnce(options: { quiet?: boolean }): Promise<void> {
  const generationAtStart = contextGeneration();
  const previous = currentContext();
  try {
    const session = await api<{ state: 'none' | 'expired' | 'active'; profile?: Profile }>(
      'GET',
      '/api/session',
      undefined,
      { context: null },
    );
    // Another change of authentication happened meanwhile: that one wins.
    if (contextGeneration() !== generationAtStart) return;
    if (session.state !== 'active' || !session.profile) {
      if (previous) await forget(previous);
      else dropLocalState();
      return;
    }
    const profile = session.profile;
    if (previous && previous.accountId === profile.id) {
      setProfile(previous, profile);
      return;
    }
    const keys = await loadKeys(profile.id);
    if (contextGeneration() !== generationAtStart) return;
    if (!keys) {
      if (previous) dropLocalState();
      if (!options.quiet) {
        // A session without local keys is useless: log out cleanly.
        await api('POST', '/api/logout', {}, { context: null }).catch(() => undefined);
      }
      return;
    }
    if (previous) dropLocalState();
    publish(profile, keys);
  } catch (error) {
    if (contextGeneration() !== generationAtStart) return;
    if (!(error instanceof ApiError) || error.status === 401) {
      if (previous) await forget(previous);
    }
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
  let first = await api<LoginStart>(
    'POST',
    '/api/login/start',
    { name, startLoginRequest: start.request },
    { context: null },
  );
  if (first.status === 'captcha_required') {
    onStep('captcha');
    first = await api<LoginStart>(
      'POST',
      '/api/login/start',
      { name, startLoginRequest: start.request, altcha: await solveCaptcha() },
      { context: null },
    );
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
    }>(
      'POST',
      '/api/login/finish',
      { attemptId: first.attemptId, finishLoginRequest: result.finishRequest },
      { context: null },
    );
  } catch (error) {
    if (error instanceof ApiError && error.code === 'login_failed') return 'wrong';
    throw error;
  }
  const unlocked = await keys.unlockAccount(finish.userId, finish.keyPackage, result.exportKey, {
    ed25519: encoding.fromBase64Url(finish.ed25519Public),
    x25519: encoding.fromBase64Url(finish.x25519Public),
  });
  if (finish.profile.id !== finish.userId) throw new Error('account_keys_mismatch');
  // The session cookie now belongs to this account: whatever this tab still held goes first.
  dropLocalState();
  await saveKeys(finish.userId, unlocked);
  unlocked.masterKey.fill(0);
  const stored = await loadKeys(finish.userId);
  if (!stored) throw new Error('keys_not_stored');
  publish(finish.profile, stored);
  account.notice = finish.deletionCancelled ? 'deletionCancelled' : null;
  setPushHintHidden(false);
  announceAuthChange();
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
    { context: null },
  );
  onStep('keys');
  await paint();
  const finish = client.finishRegistration(input.password, start.state, first.registrationResponse);
  const created = await keys.createAccountKeys(first.userId, finish.exportKey);
  const done = await api<{ userId: string; profile: Profile }>(
    'POST',
    '/api/register/finish',
    {
      reservationId: first.reservationId,
      registrationRecord: finish.record,
      ed25519Public: encoding.toBase64Url(created.account.identity.ed25519Public),
      x25519Public: encoding.toBase64Url(created.account.identity.x25519Public),
      keyPackage: created.keyPackage,
      home: input.home,
      // v0.4: an account created in the English view prefers English.
      language: i18n.lang,
    },
    { context: null },
  );
  if (done.profile.id !== done.userId) throw new Error('account_keys_mismatch');
  dropLocalState();
  await saveKeys(done.userId, created.account);
  created.account.masterKey.fill(0);
  const stored = await loadKeys(done.userId);
  if (!stored) throw new Error('keys_not_stored');
  publish(done.profile, stored);
  setPushHintHidden(false);
  announceAuthChange();
}

export async function logout(): Promise<void> {
  const context = currentContext();
  await api('POST', '/api/logout', {}, { context }).catch(() => undefined);
  await forget(context);
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
  const context = currentContext();
  const checked = await reauthenticate(password, 'delete');
  if (checked === 'wrong' || 'wait' in checked) return checked;
  await api('POST', '/api/account/delete', { token: checked.reauth.token }, { context });
  await forget(context);
  return 'ok';
}

export async function changeName(name: string): Promise<void> {
  const context = currentContext();
  const { profile } = await api<{ profile: Profile }>('PATCH', '/api/account/name', { name });
  if (context) setProfile(context, profile);
}

export async function changeHome(home: { lat: number; lon: number }): Promise<void> {
  const context = currentContext();
  const { profile } = await api<{ profile: Profile }>('PATCH', '/api/account/home', { home });
  if (context) setProfile(context, profile);
}

export async function changeLetterSettings(settings: {
  retentionDays: number;
  print: boolean;
  links?: boolean;
}): Promise<void> {
  const context = currentContext();
  const { profile } = await api<{ profile: Profile }>('PATCH', '/api/account/letters', settings);
  if (context) setProfile(context, profile);
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
  const userId = currentContext()?.accountId ?? '';
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
