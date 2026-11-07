/** Minimal History-API router (SPEC Anhang L.6): no dependency, no hash URLs. */
export const route = $state({ path: normalize(location.pathname) });

function normalize(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** Scrolls to the element named by the URL fragment, if any (pages render after start-up). */
export function scrollToHash(): void {
  let id: string;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return; // malformed fragment, e.g. "#%E0"
  }
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView();
  target.focus({ preventScroll: true });
}

export function navigate(path: string, replace = false): void {
  const [pathname = '', hash = ''] = path.split('#', 2);
  const target = normalize(pathname);
  const url = hash ? `${target}#${hash}` : target;
  if (target === route.path && !hash) return;
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  if (target === route.path) {
    scrollToHash();
    return;
  }
  route.path = target;
  window.scrollTo(0, 0);
  document.getElementById('main')?.focus({ preventScroll: true });
}

window.addEventListener('popstate', () => {
  route.path = normalize(location.pathname);
});

/** Click handler for internal links: keeps modifier clicks and new tabs working. */
export function linkHandler(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.currentTarget as HTMLElement).closest('a');
  if (!anchor || anchor.target === '_blank') return;
  // Plain anchor properties instead of a URL object: nothing here needs to be reactive.
  if (anchor.origin !== location.origin) return;
  event.preventDefault();
  navigate(anchor.pathname + anchor.hash);
}
