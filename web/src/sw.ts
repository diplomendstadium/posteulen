/**
 * Service worker (SPEC 15, D-08): caches only the app shell, never letter contents.
 * Push handling follows in Stufe 2.
 */
/** Replaced at build time by the posteulen-sw-manifest plugin. */
declare const __POSTEULEN_SHELL__: string;

/** Push texts from texts/de.ts, inlined at build time (a classic service worker cannot import). */
declare const __POSTEULEN_PUSH_TEXTS__: { testBody: string; letterBody: string; newsBody: string };
const PUSH_TEXTS = __POSTEULEN_PUSH_TEXTS__;

const sw = self as unknown as ServiceWorkerGlobalScope;
const BUILD = '__POSTEULEN_BUILD__';
const SHELL: readonly string[] = [__POSTEULEN_SHELL__];
const CACHE = `posteulen-shell-${BUILD}`;
const RUNTIME = `posteulen-assets-${BUILD}`;

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE && key !== RUNTIME) await caches.delete(key);
      }
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'skip-waiting') void sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== sw.location.origin) return;
  // API responses are never cached (SPEC 15).
  if (url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => (await caches.match('/')) ?? Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    // Hashed, immutable files: cache first. Owl images and fonts land in the runtime cache
    // only once they were actually needed (SPEC 9.2.6).
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        let response: Response;
        try {
          response = await fetch(event.request);
        } catch {
          // Offline or the page went away: a plain network error, no exception.
          return Response.error();
        }
        if (response.ok) {
          const cache = await caches.open(RUNTIME);
          await cache.put(event.request, response.clone());
        }
        return response;
      })(),
    );
  }
});

/**
 * Web Push (SPEC 11.2–11.4): every push shows a visible notification without names or content,
 * then confirms its ID to the server (background request, no session needed).
 */
sw.addEventListener('push', (event) => {
  let data: { id?: unknown; type?: unknown };
  try {
    data = (event.data?.json() ?? {}) as { id?: unknown; type?: unknown };
  } catch {
    data = {};
  }
  const body =
    data.type === 'push_test'
      ? PUSH_TEXTS.testBody
      : data.type === 'letter_arrived'
        ? PUSH_TEXTS.letterBody
        : PUSH_TEXTS.newsBody;
  const id = typeof data.id === 'string' && /^[A-Za-z0-9_-]{22}$/.test(data.id) ? data.id : null;
  event.waitUntil(
    (async () => {
      await sw.registration.showNotification('PostEulen', {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        lang: 'de',
        ...(id ? { tag: id } : {}),
      });
      if (id) {
        await fetch('/api/push/ack', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-posteulen': '1' },
          body: JSON.stringify({ id }),
          credentials: 'omit',
        }).catch(() => undefined);
      }
    })(),
  );
});

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows[0];
      if (existing) {
        await existing.focus();
        return;
      }
      await sw.clients.openWindow('/app');
    })(),
  );
});
