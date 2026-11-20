/**
 * Key store and account switches (SPEC 5.5): delayed IndexedDB work of account A never deletes
 * or replaces the keys account B stored in the meantime; keys are only returned for the account
 * they belong to.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { clearKeys, loadKeys, saveKeys, setIndexedDbForTests } from '../src/lib/crypto/keystore.ts';
import { fakeIndexedDb } from './fake-idb.ts';

function account(fill: number) {
  const bytes = (length: number) => new Uint8Array(length).fill(fill);
  return {
    identity: {
      ed25519Secret: bytes(64),
      x25519Secret: bytes(32),
      ed25519Public: bytes(32),
      x25519Public: bytes(32),
    },
    vaultKey: bytes(32),
    masterKey: bytes(32),
  } as unknown as Parameters<typeof saveKeys>[1];
}

/** A gate that holds every operation whose name starts with `prefix` until released. */
function holdingGate(prefix: string) {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  return {
    gate: (operation: string) => (operation.startsWith(prefix) ? held : Promise.resolve()),
    release: () => release(),
  };
}

afterEach(() => setIndexedDbForTests(null));

describe('key store with account switches', () => {
  it('a delayed clean-up of A does not delete the keys B stored afterwards', async () => {
    const { gate, release } = holdingGate('delete');
    const idb = fakeIndexedDb(gate);
    setIndexedDbForTests(() => idb.factory);
    await saveKeys('A', account(1));
    const clearingA = clearKeys('A');
    const savingB = saveKeys('B', account(2));
    // A's delete is stuck in IndexedDB; B's save waits behind it instead of overtaking.
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    await clearingA;
    await savingB;
    const keys = await loadKeys('B');
    expect(keys?.userId).toBe('B');
    expect(keys?.vaultKey[0]).toBe(2);
  });

  it('a clean-up of A arriving after B signed in changes nothing', async () => {
    const idb = fakeIndexedDb();
    setIndexedDbForTests(() => idb.factory);
    await saveKeys('A', account(1));
    await saveKeys('B', account(2));
    expect(await clearKeys('A')).toBe(false);
    expect((await loadKeys('B'))?.userId).toBe('B');
  });

  it('keys of another account are never returned for a profile', async () => {
    const idb = fakeIndexedDb();
    setIndexedDbForTests(() => idb.factory);
    await saveKeys('A', account(1));
    expect(await loadKeys('B')).toBeNull();
    expect((await loadKeys('A'))?.userId).toBe('A');
    // Nothing was deleted by the refused read.
    expect((await loadKeys())?.userId).toBe('A');
  });

  it('saving resolves only once the transaction is complete', async () => {
    const { gate, release } = holdingGate('put');
    const idb = fakeIndexedDb(gate);
    setIndexedDbForTests(() => idb.factory);
    let done = false;
    const saving = saveKeys('A', account(1)).then(() => (done = true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(done).toBe(false);
    release();
    await saving;
    expect(idb.log).toContain('put:account');
  });

  it('clearing the own keys removes them', async () => {
    const idb = fakeIndexedDb();
    setIndexedDbForTests(() => idb.factory);
    await saveKeys('A', account(1));
    expect(await clearKeys('A')).toBe(true);
    expect(await loadKeys()).toBeNull();
  });
});
