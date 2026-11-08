/** Fetch wrapper for the admin API (own origin and cookie, SPEC 4.3, 13). */
import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';

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

/**
 * v0.7: an admin login expires after 10 minutes without activity. Every answer of the server
 * counts as activity and restarts the local timer; when it runs out, or the server answers 401,
 * the panel goes back to the login (so nothing stays on screen after the session is gone).
 */
export const SESSION_ENDED_EVENT = 'posteulen-admin-session-ended';
let idleTimer: ReturnType<typeof setTimeout> | undefined;

function sessionEnded(): void {
  if (idleTimer !== undefined) clearTimeout(idleTimer);
  idleTimer = undefined;
  window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
}

/** (Re)starts the idle timer after an answer of a logged-in session; `stop` clears it. */
export function touchSession(stop = false): void {
  if (idleTimer !== undefined) clearTimeout(idleTimer);
  idleTimer = stop
    ? undefined
    : setTimeout(sessionEnded, ACCOUNT.ADMIN_SESSION_IDLE_MINUTES * TIME.MINUTE);
}

export async function api<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { 'x-posteulen': '1' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(0, { code: 'offline' });
  }
  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // An unreadable body is never a success (aborted by a navigation, for example).
    if (response.ok) throw new ApiError(0, { code: 'offline' });
    data = {};
  }
  if (response.status === 401 && path !== '/api/session' && !path.startsWith('/api/login')) {
    sessionEnded();
  }
  if (!response.ok) throw new ApiError(response.status, data);
  const sessionCall =
    path === '/api/session' || path === '/api/logout' || path.startsWith('/api/login');
  if (!sessionCall && !path.startsWith('/api/altcha')) touchSession();
  return data as T;
}
