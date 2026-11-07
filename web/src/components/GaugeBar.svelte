<script lang="ts">
  /**
   * A bar from red (empty) to green (full), v0.5: energy and motivation of an owl. Decorative –
   * the value always stands next to it as text. Fill and colour are set through the CSSOM
   * (no inline style attribute, CSP).
   */
  let { share }: { share: number } = $props();
  let bar: HTMLSpanElement | undefined = $state();
  const clamped = $derived(Math.max(0, Math.min(1, share)));
  $effect(() => {
    if (!bar) return;
    bar.style.setProperty('--share', String(clamped));
    bar.style.setProperty('--hue', String(Math.round(clamped * 120)));
  });
</script>

<span class="gauge" aria-hidden="true"><span class="fill" bind:this={bar}></span></span>

<style>
  .gauge {
    display: block;
    width: 100%;
    max-width: 16rem;
    height: 0.9rem;
    border: 1px solid var(--line);
    border-radius: 0.45rem;
    background: var(--paper);
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    width: calc(var(--share, 0) * 100%);
    background: hsl(var(--hue, 0) 65% 42%);
  }
</style>
