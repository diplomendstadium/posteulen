/** Fetch wrapper for the user API: JSON only, CSRF header, version check (SPEC 6, 16.3). */
import { status } from './status.svelte.ts';

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

type Listener = (reason: string) => void;
const unauthorizedListeners = new Set<Listener>();

/** Called on every 401 (SPEC 5.5: the browser then deletes local account data). */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export async function api<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'x-posteulen': '1',
    'x-posteulen-client-version': __POSTEULEN_VERSION__,
  };
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
    status.online = navigator.onLine;
    throw new ApiError(0, { code: 'offline' });
  }
  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // A body that could not be read (e.g. aborted by a navigation) is never a success:
    // returning {} here once let a page set its list to undefined.
    if (response.ok) throw new ApiError(0, { code: 'offline' });
    data = {};
  }
  if (!response.ok) {
    if (response.status === 409 && data['code'] === 'client_outdated') status.updateReady = true;
    if (response.status === 401 && data['code'] === 'unauthorized') {
      for (const listener of unauthorizedListeners) listener(String(data['reason'] ?? ''));
    }
    throw new ApiError(response.status, data);
  }
  return data as T;
}
