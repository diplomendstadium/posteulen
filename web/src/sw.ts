/**
 * Service worker (SPEC 15, D-08): caches only the app shell, never letter contents. Web Push
 * (SPEC 11.2–11.4): visible notification, receipt confirmed to the server, a tap opens the page
 * that fits the type.
 */
/** Replaced at build time by the posteulen-sw-manifest plugin. */
declare const __POSTEULEN_SHELL__: string;

/**
 * Push texts from texts/de.ts and texts/en.ts, inlined at build time (a classic service worker
 * cannot import). v0.4: one set per language; the push names the account's language.
 */
interface PushTexts {
  testBody: string;
  letterBody: string;
  goldBody: string;
  giftBody: string;
  chickBody: string;
  eggsBody: string;
  hatchedBody: string;
  deletionBody: string;
  broadcastBody: string;
  homeBody: string;
  /** v0.7 */
  homeLettersBody: string;
  /** v0.8.2 */
  restingBody: string;
  /** v1.2.4 */
  letterRestingBody: string;
  contactBody: string;
  donationBody: string;
  sickBody: string;
  newsBody: string;
}
declare const __POSTEULEN_PUSH_TEXTS__: { de: PushTexts; en: PushTexts };

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
        try {
          const cached = await caches.match(event.request);
          if (cached) return cached;
        } catch {
          // Cache unavailable: go to the network.
        }
        let response: Response;
        try {
          response = await fetch(event.request);
        } catch {
          // Offline or the page went away: a plain network error, no exception.
          return Response.error();
        }
        if (response.ok) {
          // Storing must never fail the response (a page that goes away mid-download aborts the
          // copy; Firefox reported rejected promises here as errors of the service worker).
          try {
            const copy = response.clone();
            const store = caches
              .open(RUNTIME)
              .then((cache) => cache.put(event.request, copy))
              .catch(() => undefined);
            try {
              event.waitUntil(store);
            } catch {
              // The event is already finished; the copy is stored anyway or not at all.
            }
          } catch {
            // Body already in use: just do not cache it.
          }
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
  let data: { id?: unknown; type?: unknown; lang?: unknown };
  try {
    data = (event.data?.json() ?? {}) as { id?: unknown; type?: unknown; lang?: unknown };
  } catch {
    data = {};
  }
  const lang = data.lang === 'en' ? 'en' : 'de';
  const PUSH_TEXTS = __POSTEULEN_PUSH_TEXTS__[lang];
  const bodies: Record<string, string> = {
    push_test: PUSH_TEXTS.testBody,
    letter_arrived: PUSH_TEXTS.letterBody,
    gold_arrived: PUSH_TEXTS.goldBody,
    owl_gift: PUSH_TEXTS.giftBody,
    chick_gift: PUSH_TEXTS.chickBody,
    eggs_laid: PUSH_TEXTS.eggsBody,
    chicks_hatched: PUSH_TEXTS.hatchedBody,
    deletion_warning: PUSH_TEXTS.deletionBody,
    broadcast: PUSH_TEXTS.broadcastBody,
    owl_home: PUSH_TEXTS.homeBody,
    owl_home_letters: PUSH_TEXTS.homeLettersBody,
    owl_resting: PUSH_TEXTS.restingBody,
    letter_resting: PUSH_TEXTS.letterRestingBody,
    contact_confirmed: PUSH_TEXTS.contactBody,
    donation: PUSH_TEXTS.donationBody,
    owl_sick: PUSH_TEXTS.sickBody,
  };
  const body =
    typeof data.type === 'string' && Object.hasOwn(bodies, data.type)
      ? (bodies[data.type] ?? PUSH_TEXTS.newsBody)
      : PUSH_TEXTS.newsBody;
  const id = typeof data.id === 'string' && /^[A-Za-z0-9_-]{22}$/.test(data.id) ? data.id : null;
  // Show the notification and confirm receipt independently: a display problem must not
  // hide that the push arrived (SPEC 11.4).
  event.waitUntil(
    Promise.allSettled([
      sw.registration.showNotification('PostEulen', {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        lang,
        data: { url: pushTarget(data.type) },
        ...(id ? { tag: id } : {}),
      }),
      id
        ? fetch('/api/push/ack', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-posteulen': '1' },
            body: JSON.stringify({ id }),
            credentials: 'omit',
          })
        : Promise.resolve(),
    ]),
  );
});

/**
 * v1.2.4: the page a tap on a push opens, by its type only – the payload carries no IDs of
 * conversations or owls (SPEC 11.2): letters to the conversations, owl events to the owls,
 * a new contact to the address book, everything else to the system messages.
 */
const PUSH_TARGETS: Record<string, string> = {
  letter_arrived: '/app/briefe',
  letter_resting: '/app/briefe',
  owl_resting: '/app/briefe',
  owl_home_letters: '/app/briefe',
  owl_home: '/app/eulen',
  owl_gift: '/app/eulen',
  chick_gift: '/app/eulen',
  eggs_laid: '/app/eulen',
  chicks_hatched: '/app/eulen',
  owl_sick: '/app/rettungsstation/innen',
  contact_confirmed: '/app/adressbuch',
  gold_arrived: '/app/briefe/system',
  deletion_warning: '/app/briefe/system',
  broadcast: '/app/briefe/system',
  donation: '/app/briefe/system',
  push_test: '/app/einstellungen',
};

function pushTarget(type: unknown): string {
  return typeof type === 'string' && Object.hasOwn(PUSH_TARGETS, type)
    ? (PUSH_TARGETS[type] ?? '/app')
    : '/app';
}

sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: unknown } | null;
  // Only the fixed paths above – nothing from outside decides where a tap leads.
  const url =
    typeof data?.url === 'string' && Object.values(PUSH_TARGETS).includes(data.url)
      ? data.url
      : '/app';
  event.waitUntil(
    (async () => {
      const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows[0];
      if (existing) {
        // The open app goes to the page itself (client-side router, no reload).
        existing.postMessage({ type: 'open', url });
        await existing.focus();
        return;
      }
      await sw.clients.openWindow(url);
    })(),
  );
});
