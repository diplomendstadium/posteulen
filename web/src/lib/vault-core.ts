/**
 * Contact vault logic (SPEC 5.7), bound to account contexts (SPEC 5.5). Plain TypeScript with
 * injected dependencies, so it is testable without a browser; `vault.svelte.ts` wires it to the
 * page state.
 *
 * Rules:
 * - Everything a vault operation reads or writes belongs to the context it started in: keys are
 *   taken once at the start, every await is followed by a context check, and results or side
 *   effects of an outdated context (vault writes, key warnings, "keys changed" notes) are dropped.
 * - "Loaded" (the stored entries are decrypted) and "synchronised" (all current contacts are
 *   bound) are two different states; checks of letters and keys wait for the second.
 * - Synchronisations of one context run one after the other, never interleaved.
 * - A key warning is only reported after comparing the server's keys with a binding of the same
 *   valid context that was decrypted and authenticated from the vault.
 */
import type { KeySet, VaultEntry } from '@posteulen/shared/crypto/vault.ts';
import { ApiError } from './api.ts';
import { assertCurrent, type AccountContext } from './context.ts';

export interface StoredEntry {
  readonly entry: VaultEntry;
  readonly version: number;
}

export interface VaultState {
  entries: Record<string, StoredEntry>;
  /** The stored entries of the current context are decrypted. */
  loaded: boolean;
  /** All current contacts are bound (a complete synchronisation of this context ran). */
  synced: boolean;
  changedKeys: string[];
}

type VaultCrypto = typeof import('@posteulen/shared/crypto/vault.ts');
type Api = <T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options?: { context?: AccountContext | null },
) => Promise<T>;

export interface VaultDeps {
  readonly state: VaultState;
  readonly api: Api;
  readonly crypto: () => Promise<
    Pick<VaultCrypto, 'openVaultEntry' | 'sealVaultEntry' | 'bindKeys'>
  >;
  /** The keys of exactly this context, or null (never those of another account). */
  readonly keysFor: (context: AccountContext) => { userId: string; vaultKey: Uint8Array } | null;
  readonly now: () => number;
}

interface Session {
  readonly context: AccountContext;
  readonly userId: string;
  readonly vaultKey: Uint8Array;
  loading: Promise<void> | null;
  chain: Promise<void>;
  waiters: (() => void)[];
  checked: Set<string>;
}

export interface ServerKeys {
  readonly ed25519: string;
  readonly x25519: string;
}

