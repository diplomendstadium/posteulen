/**
 * v1.3.2: the cursor starts in the first field of a login (SPEC 8.1, 13, 10.12) – the user name
 * on the start page, the password in the admin panel and the bots control centre – but only on
 * devices without a touchscreen: on phones and tablets the keyboard would pop up at once and
 * cover half the page. A Svelte action (`use:autofocus`), with the window injectable for tests.
 */

interface Focusable {
  focus(options?: { preventScroll?: boolean }): void;
}

interface MediaWindow {
  matchMedia(query: string): { readonly matches: boolean };
}

/** Whether the device has any touch pointer (finger): then no automatic focus. */
export function hasTouchscreen(view: MediaWindow | undefined): boolean {
  if (!view || typeof view.matchMedia !== 'function') return true;
  return view.matchMedia('(any-pointer: coarse)').matches;
}

export function autofocus(
  element: Focusable,
  view: MediaWindow | undefined = globalThis as unknown as MediaWindow,
): void {
  if (!hasTouchscreen(view)) element.focus({ preventScroll: true });
}
