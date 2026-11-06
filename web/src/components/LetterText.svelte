<script lang="ts">
  /**
   * Letter text: always as text; only http(s) links are clickable, shown in full (SPEC 6).
   * Links always use the plain body font, also in handwritten letters, so that look-alike
   * characters (I, l, 1, O, 0) stay distinguishable.
   */
  import { linkify } from '../lib/format.ts';

  let { text }: { text: string } = $props();
  const parts = $derived(linkify(text));
</script>

<p class="text">
  {#each parts as part, index (index)}
    {#if part.href}<a href={part.href} target="_blank" rel="noopener noreferrer nofollow"
        >{part.text}</a
      >{:else}{part.text}{/if}
  {/each}
</p>

<style>
  .text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin: 0;
  }

  .text a {
    font-family: var(--font-body);
    font-size: 1rem;
  }
</style>