export function createVault(deps: VaultDeps) {
  const { state } = deps;
  let session: Session | null = null;

  function sessionFor(context: AccountContext): Session {
    assertCurrent(context);
    if (session?.context === context) return session;
    const keys = deps.keysFor(context);
    if (!keys || keys.userId !== context.accountId) throw new Error('not logged in');
    reset();
    session = {
      context,
      userId: keys.userId,
      vaultKey: keys.vaultKey,
      loading: null,
      chain: Promise.resolve(),
      waiters: [],
      checked: new Set(),
    };
    return session;
  }

  /** Sign-out or change of account: the decrypted vault goes, waiting checks give up. */
  function reset(): void {
    const old = session;
    session = null;
    state.entries = {};
    state.loaded = false;
    state.synced = false;
    state.changedKeys = [];
    for (const wake of old?.waiters ?? []) wake();
  }

  function own(current: Session): boolean {
    return session === current;
  }

  async function fetchEntries(current: Session): Promise<void> {
    const { openVaultEntry } = await deps.crypto();
    assertCurrent(current.context);
    const { entries } = await deps.api<{
      entries: { contactId: string; version: number; blob: string }[];
    }>('GET', '/api/vault', undefined, { context: current.context });
    const result: Record<string, StoredEntry> = {};
    for (const item of entries) {
      try {
        result[item.contactId] = {
          entry: await openVaultEntry(
            current.vaultKey,
            current.userId,
            item.contactId,
            item.version,
            item.blob,
          ),
          version: item.version,
        };
      } catch {
        // A swapped or foreign entry is ignored – letters of this contact cannot be verified.
      }
      // Decryption cannot be aborted: check after every step instead.
      assertCurrent(current.context);
    }
    if (!own(current)) return;
    state.entries = result;
    state.loaded = true;
  }

  /** Decrypts the stored entries once per context (concurrent callers share the work). */
  function loadVault(context: AccountContext): Promise<void> {
    const current = sessionFor(context);
    if (state.loaded) return Promise.resolve();
    current.loading ??= fetchEntries(current).finally(() => {
      current.loading = null;
    });
    return current.loading;
  }

  /**
   * Stores one entry. `false` if another tab or device wrote a newer version in the meantime:
   * the vault is then read again instead of overwriting anything.
   */
  async function store(
    current: Session,
    contactId: string,
    entry: VaultEntry,
    version: number,
  ): Promise<boolean> {
    const { sealVaultEntry } = await deps.crypto();
    const blob = await sealVaultEntry(current.vaultKey, current.userId, version, entry);
    assertCurrent(current.context);
    try {
      await deps.api(
        'PUT',
        `/api/vault/${contactId}`,
        { version, blob },
        { context: current.context },
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === 'vault_version') {
        await fetchEntries(current);
        return false;
      }
      throw error;
    }
    assertCurrent(current.context);
    if (own(current)) state.entries = { ...state.entries, [contactId]: { entry, version } };
    return true;
  }

  async function runSync(current: Session, contacts: readonly { userId: string }[]): Promise<void> {
    await loadVault(current.context);
    const { bindKeys } = await deps.crypto();
    assertCurrent(current.context);
    const ids = contacts.map((c) => c.userId);
    for (const contact of contacts) {
      const existing = state.entries[contact.userId];
      if (existing && !existing.entry.separated) continue;
      let serverKeys: ServerKeys;
      try {
        serverKeys = await deps.api<ServerKeys>(
          'GET',
          `/api/contacts/${contact.userId}/keys`,
          undefined,
          { context: current.context },
        );
      } catch (error) {
        assertCurrent(current.context);
        // Removed in the meantime or offline: bound on the next synchronisation.
        if (error instanceof ApiError) continue;
        throw error;
      }
      assertCurrent(current.context);
      // Compared with the entry of this context as it is now (another sync may have bound it).
      const latest = state.entries[contact.userId];
      const { entry, changed } = bindKeys(
        latest?.entry ?? null,
        contact.userId,
        serverKeys,
        deps.now(),
      );
      const stored = await store(current, contact.userId, entry, (latest?.version ?? 0) + 1);
      if (stored && changed && own(current)) {
        state.changedKeys = [...state.changedKeys, contact.userId];
      }
    }
    for (const [contactId, stored] of Object.entries(state.entries)) {
      if (!ids.includes(contactId) && !stored.entry.separated) {
        await store(current, contactId, { ...stored.entry, separated: true }, stored.version + 1);
      }
    }
  }

  /**
   * Binding for confirmed contacts without (current) entry; marks former contacts (SPEC 5.7).
   * Runs after the previous synchronisation of the same context, with the contact list that
   * was loaded in this context.
   */
  function syncVault(
    context: AccountContext,
    contacts: readonly { userId: string }[],
  ): Promise<void> {
    const current = sessionFor(context);
    state.synced = false;
    const run = current.chain.then(async () => {
      if (!own(current)) return;
      await runSync(current, contacts);
      if (!own(current)) return;
      state.synced = true;
      const waiting = current.waiters;
      current.waiters = [];
      for (const wake of waiting) wake();
    });
    current.chain = run.catch(() => undefined);
    return run;
  }

  /**
   * Waits until the vault of this context is completely synchronised (or the timeout passes,
   * or the context ends). `true` only if it is synchronised and the context still current.
   */
  async function whenSynced(context: AccountContext, timeoutMs = 20_000): Promise<boolean> {
    const current = sessionFor(context);
    if (!state.synced) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, timeoutMs);
        current.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    return own(current) && state.synced;
  }

  function currentKeySet(contactId: string): KeySet | undefined {
    const entry = state.entries[contactId]?.entry;
    return entry ? entry.keySets[entry.keySets.length - 1] : undefined;
  }

  /**
   * Compares keys delivered by the server with the binding of this context. On a deviation the
   * browser reports it (the server then blocks sending, SPEC 5.7) and returns false. Without a
   * binding there is nothing to compare: false, but no warning.
   */
  async function keysMatch(
    context: AccountContext,
    contactId: string,
    serverKeys: ServerKeys,
  ): Promise<boolean> {
    const current = sessionFor(context);
    await loadVault(context);
    assertCurrent(context);
    if (!own(current)) return false;
    const bound = currentKeySet(contactId);
    if (!bound) return false;
    if (bound.ed25519 === serverKeys.ed25519 && bound.x25519 === serverKeys.x25519) return true;
    assertCurrent(context);
    await deps
      .api('POST', `/api/contacts/${contactId}/key-warning`, {}, { context })
      .catch(() => undefined);
    return false;
  }

  /**
   * SPEC 5.7: keys are compared "before sending and when showing received letters" – once per
   * visit and contact, after the vault of this context is completely synchronised.
   */
  async function checkKeysOnDisplay(context: AccountContext, contactId: string): Promise<void> {
    const current = sessionFor(context);
    if (current.checked.has(contactId)) return;
    current.checked.add(contactId);
    try {
      if (!(await whenSynced(context))) {
        current.checked.delete(contactId);
        return;
      }
      const stored = state.entries[contactId];
      if (!stored || stored.entry.separated) return;
      const serverKeys = await deps.api<ServerKeys>(
        'GET',
        `/api/contacts/${contactId}/keys`,
        undefined,
        { context },
      );
      await keysMatch(context, contactId, serverKeys);
    } catch {
      // Not a contact any more, offline or outdated: checked again on the next visit.
      if (own(current)) current.checked.delete(contactId);
    }
  }

  async function markCompared(context: AccountContext, contactId: string): Promise<void> {
    const current = sessionFor(context);
    await loadVault(context);
    const stored = state.entries[contactId];
    if (!stored) return;
    await store(current, contactId, { ...stored.entry, compared: true }, stored.version + 1);
  }

  /** The keys of this context for labels and safety numbers. */
  function keysOf(context: AccountContext): { userId: string; vaultKey: Uint8Array } {
    const current = sessionFor(context);
    return { userId: current.userId, vaultKey: current.vaultKey };
  }

  return {
    loadVault,
    syncVault,
    whenSynced,
    keysMatch,
    checkKeysOnDisplay,
    markCompared,
    currentKeySet,
    keysOf,
    reset,
  };
}
