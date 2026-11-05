/** Fetch wrapper for the admin API (own origin and cookie, SPEC 4.3, 13). */
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
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}
