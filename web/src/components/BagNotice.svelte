<script lang="ts">
  /**
   * v1.3.1: the pouch (SPEC 9.1.6) – on top of the post office, „Meine Eulen“ and the rescue
   * centre, only while it holds owl biscuits or treats.
   */
  import { t, fill } from '../lib/i18n.svelte.ts';
  import { bag } from '../lib/purse.ts';

  const pouch = $derived(bag());
  const items = $derived(
    [
      pouch.biscuits === 1
        ? t.bag.biscuitsOne
        : pouch.biscuits > 1
          ? fill(t.bag.biscuits, { count: pouch.biscuits })
          : null,
      pouch.treats === 1
        ? t.bag.treatsOne
        : pouch.treats > 1
          ? fill(t.bag.treats, { count: pouch.treats })
          : null,
    ].filter((item): item is string => item !== null),
  );
</script>

{#if items.length > 0}
  <p class="notice bag" data-testid="bag-notice">
    <span aria-hidden="true">👝</span><span
      >{fill(t.bag.text, { items: items.join(t.bag.and) })}</span
    >
  </p>
{/if}

<style>
  .bag {
    margin: 0 0 1rem;
  }
</style>
