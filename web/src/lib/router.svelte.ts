/** Minimal History-API router (ARCHITECTURE 9): no dependency, no hash URLs. */
export const route = $state({ path: normalize(location.pathname) });

function normalize(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

export function navigate(path: string, replace = false): void {
  const target = normalize(path);
  if (target === route.path) return;
  if (replace) history.replaceState(null, '', target);
  else history.pushState(null, '', target);
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
  navigate(anchor.pathname);
}
