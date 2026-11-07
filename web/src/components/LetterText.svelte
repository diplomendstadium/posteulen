<script lang="ts">
  /**
   * Letter text: always as text; only http(s) links are clickable, shown in full (SPEC 6).
   * Links always use the plain body font, also in handwritten letters, so that look-alike
   * characters (I, l, 1, O, 0) stay distinguishable. v0.6.1: an address with unusual
   * characters shows its technical form and a warning.
   */
  import { linkify } from '../lib/format.ts';
  import { t } from '../lib/i18n.svelte.ts';

  let { text }: { text: string } = $props();
  const parts = $derived(linkify(text));
</script>

<p class="text">
  {#each parts as part, index (index)}
    {#if part.href}<a href={part.href} target="_blank" rel="noopener noreferrer nofollow"
        >{part.text}</a
      >{#if part.suspicious}
        <span class="link-warning"><span aria-hidden="true">⚠</span> {t.letters.linkWarning}</span
        >{/if}{:else}{part.text}{/if}
  {/each}
</p>

<style>
  .text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin: 0;
  }

  .text a,
  .link-warning {
    font-family: var(--font-body);
    font-size: 1rem;
  }

  .link-warning {
    color: var(--seal);
    font-weight: 700;
  }
</style>
