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
/** v0.8: the bots control centre (same code) expires after 12 hours instead. */
let idleMs = ACCOUNT.ADMIN_SESSION_IDLE_MINUTES * TIME.MINUTE;

export function setIdleTime(ms: number): void {
  idleMs = ms;
}

function sessionEnded(): void {
  if (idleTimer !== undefined) clearTimeout(idleTimer);
  idleTimer = undefined;
  window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
}

/** (Re)starts the idle timer after an answer of a logged-in session; `stop` clears it. */
export function touchSession(stop = false): void {
  if (idleTimer !== undefined) clearTimeout(idleTimer);
  idleTimer = stop ? undefined : setTimeout(sessionEnded, idleMs);
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

/** v0.8: a raw body (picture, ZIP file) to the control centre. */
export async function apiRaw<T>(path: string, contentType: string, body: Blob): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'x-posteulen': '1', 'content-type': contentType },
      credentials: 'same-origin',
      cache: 'no-store',
      body,
    });
  } catch {
    throw new ApiError(0, { code: 'offline' });
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (response.status === 401) sessionEnded();
  if (!response.ok) throw new ApiError(response.status, data);
  touchSession();
  return data as T;
}

/** v0.8: downloads a file the server creates (export as ZIP). */
export async function download(path: string, body: unknown, fallbackName: string): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'x-posteulen': '1', 'content-type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  if (response.status === 401) sessionEnded();
  if (!response.ok) {
    throw new ApiError(
      response.status,
      (await response.json().catch(() => ({}))) as Record<string, unknown>,
    );
  }
  touchSession();
  const name =
    /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ??
    fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
