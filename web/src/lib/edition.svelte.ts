/**
 * v1.4.2: the kind of this instance (SPEC 16.6). A Tor-only instance has no notifications and
 * shows a pattern of onions instead of the world map behind every page. The server tells it at
 * `/api/edition`; the answer is remembered on the device, so the next visit shows the right
 * background at once. Until the first answer everything looks as on the web.
 */
const KEY = 'posteulen.edition';

export const edition = $state({ torOnly: false });

function show(torOnly: boolean): void {
  edition.torOnly = torOnly;
  document.documentElement.classList.toggle('tor-only', torOnly);
}

export function startEdition(): void {
  try {
    if (localStorage.getItem(KEY) === 'tor-only') show(true);
  } catch {
    // Without storage the answer of the server decides a moment later.
  }
  void fetch('/api/edition', { credentials: 'same-origin' })
    .then((response) =>
      response.ok ? (response.json() as Promise<{ torOnly?: unknown }>) : Promise.reject(),
    )
    .then((result) => {
      const torOnly = result.torOnly === true;
      show(torOnly);
      try {
        localStorage.setItem(KEY, torOnly ? 'tor-only' : 'web');
      } catch {
        // Remembered only for this visit.
      }
    })
    .catch(() => undefined);
}
