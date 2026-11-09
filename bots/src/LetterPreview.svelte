<script lang="ts">
  /**
   * v0.8: the planned letter as players will see it (SPEC 10.12): parchment of the right size,
   * the bot's handwriting, the pictures below the letter, language and version chosen above.
   */
  import { LETTER } from '@posteulen/shared/constants.ts';
  import { fill, t } from '../../admin/src/lib/i18n.svelte.ts';
  import parchment from '../../web/assets/parchment-light.webp';

  let {
    name,
    text,
    parchment: size,
    media,
    gift,
    language,
  }: {
    name: string;
    text: string;
    parchment: 'small' | 'large';
    media: readonly string[];
    gift: string | null;
    language: 'de' | 'en';
  } = $props();

  /** The parchment texture through the CSSOM (no inline styles, CSP). */
  function background(node: HTMLElement, url: string): void {
    node.style.backgroundImage = `url(${url})`;
  }

  const length = $derived(Array.from(text).length);
  const max = $derived(size === 'large' ? LETTER.LARGE_MAX_CHARS : LETTER.SMALL_MAX_CHARS);
</script>

<article class="letter" lang={language} data-testid="letter-preview">
  <div class="sheet" use:background={parchment}>
    <p class="from">{name} · Bot</p>
    <p class="text">{text}</p>
  </div>
  {#if media.length > 0}
    <div class="pictures">
      {#each media as id, index (id)}
        <img src={`/api/media/${id}`} alt={fill(t.bots.pictureAlt, { n: index + 1, name })} />
      {/each}
    </div>
  {/if}
  <p class="meta">
    {fill(t.centre.previewParchment, {
      size: size === 'large' ? t.centre.parchmentLarge : t.centre.parchmentSmall,
    })} · {length} / {max}
    {#if gift}· {fill(t.centre.previewGift, { gift })}{/if}
  </p>
</article>

<style>
  .letter {
    margin: 1rem 0;
    max-width: 36rem;
  }

  .sheet {
    background-size: cover;
    padding: 1.5rem;
    border-radius: 0.25rem;
    transform: rotate(-0.6deg);
    box-shadow: 0 0.2rem 0.6rem rgb(0 0 0 / 25%);
  }

  .from {
    font-family: var(--font-body);
    font-weight: 700;
    margin: 0 0 0.5rem;
  }

  .text {
    font-family: var(--font-hand-other);
    color: #1d2a44;
    white-space: pre-wrap;
    line-height: 1.7;
    margin: 0;
  }

  .pictures {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 0.75rem;
  }

  .pictures img {
    max-width: 100%;
    max-height: 16rem;
    border-radius: 0.25rem;
  }

  .meta {
    font-size: 0.9rem;
  }
</style>
