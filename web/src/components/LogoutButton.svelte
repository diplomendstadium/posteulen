<script lang="ts">
  /**
   * v1.3.2: the power button at the right end of the wooden top bar (SPEC 8.3) – signs out after
   * asking once (like "Abmelden" in the settings: all keys on this device are deleted). A drawn
   * symbol, because many system fonts lack the power sign ⏻.
   */
  import { t } from '../lib/i18n.svelte.ts';
  import { logout } from '../lib/auth.svelte.ts';
  import { navigate } from '../lib/router.svelte.ts';

  let busy = false;

  async function signOut(): Promise<void> {
    if (busy || !confirm(t.app.logoutConfirm)) return;
    busy = true;
    try {
      await logout();
      navigate('/', true);
    } finally {
      busy = false;
    }
  }
</script>

<button
  type="button"
  class="power"
  aria-label={t.app.logout}
  title={t.app.logout}
  data-testid="logout-button"
  onclick={() => void signOut()}
>
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
    focusable="false"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
  >
    <path d="M12 3v8" />
    <path d="M7.05 6.05a8 8 0 1 0 9.9 0" />
  </svg>
</button>

<style>
  /* Like the flag and the question mark on wood: no frame, touch target 44 px (SPEC 14). */
  .power {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: transparent;
    color: var(--on-wood);
    cursor: pointer;
  }

  .power svg {
    display: block;
  }
</style>
