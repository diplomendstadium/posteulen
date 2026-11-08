/**
 * Opening a conversation shows its latest message, not the oldest one (v0.4). Called after
 * the list has rendered; `smooth` only for later updates such as a letter just sent.
 *
 * The page is scrolled so that the latest message ends just above the bottom navigation.
 * A message taller than the visible area is shown from its beginning instead, so it can be
 * read from the top. Fonts are awaited first: handwriting fonts change the height of letters.
 */
export async function scrollToLatest(list: HTMLElement | undefined, smooth = false): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    // No font loading API: scroll right away.
  }
  const last = list?.lastElementChild;
  if (!(last instanceof HTMLElement)) return;
  const top = document.querySelector('.topbar')?.getBoundingClientRect().height ?? 0;
  const bottom = document.querySelector('[data-bottom-nav]')?.getBoundingClientRect().height ?? 0;
  const gap = 12;
  const visible = window.innerHeight - top - bottom - 2 * gap;
  const rect = last.getBoundingClientRect();
  const target =
    rect.height > visible
      ? window.scrollY + rect.top - top - gap
      : window.scrollY + rect.bottom - (window.innerHeight - bottom - gap);
  window.scrollTo({ top: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' });
}

/**
 * v0.7: opening a conversation with unread letters starts at the beginning of the oldest
 * unread one, just below the status bar.
 */
export async function scrollToLetter(list: HTMLElement | undefined, id: string): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    // No font loading API: scroll right away.
  }
  const item = list?.querySelector(`[data-letter-id="${CSS.escape(id)}"]`);
  if (!(item instanceof HTMLElement)) return;
  const top = document.querySelector('.topbar')?.getBoundingClientRect().height ?? 0;
  const gap = 12;
  const target = window.scrollY + item.getBoundingClientRect().top - top - gap;
  window.scrollTo({ top: Math.max(0, target), behavior: 'auto' });
}
