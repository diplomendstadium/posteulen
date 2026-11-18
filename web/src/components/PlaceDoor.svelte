<script lang="ts">
  /**
   * v1.2: the large, playful door into a place – a wax-sealed wooden sign. v1.2.1: shared by the
   * post office and the Menagerie (SPEC 8.6, 8.7).
   */
  import Link from './Link.svelte';

  let { href, label, icons }: { href: string; label: string; icons: readonly [string, string] } =
    $props();
</script>

<p class="door">
  <Link {href} class="enter"
    ><span class="enter-icon" aria-hidden="true">{icons[0]}</span><span>{label}</span><span
      class="enter-icon"
      aria-hidden="true">{icons[1]}</span
    ></Link
  >
</p>

<style>
  .door {
    display: flex;
    justify-content: center;
    margin: 1.5rem 0 1rem;
  }

  .door :global(.enter) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    max-width: 100%;
    min-height: 4rem;
    padding: 0.85rem clamp(1rem, 5vw, 2rem);
    border: 3px double var(--parchment-deep);
    border-radius: 2rem 0.75rem 2rem 0.75rem;
    background:
      radial-gradient(circle at 30% 20%, rgb(255 255 255 / 18%), transparent 60%),
      linear-gradient(160deg, var(--wood) 0%, var(--wood-dark) 100%);
    box-shadow:
      0 0 0 3px var(--wood-dark),
      0 0.4rem 1rem rgb(43 29 14 / 35%);
    color: var(--on-wood);
    font-family: var(--font-display);
    font-size: clamp(1rem, 4.5vw, 1.6rem);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-align: center;
    text-decoration: none;
    transition: transform 0.2s ease;
  }

  .door :global(.enter:hover),
  .door :global(.enter:focus-visible) {
    transform: rotate(-1.5deg) scale(1.04);
  }

  .door :global(.enter-icon) {
    font-size: 1.5em;
    line-height: 1;
  }

  @media (prefers-reduced-motion: no-preference) {
    .door :global(.enter:hover .enter-icon) {
      animation: wiggle 0.6s ease-in-out;
    }
  }

  @keyframes wiggle {
    0%,
    100% {
      transform: rotate(0);
    }
    25% {
      transform: rotate(-12deg);
    }
    75% {
      transform: rotate(12deg);
    }
  }
</style>
