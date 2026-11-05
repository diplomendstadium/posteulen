<script lang="ts">
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import Link from '../components/Link.svelte';
  import { route } from '../lib/router.svelte.ts';

  /** Sections of the logged-in start page (SPEC 8.3). Icons are decorative; text is always shown. */
  const sections = [
    { href: '/app/briefe', label: de.nav.letters, icon: '✉' },
    { href: '/app/eulen', label: de.nav.owls, icon: '🦉' },
    { href: '/app/finanzen', label: de.nav.finance, icon: '⛀' },
    { href: '/app/menagerie', label: de.nav.menagerie, icon: '⌂' },
    { href: '/app/adressbuch', label: de.nav.addressBook, icon: '☰' },
    { href: '/app/karte', label: de.nav.map, icon: '⌖' },
    { href: '/app/einstellungen', label: de.nav.settings, icon: '⚙' },
    { href: '/hilfe', label: de.nav.help, icon: '?' },
  ] as const;

  const bottomNav = [
    { href: '/app', label: de.nav.home, icon: '⌂' },
    sections[0],
    sections[1],
    sections[4],
    sections[5],
  ] as const;

  const current = $derived(sections.find((section) => section.href === route.path));
</script>

<div class="shell">
  <header class="topbar">
    <Link href="/app" class="brand">{de.app.name}</Link>
    <p class="gold">
      <span aria-hidden="true">⛀</span>
      <span>{fill(de.header.goldAmount, { amount: '3,0' })}</span>
    </p>
  </header>

  <div class="content">
    {#if current}
      <h1>{current.label}</h1>
      <p class="notice"><span aria-hidden="true">ℹ</span><span>{de.app.comingSoon}</span></p>
    {:else}
      <h1 class="visually-hidden">{de.nav.home}</h1>
      <ul class="tiles">
        {#each sections as section (section.href)}
          <li>
            <Link href={section.href} class="tile">
              <span class="tile-icon" aria-hidden="true">{section.icon}</span>
              <span>{section.label}</span>
            </Link>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <nav class="bottom" aria-label={de.nav.main}>
    {#each bottomNav as item (item.href)}
      <Link href={item.href} class="bottom-item">
        <span class="bottom-icon" aria-hidden="true">{item.icon}</span>
        <span class="bottom-label">{item.label}</span>
      </Link>
    {/each}
  </nav>
</div>

<style>
  .shell {
    min-height: 100vh;
    padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom));
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: var(--wood);
    color: var(--on-wood);
  }

  .topbar :global(.brand) {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.25rem;
    color: var(--on-wood);
    text-decoration: none;
    min-height: 2.75rem;
    display: inline-flex;
    align-items: center;
  }

  .gold {
    margin: 0;
    display: flex;
    gap: 0.35rem;
    font-weight: 700;
  }

  .content {
    max-width: 60rem;
    margin: 0 auto;
    padding: 1.25rem 1rem;
  }

  .tiles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  @media (min-width: 48rem) {
    .tiles {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .tiles :global(.tile) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 7rem;
    padding: 1rem;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    color: var(--ink);
    font-weight: 700;
    text-decoration: none;
    text-align: center;
  }

  .tiles :global(.tile:hover) {
    border-color: var(--wood);
    background: var(--parchment-deep);
  }

  .tile-icon {
    font-size: 2rem;
    line-height: 1;
    color: var(--wood);
  }

  .bottom {
    position: fixed;
    inset: auto 0 0 0;
    display: flex;
    justify-content: space-around;
    height: calc(var(--nav-height) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--paper);
    border-top: 2px solid var(--wood);
  }

  .bottom :global(.bottom-item) {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 2.75rem;
    color: var(--ink);
    text-decoration: none;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .bottom :global(.bottom-item[aria-current='page']) {
    color: var(--seal);
    text-decoration: underline;
    text-decoration-thickness: 3px;
  }

  .bottom-icon {
    font-size: 1.3rem;
    line-height: 1.2;
  }
</style>
