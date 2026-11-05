<script lang="ts">
  import { de } from '@posteulen/shared/texts/de.ts';
  import Link from '../components/Link.svelte';
  import { route } from '../lib/router.svelte.ts';
  import { onDestroy, onMount } from 'svelte';
  import { account } from '../lib/auth.svelte.ts';
  import { live, startLive, stopLive } from '../lib/live.svelte.ts';
  import { api } from '../lib/api.ts';
  import { dateTime } from '../lib/format.ts';
  import Settings from './Settings.svelte';
  import Letters from './Letters.svelte';
  import Chat from './Chat.svelte';
  import SystemChat from './SystemChat.svelte';
  import AddressBook from './AddressBook.svelte';

  onMount(() => startLive());
  onDestroy(() => stopLive());

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

  const current = $derived(
    sections.find(
      (section) => section.href === route.path || route.path.startsWith(`${section.href}/`),
    ),
  );
  const chatPeer = $derived(
    route.path.startsWith('/app/briefe/') ? route.path.slice('/app/briefe/'.length) : null,
  );
  const newsTexts = de.news as Record<string, string>;

  // News are shown once on the overview and then removed (SPEC 8.3, 11.5).
  $effect(() => {
    if (current === undefined && live.news.length > 0) {
      const ids = live.news.map((item) => item.id);
      void api('POST', '/api/news/seen', { ids });
    }
  });
</script>

<div class="shell">
  <header class="topbar">
    <Link href="/app" class="brand">{de.app.name}</Link>
    <p class="gold">
      <span aria-hidden="true">⛀</span>
      <span>{de.units.gold(account.profile?.gold ?? 0)}</span>
    </p>
  </header>
  {#if live.pushState !== 'confirmed'}
    <p class="push-hint"><Link href="/app/einstellungen">{de.push.headerHint}</Link></p>
  {/if}

  <div class="content">
    {#if account.notice === 'deletionCancelled'}
      <p class="notice" role="status">
        <span aria-hidden="true">ℹ</span><span>{de.start.deletionCancelled}</span>
      </p>
    {/if}
    {#if current}
      <h1>{chatPeer === 'system' ? de.letters.system : current.label}</h1>
      {#if current.href === '/app/einstellungen'}
        <Settings />
      {:else if chatPeer === 'system'}
        <SystemChat />
      {:else if chatPeer}
        {#key chatPeer}<Chat peerId={chatPeer} />{/key}
      {:else if current.href === '/app/briefe'}
        <Letters />
      {:else if current.href === '/app/adressbuch'}
        <AddressBook />
      {:else}
        <p class="notice"><span aria-hidden="true">ℹ</span><span>{de.app.comingSoon}</span></p>
      {/if}
    {:else}
      <h1 class="visually-hidden">{de.nav.home}</h1>
      {#if live.news.length > 0}
        <section class="news card" aria-labelledby="news-title">
          <h2 id="news-title">{de.news.title}</h2>
          <ul>
            {#each live.news as item (item.id)}
              <li>
                <span class="when">{dateTime(item.createdAt)}</span>
                {newsTexts[item.type] ?? item.type}
              </li>
            {/each}
          </ul>
        </section>
      {/if}
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

  .push-hint {
    margin: 0;
    padding: 0.25rem 1rem;
    background: var(--parchment-deep);
    text-align: center;
  }

  .push-hint :global(a) {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
  }

  .news {
    margin-bottom: 1.5rem;
  }

  .news ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  .when {
    color: var(--ink-soft);
    margin-right: 0.5rem;
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
