/**
 * Service worker (SPEC 15, D-08): caches only the app shell, never letter contents.
 * Push handling follows in Stufe 2.
 */
/** Replaced at build time by the posteulen-sw-manifest plugin. */
declare const __POSTEULEN_SHELL__: string;

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
