/**
 * Fetch wrapper for the user API: JSON only, CSRF header, version check (SPEC 6, 16.3).
 *
 * Account binding (SPEC 5.5): every request made while signed in belongs to the account
 * context it started in. It carries the expected account ID (`x-posteulen-account`; the server
 * refuses with `409 account_mismatch` if the session cookie belongs to another account by then),
 * is aborted when the context ends, and its answer is dropped – without any side effect – if the
 * context changed while it was under way. A 401 only ends the context it was made in.
 */
import { status } from './status.svelte.ts';
import { currentContext, isCurrent, StaleContextError, type AccountContext } from './context.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: Record<string, unknown>;

  constructor(statusCode: number, body: Record<string, unknown>) {
    super(String(body['code'] ?? 'internal'));
    this.status = statusCode;
    this.code = String(body['code'] ?? 'internal');
    this.body = body;
  }
}

/** An answer of an outdated account context: dropped, never shown (status 0, code "stale"). */
export class StaleApiError extends ApiError {
  constructor() {
    super(0, { code: 'stale' });
  }
}

export function isStale(error: unknown): boolean {
  return error instanceof StaleApiError || error instanceof StaleContextError;
}

type Listener = (context: AccountContext, reason: string) => void;
const unauthorizedListeners = new Set<Listener>();
const mismatchListeners = new Set<(context: AccountContext) => void>();

/**
 * Called on a 401 of a request whose account context is still current (SPEC 5.5: the browser
 * then deletes the local data of exactly this account). A late 401 of an earlier session is
 * ignored.
 */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

/** The session cookie belongs to another account by now (another tab signed in). */
export function onAccountMismatch(listener: (context: AccountContext) => void): () => void {
  mismatchListeners.add(listener);
  return () => mismatchListeners.delete(listener);
}

export interface ApiOptions {
  /**
   * The account context of the request. Default: the current one at the time of the call;
   * `null` for requests without an account (login, registration, session check).
   */
  readonly context?: AccountContext | null;
}

export async function api<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options: ApiOptions = {},
): Promise<T> {
  const context = options.context === undefined ? currentContext() : options.context;
  if (context && !isCurrent(context)) throw new StaleApiError();
  const headers: Record<string, string> = {
    'x-posteulen': '1',
    'x-posteulen-client-version': __POSTEULEN_VERSION__,
  };
  if (context) headers['x-posteulen-account'] = context.accountId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      ...(context ? { signal: context.signal } : {}),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    if (context && !isCurrent(context)) throw new StaleApiError();
    status.online = navigator.onLine;
    throw new ApiError(0, { code: 'offline' });
  }
  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    if (context && !isCurrent(context)) throw new StaleApiError();
    // A body that could not be read (e.g. aborted by a navigation) is never a success:
    // returning {} here once let a page set its list to undefined.
    if (response.ok) throw new ApiError(0, { code: 'offline' });
    data = {};
  }
  // Checked after the answer is complete: a request that finished just before a change of
  // account (and could no longer be aborted) must not touch the new account's state either.
  if (context && !isCurrent(context)) throw new StaleApiError();
  if (!response.ok) {
    if (response.status === 409 && data['code'] === 'client_outdated') status.updateReady = true;
    if (context && response.status === 409 && data['code'] === 'account_mismatch') {
      for (const listener of mismatchListeners) listener(context);
      throw new StaleApiError();
    }
    if (context && response.status === 401 && data['code'] === 'unauthorized') {
      for (const listener of unauthorizedListeners) listener(context, String(data['reason'] ?? ''));
    }
    throw new ApiError(response.status, data);
  }
  return data as T;
}
