/**
 * Local key storage for "stay logged in" (SPEC 5.5): private keys and the vault key live in
 * IndexedDB, additionally wrapped with a non-extractable WebCrypto AES-GCM key. The master
 * key is never stored locally. Decrypted letters are never stored at all.
 *
 * Account switches (SPEC 5.5): all operations of this page run one after another (a queue), each
 * waits until its transaction is complete, and deleting is bound to an account – a late clean-up
 * of account A can never delete the keys account B stored in the meantime (also from another
 * tab: the check and the delete run in the same transaction).
 */
import type { UnlockedAccount } from '@posteulen/shared/crypto/keypackage.ts';

const DB_NAME = 'posteulen';
const STORE = 'keys';
const RECORD = 'account';

export interface LocalKeys {
  readonly userId: string;
  readonly ed25519Secret: Uint8Array;
  readonly x25519Secret: Uint8Array;
  readonly ed25519Public: Uint8Array;
  readonly x25519Public: Uint8Array;
  readonly vaultKey: Uint8Array;
}

interface StoredRecord {
  readonly userId: string;
  readonly key: CryptoKey;
  readonly iv: Uint8Array;
  readonly data: ArrayBuffer;
}

/** Test hook: an IndexedDB stand-in with artificial delays (web/test). */
let factory: () => IDBFactory = () => indexedDB;
export function setIndexedDbForTests(replacement: (() => IDBFactory) | null): void {
  factory = replacement ?? (() => indexedDB);
  queue = Promise.resolve();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory().open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB'));
  });
}

/** One operation after the other – no read can overtake a write of the same page. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

/**
 * Runs `run` in one transaction and resolves only once the transaction is complete (not just
 * the request): only then is a write really stored or a delete really done.
 */
async function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, done: (value: T) => void) => void,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result: T | undefined;
      let set = false;
      tx.oncomplete = () => (set ? resolve(result as T) : reject(new Error('indexedDB')));
      tx.onerror = () => reject(tx.error ?? new Error('indexedDB'));
      tx.onabort = () => reject(tx.error ?? new Error('indexedDB'));
      run(tx.objectStore(STORE), (value) => {
        result = value;
        set = true;
      });
    });
  } finally {
    db.close();
  }
}

const SIZES = [64, 32, 32, 32, 32] as const;

export function saveKeys(userId: string, account: UnlockedAccount): Promise<void> {
  return serial(async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    const parts = [
      account.identity.ed25519Secret,
      account.identity.x25519Secret,
      account.identity.ed25519Public,
      account.identity.x25519Public,
      account.vaultKey,
    ];
    const plain = new Uint8Array(SIZES.reduce((a, b) => a + b, 0));
    let offset = 0;
    parts.forEach((part) => {
      plain.set(part, offset);
      offset += part.length;
    });
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) },
      key,
      plain,
    );
    plain.fill(0);
    const record: StoredRecord = { userId, key, iv, data };
    await transact<boolean>('readwrite', (store, done) => {
      store.put(record, RECORD).onsuccess = () => done(true);
    });
  });
}

/**
 * The stored keys – only if they belong to `expectedUserId` (when given). Keys of another
 * account are never returned: a profile of B is never used with keys of A.
 */
export function loadKeys(expectedUserId?: string): Promise<LocalKeys | null> {
  return serial(async () => {
    const record = await transact<StoredRecord | undefined>('readonly', (store, done) => {
      const request = store.get(RECORD);
      request.onsuccess = () => done(request.result as StoredRecord | undefined);
    });
    if (!record) return null;
    if (expectedUserId !== undefined && record.userId !== expectedUserId) return null;
    try {
      const plain = new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: record.iv as BufferSource,
            additionalData: new TextEncoder().encode(record.userId),
          },
          record.key,
          record.data,
        ),
      );
      const part = (index: number): Uint8Array => {
        const start = SIZES.slice(0, index).reduce((a, b) => a + b, 0);
        return plain.slice(start, start + (SIZES[index] ?? 0));
      };
      const keys = {
        userId: record.userId,
        ed25519Secret: part(0),
        x25519Secret: part(1),
        ed25519Public: part(2),
        x25519Public: part(3),
        vaultKey: part(4),
      };
      plain.fill(0);
      return keys;
    } catch {
      // Unusable record: deleted – but only if it is still the same one.
      await deleteIfOwner(record.userId);
      return null;
    }
  });
}

function deleteIfOwner(userId: string): Promise<boolean> {
  return transact<boolean>('readwrite', (store, done) => {
    const request = store.get(RECORD);
    request.onsuccess = () => {
      const record = request.result as StoredRecord | undefined;
      if (!record || record.userId !== userId) {
        done(false);
        return;
      }
      store.delete(RECORD).onsuccess = () => done(true);
    };
  });
}

/**
 * Logout, expired session, login elsewhere, deleted account (SPEC 5.5): the keys of exactly
 * this account go. Keys another account stored in the meantime stay.
 */
export function clearKeys(userId: string): Promise<boolean> {
  return serial(() => deleteIfOwner(userId));
}
