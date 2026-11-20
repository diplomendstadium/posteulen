/**
 * API requests and account contexts (SPEC 5.5): a late 401 of account A never signs out account
 * B, answers of an earlier context are dropped, every request carries its expected account.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/status.svelte.ts', () => ({ status: { online: true, updateReady: false } }));

const { api, onAccountMismatch, onUnauthorized, StaleApiError } = await import('../src/lib/api.ts');
const { beginContext, endContext, resetContextsForTests } = await import('../src/lib/context.ts');

interface Pending {
  readonly path: string;
  readonly init: RequestInit;
  readonly answer: (status: number, body: unknown) => void;
}

let pending: Pending[] = [];

beforeEach(() => {
  resetContextsForTests();
  pending = [];
  vi.stubGlobal('fetch', (path: string, init: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      init.signal?.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')),
      );
      pending.push({
        path,
        init,
        answer: (status, body) =>
          resolve(
            new Response(JSON.stringify(body), {
              status,
              headers: { 'content-type': 'application/json' },
            }),
          ),
      });
    });
  });
});

afterEach(() => vi.unstubAllGlobals());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('api with account contexts', () => {
  it('sends the expected account with every request of a context', async () => {
    beginContext('A');
    const request = api('GET', '/api/chats');
    await tick();
    expect((pending[0]?.init.headers as Record<string, string>)['x-posteulen-account']).toBe('A');
    pending[0]?.answer(200, { ok: true });
    await expect(request).resolves.toEqual({ ok: true });
  });

  it('requests without an account carry no account header', async () => {
    const request = api('GET', '/api/session', undefined, { context: null });
    await tick();
    expect(
      (pending[0]?.init.headers as Record<string, string>)['x-posteulen-account'],
    ).toBeUndefined();
    pending[0]?.answer(200, { state: 'none' });
    await request;
  });

  it('a late 401 of account A does not sign out account B', async () => {
    const signedOut: string[] = [];
    const stop = onUnauthorized((context) => signedOut.push(context.accountId));
    const a = beginContext('A');
    // The request of A has already left; it can no longer be aborted on the server side.
    const late = api('GET', '/api/contacts', undefined, { context: a });
    await tick();
    const answerA = pending[0]!.answer;
    endContext();
    beginContext('B');
    answerA(401, { code: 'unauthorized', reason: 'no_session' });
    await expect(late).rejects.toBeInstanceOf(StaleApiError);
    expect(signedOut).toEqual([]);
    stop();
  });

  it('a 401 of the current context ends exactly that context', async () => {
    const signedOut: string[] = [];
    const stop = onUnauthorized((context) => signedOut.push(context.accountId));
    beginContext('A');
    const request = api('GET', '/api/contacts');
    await tick();
    pending[0]?.answer(401, { code: 'unauthorized', reason: 'session_expired' });
    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(signedOut).toEqual(['A']);
    stop();
  });

  it('an answer completed just before the switch is dropped (no side effects)', async () => {
    const a = beginContext('A');
    const request = api<{ profile: string }>('GET', '/api/sync', undefined, { context: a });
    await tick();
    const signal = pending[0]!.init.signal!;
    // B signs in: A's request is aborted.
    beginContext('B');
    expect(signal.aborted).toBe(true);
    await expect(request).rejects.toBeInstanceOf(StaleApiError);
  });

  it('an outdated context cannot even start a request', async () => {
    const a = beginContext('A');
    beginContext('B');
    await expect(
      api('POST', '/api/contacts/x/key-warning', {}, { context: a }),
    ).rejects.toBeInstanceOf(StaleApiError);
    expect(pending).toHaveLength(0);
  });

  it('the server refusing a foreign account tells the app instead of signing out', async () => {
    const mismatches: string[] = [];
    const signedOut: string[] = [];
    const stopMismatch = onAccountMismatch((context) => mismatches.push(context.accountId));
    const stopUnauthorized = onUnauthorized((context) => signedOut.push(context.accountId));
    beginContext('A');
    const request = api('GET', '/api/chats');
    await tick();
    pending[0]?.answer(409, { code: 'account_mismatch' });
    await expect(request).rejects.toBeInstanceOf(StaleApiError);
    expect(mismatches).toEqual(['A']);
    expect(signedOut).toEqual([]);
    stopMismatch();
    stopUnauthorized();
  });
});
