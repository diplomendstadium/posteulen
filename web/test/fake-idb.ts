/**
 * A tiny IndexedDB stand-in for the key store tests: one database, object stores as Maps,
 * every request completes only when the test lets it (`gate`), so delayed IndexedDB work can be
 * ordered deterministically. Transactions complete after all their requests succeeded.
 */

type Gate = (operation: string) => Promise<void>;

class FakeRequest<T> {
  result: T | undefined;
  error: Error | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onupgradeneeded: (() => void) | null = null;
}

class FakeTransaction {
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  error: Error | null = null;
  private pending = 0;
  private finished = false;

  constructor(
    private readonly data: Map<string, Map<string, unknown>>,
    private readonly gate: Gate,
    readonly log: string[],
  ) {}

  objectStore(name: string) {
    const store = this.data.get(name);
    if (!store) throw new Error(`no store ${name}`);
    const run = <T>(operation: string, work: () => T): FakeRequest<T> => {
      const request = new FakeRequest<T>();
      this.pending++;
      void this.gate(operation).then(() => {
        request.result = work();
        this.log.push(operation);
        request.onsuccess?.();
        this.pending--;
        // Like IndexedDB: the transaction completes once no request is pending any more
        // (requests started in onsuccess keep it open).
        queueMicrotask(() => this.maybeComplete());
      });
      return request;
    };
    return {
      get: (key: string) => run(`get:${key}`, () => store.get(key)),
      put: (value: unknown, key: string) =>
        run(`put:${key}`, () => {
          store.set(key, value);
          return key;
        }),
      delete: (key: string) =>
        run(`delete:${key}`, () => {
          store.delete(key);
          return undefined;
        }),
    };
  }

  private maybeComplete(): void {
    if (this.pending > 0 || this.finished) return;
    this.finished = true;
    this.oncomplete?.();
  }
}

export function fakeIndexedDb(gate: Gate = () => Promise.resolve()) {
  const data = new Map<string, Map<string, unknown>>();
  const log: string[] = [];
  const db = {
    createObjectStore(name: string) {
      data.set(name, new Map());
    },
    transaction(_store: string, _mode: string) {
      return new FakeTransaction(data, gate, log);
    },
    close() {},
  };
  const factory = {
    open(_name: string, _version: number) {
      const request = new FakeRequest<typeof db>();
      setTimeout(() => {
        request.result = db;
        if (data.size === 0) request.onupgradeneeded?.();
        request.onsuccess?.();
      }, 0);
      return request;
    },
  };
  return { factory: factory as unknown as IDBFactory, data, log };
}
