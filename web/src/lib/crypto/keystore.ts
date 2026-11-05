/**
 * Local key storage for "stay logged in" (SPEC 5.5): private keys and the vault key live in
 * IndexedDB, additionally wrapped with a non-extractable WebCrypto AES-GCM key. The master
 * key is never stored locally. Decrypted letters are never stored at all.
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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDB'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error ?? new Error('indexedDB'));
    });
  } finally {
    db.close();
  }
}

const SIZES = [64, 32, 32, 32, 32] as const;

export async function saveKeys(userId: string, account: UnlockedAccount): Promise<void> {
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
  await withStore('readwrite', (store) => store.put(record, RECORD));
}

export async function loadKeys(): Promise<LocalKeys | null> {
  const record = await withStore<StoredRecord | undefined>('readonly', (store) =>
    store.get(RECORD),
  );
  if (!record) return null;
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
    await clearKeys();
    return null;
  }
}

/** Logout, expired session, login elsewhere, deleted account: everything local goes (SPEC 5.5). */
export async function clearKeys(): Promise<void> {
  await withStore('readwrite', (store) => store.delete(RECORD));
}
