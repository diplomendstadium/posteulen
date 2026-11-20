/**
 * Contact vault and account contexts (SPEC 5.5, 5.7): synchronisations, key checks and vault
 * writes of account A have no effect on account B once B is signed in; concurrent
 * synchronisations do not interfere; genuine key manipulation is still detected and reported.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vaultCrypto from '@posteulen/shared/crypto/vault.ts';

vi.mock('../src/lib/status.svelte.ts', () => ({ status: { online: true, updateReady: false } }));

const { ApiError, StaleApiError } = await import('../src/lib/api.ts');
const { beginContext, endContext, isCurrent, resetContextsForTests } =
  await import('../src/lib/context.ts');
const { createVault } = await import('../src/lib/vault-core.ts');
type AccountContext = import('../src/lib/context.ts').AccountContext;
type VaultState = import('../src/lib/vault-core.ts').VaultState;

const KEYS: Record<string, { ed25519: string; x25519: string }> = {
  C: { ed25519: 'c-sign', x25519: 'c-box' },
  D: { ed25519: 'd-sign', x25519: 'd-box' },
  E: { ed25519: 'e-sign', x25519: 'e-box' },
};

/** A small stand-in for the server: vault entries, contacts and key warnings per account. */
function fakeServer() {
  const vaults = new Map<string, Map<string, { version: number; blob: string }>>();
  const contacts: Record<string, string[]> = { A: ['C', 'D'], B: ['C', 'E'] };
  const warnings: string[] = [];
  const puts: string[] = [];
  const keys = structuredClone(KEYS);
  /** Requests for these paths wait until released (delayed answers). */
  const held = new Map<string, (() => void)[]>();
  const holds = new Set<string>();
  const call = async <T>(
    method: string,
    path: string,
    body: unknown,
    options: { context?: AccountContext | null } = {},
  ): Promise<T> => {
    const context = options.context;
    if (!context) throw new Error('no context');
    // Like api.ts: an outdated context never starts a request …
    if (!isCurrent(context)) throw new StaleApiError();
    // … the cookie belongs to whoever is signed in now – exactly the iPad situation.
    if (holds.has(path)) {
      await new Promise<void>((resolve) => held.set(path, [...(held.get(path) ?? []), resolve]));
    }
    // … and an answer arriving after the switch is dropped.
    if (!isCurrent(context)) throw new StaleApiError();
    const account = context.accountId;
    const vault = vaults.get(account) ?? new Map();
    vaults.set(account, vault);
    if (method === 'GET' && path === '/api/vault') {
      return {
        entries: [...vault].map(([contactId, e]) => ({
          contactId,
          version: e.version,
          blob: e.blob,
        })),
      } as T;
    }
    const keyMatch = /^\/api\/contacts\/(\w+)\/keys$/.exec(path);
    if (method === 'GET' && keyMatch) {
      const other = keyMatch[1]!;
      if (!contacts[account]?.includes(other)) throw new ApiError(404, { code: 'not_found' });
      return { userId: other, ...keys[other]! } as T;
    }
    const putMatch = /^\/api\/vault\/(\w+)$/.exec(path);
    if (method === 'PUT' && putMatch) {
      const other = putMatch[1]!;
      const { version, blob } = body as { version: number; blob: string };
      const existing = vault.get(other);
      if (existing && version <= existing.version)
        throw new ApiError(409, { code: 'vault_version' });
      vault.set(other, { version, blob });
      puts.push(`${account}:${other}`);
      return { ok: true } as T;
    }
    const warnMatch = /^\/api\/contacts\/(\w+)\/key-warning$/.exec(path);
    if (method === 'POST' && warnMatch) {
      warnings.push(`${account}:${warnMatch[1]}`);
      return { ok: true } as T;
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
  return {
    call,
    vaults,
    contacts,
    warnings,
    puts,
    keys,
    hold: (path: string) => holds.add(path),
    release: (path: string) => {
      holds.delete(path);
      for (const resolve of held.get(path) ?? []) resolve();
      held.delete(path);
    },
  };
}

const vaultKeys: Record<string, Uint8Array> = {
  A: new Uint8Array(32).fill(1),
  B: new Uint8Array(32).fill(2),
};

function setup() {
  const server = fakeServer();
  const state: VaultState = { entries: {}, loaded: false, synced: false, changedKeys: [] };
  let signedIn: string | null = null;
  const vault = createVault({
    state,
    api: server.call,
    crypto: async () => vaultCrypto,
    keysFor: (context) =>
      signedIn === context.accountId ? { userId: signedIn, vaultKey: vaultKeys[signedIn]! } : null,
    now: () => 1_000,
  });
  const signIn = (id: string): AccountContext => {
    vault.reset();
    signedIn = id;
    return beginContext(id);
  };
  const signOut = () => {
    endContext();
    signedIn = null;
    vault.reset();
  };
  return { server, state, vault, signIn, signOut };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

beforeEach(() => resetContextsForTests());

describe('contact vault across account switches', () => {
  it('A→B without reload: a delayed synchronisation of A writes nothing for B', async () => {
    const { server, state, vault, signIn, signOut } = setup();
    const a = signIn('A');
    server.hold('/api/contacts/D/keys');
    const syncA = vault.syncVault(a, [{ userId: 'C' }, { userId: 'D' }]);
    await tick();
    // A's session ends while the answer for D is still on its way; B signs in.
    signOut();
    const b = signIn('B');
    await vault.syncVault(b, [{ userId: 'C' }, { userId: 'E' }]);
    const putsBefore = [...server.puts];
    server.release('/api/contacts/D/keys');
    await expect(syncA).rejects.toBeTruthy();
    // Nothing of A's late work reached B's vault or B's page state.
    expect(server.puts).toEqual(putsBefore);
    expect(server.puts.filter((p) => p.startsWith('B:'))).toEqual(['B:C', 'B:E']);
    expect(Object.keys(state.entries).sort()).toEqual(['C', 'E']);
    expect(state.changedKeys).toEqual([]);
    expect(state.synced).toBe(true);
    // A's contacts are not marked "separated" in B's vault.
    for (const entry of Object.values(state.entries)) expect(entry.entry.separated).toBe(false);
  });

  it('a delayed key check of A never reports a key warning for B', async () => {
    const { server, vault, signIn, signOut } = setup();
    const a = signIn('A');
    await vault.syncVault(a, [{ userId: 'C' }, { userId: 'D' }]);
    server.hold('/api/contacts/C/keys');
    const check = vault.checkKeysOnDisplay(a, 'C');
    await tick();
    signOut();
    const b = signIn('B');
    // Meanwhile C's keys look different to the server (would be a warning for A).
    server.keys.C = { ed25519: 'other', x25519: 'other' };
    server.release('/api/contacts/C/keys');
    await vault.syncVault(b, [{ userId: 'C' }, { userId: 'E' }]);
    await check;
    expect(server.warnings).toEqual([]);
  });

  it('a stale comparison cannot be started for an ended context', async () => {
    const { server, vault, signIn, signOut } = setup();
    const a = signIn('A');
    await vault.syncVault(a, [{ userId: 'C' }]);
    signOut();
    signIn('B');
    await expect(vault.keysMatch(a, 'C', { ed25519: 'x', x25519: 'y' })).rejects.toBeTruthy();
    expect(server.warnings).toEqual([]);
  });

  it('concurrent synchronisations of one context run one after the other', async () => {
    const { server, state, vault, signIn } = setup();
    const b = signIn('B');
    server.hold('/api/contacts/C/keys');
    const first = vault.syncVault(b, [{ userId: 'C' }]);
    const second = vault.syncVault(b, [{ userId: 'C' }, { userId: 'E' }]);
    const third = vault.syncVault(b, [{ userId: 'C' }, { userId: 'E' }]);
    await tick();
    server.release('/api/contacts/C/keys');
    await Promise.all([first, second, third]);
    // Every contact bound exactly once, no version conflict, nothing marked as changed.
    expect(server.puts).toEqual(['B:C', 'B:E']);
    expect(state.changedKeys).toEqual([]);
    expect(state.synced).toBe(true);
  });

  it('loaded is not synchronised: checks wait for the complete synchronisation', async () => {
    const { server, state, vault, signIn } = setup();
    const b = signIn('B');
    await vault.syncVault(b, [{ userId: 'C' }]);
    // A new contact E arrives; its keys are slow.
    server.hold('/api/contacts/E/keys');
    const sync = vault.syncVault(b, [{ userId: 'C' }, { userId: 'E' }]);
    await tick();
    expect(state.loaded).toBe(true);
    expect(state.synced).toBe(false);
    let ready: boolean | null = null;
    const waiting = vault.whenSynced(b).then((value) => (ready = value));
    await tick();
    expect(ready).toBeNull();
    server.release('/api/contacts/E/keys');
    await sync;
    await waiting;
    expect(ready).toBe(true);
    expect(state.entries['E']).toBeDefined();
  });

  it('waiting for the synchronisation ends with the context', async () => {
    const { server, vault, signIn, signOut } = setup();
    const a = signIn('A');
    server.hold('/api/contacts/C/keys');
    void vault.syncVault(a, [{ userId: 'C' }]).catch(() => undefined);
    const waiting = vault.whenSynced(a);
    await tick();
    signOut();
    await expect(waiting).resolves.toBe(false);
  });

  it('genuine key manipulation is still detected, reported and kept in the history', async () => {
    const { server, state, vault, signIn } = setup();
    const b = signIn('B');
    await vault.syncVault(b, [{ userId: 'C' }, { userId: 'E' }]);
    // The server now delivers other keys for C (manipulation).
    server.keys.C = { ed25519: 'evil-sign', x25519: 'evil-box' };
    await expect(vault.keysMatch(b, 'C', server.keys.C)).resolves.toBe(false);
    expect(server.warnings).toEqual(['B:C']);
    // The display check reports it as well (once per visit).
    await vault.checkKeysOnDisplay(b, 'E');
    expect(server.warnings).toEqual(['B:C']);
    // The binding itself was not overwritten.
    expect(state.entries['C']?.entry.keySets).toHaveLength(1);
    expect(state.entries['C']?.entry.keySets[0]?.ed25519).toBe('c-sign');
  });

  it('a former contact coupled again with other keys keeps the old keys and shows a note', async () => {
    const { server, state, vault, signIn } = setup();
    const b = signIn('B');
    await vault.syncVault(b, [{ userId: 'C' }, { userId: 'E' }]);
    // C is removed (separated) …
    await vault.syncVault(b, [{ userId: 'E' }]);
    expect(state.entries['C']?.entry.separated).toBe(true);
    // … and coupled again with different keys.
    server.keys.C = { ed25519: 'c-new', x25519: 'c-new-box' };
    await vault.syncVault(b, [{ userId: 'C' }, { userId: 'E' }]);
    expect(state.changedKeys).toEqual(['C']);
    expect(state.entries['C']?.entry.keySets.map((k) => k.ed25519)).toEqual(['c-sign', 'c-new']);
  });

  it('a newer entry written elsewhere is read again instead of overwritten', async () => {
    const { server, state, vault, signIn } = setup();
    const b = signIn('B');
    await vault.syncVault(b, [{ userId: 'C' }]);
    // Another tab marked C as compared with version 5.
    const entry = state.entries['C']!.entry;
    server.vaults.get('B')!.set('C', {
      version: 5,
      blob: await vaultCrypto.sealVaultEntry(vaultKeys['B']!, 'B', 5, {
        ...entry,
        compared: true,
      }),
    });
    await vault.markCompared(b, 'C');
    expect(state.entries['C']?.version).toBe(5);
    expect(state.entries['C']?.entry.compared).toBe(true);
  });

  it('entries of another account cannot be opened (authenticated binding)', async () => {
    const { server, state, vault, signIn, signOut } = setup();
    const a = signIn('A');
    await vault.syncVault(a, [{ userId: 'C' }]);
    signOut();
    // A's encrypted entry ends up in B's vault on the server (worst case of the old bug).
    server.vaults.set('B', new Map(server.vaults.get('A')));
    const b = signIn('B');
    await vault.loadVault(b);
    expect(state.entries['C']).toBeUndefined();
  });
});

describe('delayed decryption', () => {
  it('a vault decrypted slowly for A is never shown for B', async () => {
    resetContextsForTests();
    const server = fakeServer();
    const state: VaultState = { entries: {}, loaded: false, synced: false, changedKeys: [] };
    let signedIn: string | null = null;
    let releaseOpen: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => (releaseOpen = resolve));
    let slowOnce = true;
    const vault = createVault({
      state,
      api: server.call,
      crypto: async () => ({
        ...vaultCrypto,
        // The first decryption (A's vault) hangs, like a slow old device.
        openVaultEntry: async (...args: Parameters<typeof vaultCrypto.openVaultEntry>) => {
          if (slowOnce) {
            slowOnce = false;
            await slow;
          }
          return vaultCrypto.openVaultEntry(...args);
        },
      }),
      keysFor: (context) =>
        signedIn === context.accountId
          ? { userId: signedIn, vaultKey: vaultKeys[signedIn]! }
          : null,
      now: () => 1_000,
    });
    signedIn = 'A';
    const a = beginContext('A');
    await vault.syncVault(a, [{ userId: 'C' }]);
    vault.reset();
    const a2 = beginContext('A');
    const loading = vault.loadVault(a2);
    await tick();
    endContext();
    vault.reset();
    signedIn = 'B';
    const b = beginContext('B');
    await vault.syncVault(b, [{ userId: 'E' }]);
    releaseOpen();
    await expect(loading).rejects.toBeTruthy();
    expect(Object.keys(state.entries)).toEqual(['E']);
  });
});
