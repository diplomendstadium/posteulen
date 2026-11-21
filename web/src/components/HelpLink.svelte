<script lang="ts">
  /**
   * v1.3: the question mark next to the language flag – a link to the help (SPEC 8.11), in the
   * wooden top bar of the app and above the public pages.
   */
  import { t } from '../lib/i18n.svelte.ts';
  import { linkHandler, route } from '../lib/router.svelte.ts';

  let { onwood = false }: { onwood?: boolean } = $props();
</script>

<a
  href="/hilfe"
  class="help"
  class:onwood
  aria-label={t.nav.help}
  title={t.nav.help}
  data-testid="help-link"
  aria-current={route.path === '/hilfe' ? 'page' : undefined}
  onclick={linkHandler}><span aria-hidden="true">?</span></a
>

<style>
  .help {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0.25rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
    box-shadow: var(--shadow);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
  }

  /* In the wooden top bar: no frame, like the flag (touch target 44 px, SPEC 14). */
  .help.onwood {
    padding: 0;
    background: transparent;
    border-color: transparent;
    box-shadow: none;
    color: var(--on-wood);
  }
</style>
