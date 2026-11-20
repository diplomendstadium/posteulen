/**
 * Contact vault in the browser (SPEC 5.7): binds contacts' public keys, compares them before
 * sending and when showing letters, reports deviations, marks separated contacts. The logic is
 * in `vault-core.ts`; every operation belongs to the account context it started in (SPEC 5.5).
 */
import type { KeySet } from '@posteulen/shared/crypto/vault.ts';
import { api } from './api.ts';
import { account, onSignOut } from './auth.svelte.ts';
import { currentContext, requireContext, type AccountContext } from './context.ts';
import { createVault, type ServerKeys, type VaultState } from './vault-core.ts';

export type { StoredEntry } from './vault-core.ts';

export const vault = $state<VaultState>({
  entries: {},
  loaded: false,
  synced: false,
  changedKeys: [],
});

const vaultCrypto = () => import('@posteulen/shared/crypto/vault.ts');

const core = createVault({
  state: vault,
  api,
  crypto: vaultCrypto,
  keysFor: (context) => {
    const keys = account.keys;
    const profile = account.profile;
    if (!keys || !profile || profile.id !== context.accountId || keys.userId !== context.accountId)
      return null;
    return { userId: keys.userId, vaultKey: keys.vaultKey };
  },
  now: () => Date.now(),
});

// The decrypted vault belongs to the account context – it goes with every change of it.
onSignOut(() => core.reset());

export function loadVault(context: AccountContext = requireContext()): Promise<void> {
  return core.loadVault(context);
}

export function syncVault(
  contacts: readonly { userId: string }[],
  context: AccountContext = requireContext(),
): Promise<void> {
  return core.syncVault(context, contacts);
}

export function whenVaultSynced(
  context: AccountContext = requireContext(),
  timeoutMs?: number,
): Promise<boolean> {
  return core.whenSynced(context, timeoutMs);
}

export function currentKeySet(contactId: string): KeySet | undefined {
  return core.currentKeySet(contactId);
}

export function keysMatch(
  contactId: string,
  serverKeys: ServerKeys,
  context: AccountContext = requireContext(),
): Promise<boolean> {
  return core.keysMatch(context, contactId, serverKeys);
}

export function checkKeysOnDisplay(
  contactId: string,
  context: AccountContext = requireContext(),
): Promise<void> {
  return core.checkKeysOnDisplay(context, contactId);
}

export function markCompared(contactId: string): Promise<void> {
  return core.markCompared(requireContext(), contactId);
}

export async function safetyNumberWith(contactId: string): Promise<string | null> {
  const context = currentContext();
  const own = account.keys;
  const bound = currentKeySet(contactId);
  if (!context || !own || own.userId !== context.accountId || !bound) return null;
  const { safetyNumber } = await vaultCrypto();
  const { toBase64Url } = await import('@posteulen/shared/crypto/encoding.ts');
  return safetyNumber(
    {
      userId: context.accountId,
      ed25519: toBase64Url(own.ed25519Public),
      x25519: toBase64Url(own.x25519Public),
    },
    { userId: contactId, ed25519: bound.ed25519, x25519: bound.x25519 },
  );
}

export async function requestLabel(name: string): Promise<string> {
  const { userId, vaultKey } = core.keysOf(requireContext());
  return (await vaultCrypto()).sealLabel(vaultKey, userId, name);
}

export async function openRequestLabel(label: string): Promise<string> {
  try {
    const { userId, vaultKey } = core.keysOf(requireContext());
    return await (await vaultCrypto()).openLabel(vaultKey, userId, label);
  } catch {
    return '…';
  }
}
