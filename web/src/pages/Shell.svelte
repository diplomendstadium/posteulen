<script lang="ts">
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { VERSION } from '@posteulen/shared/version.ts';
  import Link from '../components/Link.svelte';
  import { route } from '../lib/router.svelte.ts';
  import { onDestroy, onMount } from 'svelte';
  import { sceneImage } from '../lib/owl-image.ts';
  import { account, setPushHintHidden } from '../lib/auth.svelte.ts';
  import { live, startLive, stopLive } from '../lib/live.svelte.ts';
  import { api } from '../lib/api.ts';
  import { dateTime } from '../lib/format.ts';
  import Settings from './Settings.svelte';
  import Letters from './Letters.svelte';
  import Chat from './Chat.svelte';
  import SystemChat from './SystemChat.svelte';
  import AddressBook from './AddressBook.svelte';
  import Owls from './Owls.svelte';
  import Menagerie from './Menagerie.svelte';
  import Finance from './Finance.svelte';
  import MapPage from './MapPage.svelte';
  import OwlOverlay from '../components/OwlOverlay.svelte';
  import { showSystemArrivals } from '../lib/live.svelte.ts';

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
  /** Unread letters and system messages: "Neue Post!" in the top bar (v0.2). */
  const unread = $derived(
    live.chats.reduce((sum, chat) => sum + chat.unread, 0) + live.systemUnread,
  );
  const newPostLetters = Array.from(de.app.newPost);

  // News are shown once on the overview and then removed (SPEC 8.3, 11.5).
  $effect(() => {
    if (current === undefined && live.news.length > 0) {
      const ids = live.news.map((item) => item.id);
      void api('POST', '/api/news/seen', { ids }).catch(() => undefined); // shown again next time
      // Deliveries without a letter show their arrival image with the news (SPEC 9.2.6).
      if (live.news.some((item) => item.type === 'gold_arrived' || item.type === 'owl_gift'))
        void showSystemArrivals().catch(() => undefined);
    }
  });

  /** The whole menagerie, next to the tiles on wide screens (v0.3.2). */
  const group = sceneImage('group');
</script>

<div class="shell">
  <header class="topbar">
    <p class="brand-line">
      <Link href="/app" class="brand">{de.app.name}</Link>
      {#if route.path === '/app'}<span class="version"
          >{fill(de.app.version, { version: VERSION })}</span
        >{/if}
    </p>
    {#if unread > 0}
      <!-- Restarts with every new letter; runs about five seconds, then rests (WCAG 2.2.2). -->
      {#key unread}
        <Link href="/app/briefe" class="new-post">
          <span class="new-post-text" aria-hidden="true"
            >{#each newPostLetters as letter, index (index)}<span>{letter}</span>{/each}</span
          >
          <span class="visually-hidden"
            >{de.app.newPost} {fill(de.app.newPostCount, { count: unread })}</span
          >
        </Link>
      {/key}
    {/if}
    <p class="gold">
      <span aria-hidden="true">⛀</span>
      <span>{de.units.gold(account.profile?.gold ?? 0)}</span>
    </p>
  </header>
  {#if live.pushState !== 'confirmed' && !account.pushHintHidden}
    <p class="push-hint">
      <Link href="/app/einstellungen">{de.push.headerHint}</Link>
      <button class="hide-hint" type="button" onclick={() => setPushHintHidden(true)}
        >{de.push.headerHide}</button
      >
    </p>
  {/if}

  <div class="content">
    {#if account.notice === 'deletionCancelled'}
      <p class="notice" role="status">
        <span aria-hidden="true">ℹ</span><span>{de.start.deletionCancelled}</span>
      </p>
    {/if}
    {#if current}
      <h1 class="plate">{chatPeer === 'system' ? de.letters.system : current.label}</h1>
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
      {:else if current.href === '/app/eulen'}
        <Owls />
      {:else if current.href === '/app/menagerie'}
        <Menagerie />
      {:else if current.href === '/app/finanzen'}
        <Finance />
      {:else if current.href === '/app/karte'}
        <MapPage />
      {:else}
        <p class="notice"><span aria-hidden="true">ℹ</span><span>{de.pages.notFound}</span></p>
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
      <div class="home-grid">
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
        <!-- v0.3.2: on wide screens the whole menagerie keeps the tiles company. -->
        {#if !group.placeholder}
          <figure class="group">
            <img
              src={group.files['s480']}
              srcset={`${group.files['s480']} 480w, ${group.files['s960']} 960w`}
              sizes="24rem"
              width="960"
              height="960"
              alt={de.start.groupAlt}
              loading="lazy"
              decoding="async"
            />
          </figure>
        {/if}
      </div>
    {/if}
  </div>

  <OwlOverlay />

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
    gap: 0.5rem;
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

  .brand-line {
    margin: 0;
    display: flex;
    align-items: flex-start;
  }

  /* Small, top right of the word mark; not a link (v0.2). */
  .version {
    margin: 0.3rem 0 0 0.25rem;
    font-size: 0.7rem;
    white-space: nowrap;
    opacity: 0.85;
  }

  .topbar :global(.new-post) {
    color: #ffe9a8;
    font-weight: 700;
    text-decoration: none;
    min-height: 2.75rem;
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
  }

  .new-post-text span {
    display: inline-block;
    white-space: pre;
    animation: hop 1.6s ease-in-out 3;
  }

  .new-post-text span:nth-child(2) {
    animation-delay: 0.07s;
  }
  .new-post-text span:nth-child(3) {
    animation-delay: 0.14s;
  }
  .new-post-text span:nth-child(4) {
    animation-delay: 0.21s;
  }
  .new-post-text span:nth-child(5) {
    animation-delay: 0.28s;
  }
  .new-post-text span:nth-child(6) {
    animation-delay: 0.35s;
  }
  .new-post-text span:nth-child(7) {
    animation-delay: 0.42s;
  }
  .new-post-text span:nth-child(8) {
    animation-delay: 0.49s;
  }
  .new-post-text span:nth-child(9) {
    animation-delay: 0.56s;
  }
  .new-post-text span:nth-child(10) {
    animation-delay: 0.63s;
  }

  @keyframes hop {
    0%,
    45%,
    100% {
      transform: translateY(0) rotate(0);
    }
    20% {
      transform: translateY(-0.3em) rotate(-4deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .new-post-text span {
      animation: none;
    }
  }

  .gold {
    margin: 0;
    white-space: nowrap;
    display: flex;
    gap: 0.35rem;
    font-weight: 700;
  }

  .push-hint {
    margin: 0;
    padding: 0.25rem 1rem;
    background: var(--parchment-deep);
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 0 1rem;
  }

  /* Hides the hint until the next login (v0.3). */
  .hide-hint {
    min-height: 2.75rem;
    padding: 0 0.5rem;
    border: none;
    background: none;
    color: var(--ink-soft);
    font: inherit;
    font-size: 0.9rem;
    text-decoration: underline;
    cursor: pointer;
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

  /* Group picture only on desktop width, next to the tiles (two columns of tiles there). */
  .group {
    display: none;
    margin: 0;
  }

  .group img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    box-shadow: var(--shadow);
  }

  @media (min-width: 64rem) {
    .home-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 24rem);
      gap: 1.5rem;
      align-items: start;
    }

    .home-grid .tiles {
      grid-template-columns: repeat(2, 1fr);
    }

    .group {
      display: block;
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
