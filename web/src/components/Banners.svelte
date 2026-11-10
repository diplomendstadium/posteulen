<script lang="ts">
  /**
   * v0.8.2: timed banners of the admin (SPEC 13 item 11) – shown like the notification hint to
   * every signed-in account until they end; each can be hidden on this device with ✕.
   */
  import { live } from '../lib/live.svelte.ts';
  import { t } from '../lib/i18n.svelte.ts';
  import LetterText from './LetterText.svelte';

  const KEY = 'posteulen.banners.hidden';

  function stored(): string[] {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  let hidden = $state<string[]>(stored());
  const shown = $derived(live.banners.filter((banner) => !hidden.includes(banner.id)));

  function hide(id: string): void {
    // Only ids of banners that still run are kept.
    hidden = [...hidden.filter((other) => live.banners.some((b) => b.id === other)), id];
    try {
      localStorage.setItem(KEY, JSON.stringify(hidden));
    } catch {
      // Without storage the banner comes back with the next visit.
    }
  }
</script>

{#each shown as banner (banner.id)}
  <div class="banner" role="status" data-testid="admin-banner">
    <span aria-hidden="true">📯</span>
    <LetterText text={banner.text} />
    <button class="hide" type="button" onclick={() => hide(banner.id)}
      ><span aria-hidden="true">✕</span><span class="visually-hidden">{t.banner.hide}</span></button
    >
  </div>
{/each}

<style>
  .banner {
    margin: 0;
    padding: 0.25rem 0.5rem 0.25rem 1rem;
    background: var(--parchment-deep);
    border-top: 1px solid var(--wood);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
  }

  .banner :global(.text) {
    flex: 0 1 auto;
  }

  .hide {
    min-width: 2.75rem;
    min-height: 2.75rem;
    border: none;
    background: none;
    color: var(--ink-soft);
    font: inherit;
    cursor: pointer;
    flex: none;
  }
</style>
