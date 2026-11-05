<script lang="ts">
  import { de } from '@posteulen/shared/texts/de.ts';
  import Link from '../components/Link.svelte';

  let { title, draft = false }: { title: string; draft?: boolean } = $props();
</script>

<div class="page">
  <p><Link href="/" class="back">← {de.app.back}</Link></p>
  <h1>
    {title}{#if draft}<span class="draft"> ({de.pages.privacyDraft})</span>{/if}
  </h1>
  <p class="notice"><span aria-hidden="true">ℹ</span><span>{de.app.comingSoon}</span></p>
</div>

<style>
  .page {
    max-width: 44rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  .page :global(.back) {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    min-width: 2.75rem;
  }

  .draft {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--ink-soft);
  }
</style>
