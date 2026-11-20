/**
 * Authentication changes between tabs and windows of the same browser (SPEC 5.5): one tab signs
 * in or out, the others drop their account state and check the session again. Only the fact
 * "authentication changed" is sent – never an account ID, key or session token.
 *
 * BroadcastChannel where available (feature detection); otherwise the `storage` event of
 * localStorage (older Safari). Without either, the server's account binding (409
 * account_mismatch) and the check on returning to the page catch the switch.
 */
const CHANNEL = 'posteulen-auth';
const STORAGE_KEY = 'posteulen.authChanged';

let channel: BroadcastChannel | null = null;
let listening = false;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY) notifyListeners();
}

function listen(): void {
  if (listening) return;
  listening = true;
  try {
    if (typeof BroadcastChannel === 'function') {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (event: MessageEvent<unknown>) => {
        if (event.data === 'changed') notifyListeners();
      };
      return;
    }
  } catch {
    channel = null;
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
}

/** Another tab changed the authentication. */
export function onAuthChangedElsewhere(listener: () => void): void {
  listeners.add(listener);
  listen();
}

/** Tells the other tabs that this one signed in or out. */
export function announceAuthChange(): void {
  listen();
  if (channel) {
    try {
      channel.postMessage('changed');
      return;
    } catch {
      // Closed channel: fall back to storage below.
    }
  }
  try {
    // A changing value: the storage event only fires on a change.
    localStorage.setItem(STORAGE_KEY, `${Date.now()}-${Math.random()}`);
  } catch {
    // Without storage the server's account binding still protects the other tabs.
  }
}
