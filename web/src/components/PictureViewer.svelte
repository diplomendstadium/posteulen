<script lang="ts">
  /**
   * v0.8.5: a picture of a bot letter, filling the window until it is closed by a tap, a click
   * or Escape (SPEC 8.4). The whole layer is one button, so keyboard and screen readers can
   * close it too; focus returns to the picture that opened it.
   */
  import { onMount } from 'svelte';
  import { t } from '../lib/i18n.svelte.ts';

  let { src, alt, onclose }: { src: string; alt: string; onclose: () => void } = $props();

  let button = $state<HTMLButtonElement>();

  onMount(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    button?.focus();
    return () => opener?.focus();
  });

  function keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onclose();
    }
  }
</script>

<svelte:window onkeydown={keydown} />

<div class="viewer" role="dialog" aria-modal="true" aria-label={alt} data-testid="picture-viewer">
  <button bind:this={button} type="button" class="close" onclick={onclose}>
    <img {src} {alt} />
    <span class="visually-hidden">{t.bots.pictureClose}</span>
  </button>
</div>

<style>
  .viewer {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgb(20 14 8 / 92%);
  }

  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: max(0.5rem, env(safe-area-inset-top)) max(0.5rem, env(safe-area-inset-right))
      max(0.5rem, env(safe-area-inset-bottom)) max(0.5rem, env(safe-area-inset-left));
    border: none;
    background: none;
    cursor: zoom-out;
  }

  .close:focus-visible {
    outline: 3px solid var(--paper);
    outline-offset: -6px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
