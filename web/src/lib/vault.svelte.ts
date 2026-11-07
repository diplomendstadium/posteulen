/**
 * Contact vault in the browser (SPEC 5.7): binds contacts' public keys, compares them before
 * sending and when showing letters, reports deviations, marks separated contacts.
 */
import type { KeySet, VaultEntry } from '@posteulen/shared/crypto/vault.ts';
import { api } from './api.ts';
import { account, accountGeneration, onSignOut } from './auth.svelte.ts';

export interface StoredEntry {
  readonly entry: VaultEntry;
  readonly version: number;
}

export const vault = $state<{
  entries: Record<string, StoredEntry>;
  loaded: boolean;
  changedKeys: string[];
}>({
  entries: {},
  loaded: false,
  changedKeys: [],
});

/** Contacts whose keys were compared with the server on display in this visit (SPEC 5.7). */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping, not shown anywhere
const checkedOnDisplay = new Set<string>();

// v0.6.1: the decrypted vault belongs to the account – it goes with logout and every 401.
onSignOut(() => {
  vault.entries = {};
  vault.loaded = false;
  vault.changedKeys = [];
  checkedOnDisplay.clear();
});

const crypto = () => import('@posteulen/shared/crypto/vault.ts');

function keys(): { userId: string; vaultKey: Uint8Array } {
  if (!account.keys || !account.profile) throw new Error('not logged in');
  return { userId: account.profile.id, vaultKey: account.keys.vaultKey };
}

export async function loadVault(): Promise<void> {
  const { userId, vaultKey } = keys();
  const generation = accountGeneration();
  const { openVaultEntry } = await crypto();
  const { entries } = await api<{
    entries: { contactId: string; version: number; blob: string }[];
  }>('GET', '/api/vault');
  const result: Record<string, StoredEntry> = {};
  for (const item of entries) {
    try {
      result[item.contactId] = {
        entry: await openVaultEntry(vaultKey, userId, item.contactId, item.version, item.blob),
        version: item.version,
      };
    } catch {
      // A swapped or foreign entry is ignored – letters of this contact cannot be verified.
    }
  }
  if (generation !== accountGeneration()) return;
  vault.entries = result;
  vault.loaded = true;
}

async function store(contactId: string, entry: VaultEntry, version: number): Promise<void> {
  const { userId, vaultKey } = keys();
  const generation = accountGeneration();
  const { sealVaultEntry } = await crypto();
  await api('PUT', `/api/vault/${contactId}`, {
    version,
    blob: await sealVaultEntry(vaultKey, userId, version, entry),
  });
  if (generation !== accountGeneration()) return;
  vault.entries = { ...vault.entries, [contactId]: { entry, version } };
}

/** Binding for confirmed contacts without (current) entry; marks former contacts (SPEC 5.7). */
export async function syncVault(contacts: readonly { userId: string }[]): Promise<void> {
  if (!vault.loaded) await loadVault();
  const { bindKeys } = await crypto();
  const current = contacts.map((c) => c.userId);
  for (const contact of contacts) {
    const existing = vault.entries[contact.userId];
    if (existing && !existing.entry.separated) continue;
    const serverKeys = await api<{ ed25519: string; x25519: string }>(
      'GET',
      `/api/contacts/${contact.userId}/keys`,
    );
    const { entry, changed } = bindKeys(
      existing?.entry ?? null,
      contact.userId,
      serverKeys,
      Date.now(),
    );
    if (changed) vault.changedKeys = [...vault.changedKeys, contact.userId];
    await store(contact.userId, entry, (existing?.version ?? 0) + 1);
  }
  for (const [contactId, stored] of Object.entries(vault.entries)) {
    if (!current.includes(contactId) && !stored.entry.separated) {
      await store(contactId, { ...stored.entry, separated: true }, stored.version + 1);
    }
  }
}

export function currentKeySet(contactId: string): KeySet | undefined {
  const entry = vault.entries[contactId]?.entry;
  return entry ? entry.keySets[entry.keySets.length - 1] : undefined;
}

/**
 * Compares keys delivered by the server with the vault. On a deviation the browser reports it
 * (the server then blocks sending, SPEC 5.7) and returns false.
 */
export async function keysMatch(
  contactId: string,
  serverKeys: { ed25519: string; x25519: string },
): Promise<boolean> {
  const bound = currentKeySet(contactId);
  if (!bound) return false;
  if (bound.ed25519 === serverKeys.ed25519 && bound.x25519 === serverKeys.x25519) return true;
  await api('POST', `/api/contacts/${contactId}/key-warning`, {}).catch(() => undefined);
  return false;
}

/**
 * SPEC 5.7: keys are compared "before sending and when showing received letters". Opening a
 * conversation with a bound contact compares the keys the server currently delivers once per
 * visit; a deviation is reported (warning and sending block) like before sending (v0.6.1).
 */
export async function checkKeysOnDisplay(contactId: string): Promise<void> {
  const stored = vault.entries[contactId];
  if (!stored || stored.entry.separated || checkedOnDisplay.has(contactId)) return;
  checkedOnDisplay.add(contactId);
  try {
    const serverKeys = await api<{ ed25519: string; x25519: string }>(
      'GET',
      `/api/contacts/${contactId}/keys`,
    );
    await keysMatch(contactId, serverKeys);
  } catch {
    // Not a contact any more or offline: checked again on the next visit.
    checkedOnDisplay.delete(contactId);
  }
}

export async function markCompared(contactId: string): Promise<void> {
  const stored = vault.entries[contactId];
  if (!stored) return;
  await store(contactId, { ...stored.entry, compared: true }, stored.version + 1);
}

export async function safetyNumberWith(contactId: string): Promise<string | null> {
  const own = account.keys;
  const bound = currentKeySet(contactId);
  if (!own || !bound || !account.profile) return null;
  const { safetyNumber } = await crypto();
  const { toBase64Url } = await import('@posteulen/shared/crypto/encoding.ts');
  return safetyNumber(
    {
      userId: account.profile.id,
      ed25519: toBase64Url(own.ed25519Public),
      x25519: toBase64Url(own.x25519Public),
    },
    { userId: contactId, ed25519: bound.ed25519, x25519: bound.x25519 },
  );
}

export async function requestLabel(name: string): Promise<string> {
  const { userId, vaultKey } = keys();
  return (await crypto()).sealLabel(vaultKey, userId, name);
}

export async function openRequestLabel(label: string): Promise<string> {
  const { userId, vaultKey } = keys();
  try {
    return await (await crypto()).openLabel(vaultKey, userId, label);
  } catch {
    return '…';
  }
}
