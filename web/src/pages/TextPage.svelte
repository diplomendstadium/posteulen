<script lang="ts">
  /**
   * Help, privacy policy and imprint (SPEC 8.11): text from `shared/texts`, always rendered as
   * text (links via LetterText, SPEC 6), with a table of contents for longer pages.
   */
  import { t } from '../lib/i18n.svelte.ts';
  import type { HelpQuestion, HelpSection } from '@posteulen/shared/texts/help.ts';
  import { onMount } from 'svelte';
  import Link from '../components/Link.svelte';
  import LetterText from '../components/LetterText.svelte';
  import { scrollToHash } from '../lib/router.svelte.ts';

  let {
    title,
    intro,
    sections,
    faq = [],
  }: {
    title: string;
    intro: string;
    sections: readonly HelpSection[];
    faq?: readonly HelpQuestion[];
  } = $props();

  const showContents = $derived(sections.length > 4);

  // Opened with an anchor (e.g. /hilfe#benachrichtigungen): the page renders after start-up.
  onMount(() => scrollToHash());
</script>

<div class="page">
  <p class="plate"><Link href="/" class="back">← {t.app.back}</Link></p>
  <header class="card head">
    <h1 id="top" tabindex="-1">
      {title}
    </h1>
    <p class="intro">{intro}</p>
  </header>

  {#if showContents}
    <nav class="contents card" aria-labelledby="contents-title">
      <h2 id="contents-title">{t.pages.contents}</h2>
      <ol>
        {#each sections as section (section.id)}
          <li><a href="#{section.id}">{section.title}</a></li>
        {/each}
        {#if faq.length > 0}
          <li><a href="#fragen">{t.pages.faqTitle}</a></li>
        {/if}
      </ol>
    </nav>
  {/if}

  {#each sections as section (section.id)}
    <section class="section card" aria-labelledby={section.id}>
      <h2 id={section.id} tabindex="-1">{section.title}</h2>
      {#each section.blocks as block, index (index)}
        {#if typeof block === 'string'}
          <div class="block"><LetterText text={block} /></div>
        {:else}
          <ul class="block">
            {#each block as item, itemIndex (itemIndex)}
              <li>{item}</li>
            {/each}
          </ul>
        {/if}
      {/each}
    </section>
  {/each}

  {#if faq.length > 0}
    <section class="section card" aria-labelledby="fragen">
      <h2 id="fragen" tabindex="-1">{t.pages.faqTitle}</h2>
      <dl class="faq">
        {#each faq as item (item.question)}
          <dt>{item.question}</dt>
          <dd>{item.answer}</dd>
        {/each}
      </dl>
    </section>
  {/if}

  {#if showContents}
    <p class="top plate"><a href="#top">↑ {t.pages.toTop}</a></p>
  {/if}
</div>

<style>
  .page {
    max-width: 44rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  .page :global(.back),
  .contents a,
  .top a {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
  }

  h1:focus,
  h2:focus {
    outline: none;
  }

  .intro {
    font-size: 1.05rem;
    margin: 0;
  }

  .head {
    margin-top: 0.5rem;
  }

  .contents {
    margin: 1.5rem 0 2rem;
  }

  .contents h2 {
    font-size: 1.15rem;
  }

  .contents ol {
    margin: 0;
    padding-left: 1.5rem;
  }

  .section {
    margin-top: 1.25rem;
    scroll-margin-top: 1rem;
  }

  .section > :last-child {
    margin-bottom: 0;
  }

  .section h2 {
    scroll-margin-top: 1rem;
    border-bottom: 1px solid var(--line);
    padding-bottom: 0.35rem;
  }

  .block {
    margin: 0 0 0.85rem;
  }

  ul.block {
    padding-left: 1.5rem;
  }

  ul.block li + li {
    margin-top: 0.35rem;
  }

  .faq dt {
    font-weight: 700;
    margin-top: 1rem;
  }

  .faq dd {
    margin: 0.25rem 0 0;
  }

  .top {
    margin-top: 2rem;
  }
</style>
