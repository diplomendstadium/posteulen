<script lang="ts">
  /**
   * Shows an owl picture with a caption (SPEC 9.2.6). It does not block the page (no
   * backdrop), closes on tap, click or Escape and by itself after a few seconds, has an
   * alternative text and is not animated with prefers-reduced-motion.
   */
  import { t, fill, speciesName } from '../lib/i18n.svelte.ts';
  import { owlImage } from '../lib/owl-image.ts';
  import { closeOwlImage, overlay } from '../lib/overlay.svelte.ts';

  const AUTO_CLOSE_MS = 5000;

  const current = $derived(overlay.current);
  const image = $derived(current ? owlImage(current.species, current.kind) : null);
  const shownSpecies = $derived(current ? speciesName(current.species) : '');

  $effect(() => {
    if (!current) return;
    const timer = setTimeout(closeOwlImage, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  });

  function keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && overlay.current) closeOwlImage();
  }
</script>

<svelte:window onkeydown={keydown} />

{#if current && image}
  {#key current.id}
    <figure class="owl-overlay" data-testid="owl-overlay" data-kind={current.kind}>
      <button
        type="button"
        class="close-area"
        onclick={closeOwlImage}
        aria-label={t.owls.overlayClose}
      >
        <img
          src={image.files.s480}
          srcset={`${image.files.s480} 480w${image.files.s960 ? `, ${image.files.s960} 960w` : ''}`}
          sizes="(max-width: 600px) 80vw, 420px"
          width="480"
          height="480"
          alt={fill(t.owls.imageAlt, { species: shownSpecies, what: current.caption })}
        />
      </button>
      <figcaption class="name"><span role="status">{current.caption}</span></figcaption>
    </figure>
  {/key}
{/if}

<style>
  .owl-overlay {
    position: fixed;
    z-index: 50;
    left: 50%;
    bottom: calc(var(--nav-height) + 1rem + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    width: min(80vw, 420px);
    margin: 0;
    padding: 0.5rem;
    background: var(--paper);
    border: 2px solid var(--wood);
    border-radius: var(--radius);
    box-shadow: 0 0.5rem 2rem rgb(0 0 0 / 30%);
  }

  @media (prefers-reduced-motion: no-preference) {
    .owl-overlay {
      animation: rise 300ms ease-out;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, 1rem);
    }
  }

  .close-area {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    border-radius: calc(var(--radius) - 2px);
  }

  figcaption {
    padding: 0.5rem 0.25rem 0.25rem;
    text-align: center;
  }
</style>
