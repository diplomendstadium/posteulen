<script lang="ts">
  import { de } from '@posteulen/shared/texts/de.ts';
  import StatusBanners from './components/StatusBanners.svelte';
  import { onMount } from 'svelte';
  import { navigate, route } from './lib/router.svelte.ts';
  import { account, restore } from './lib/auth.svelte.ts';
  import Start from './pages/Start.svelte';
  import Shell from './pages/Shell.svelte';
  import TextPage from './pages/TextPage.svelte';
  import { HELP_FAQ, HELP_INTRO, HELP_SECTIONS } from '@posteulen/shared/texts/help.ts';
  import {
    IMPRINT_INTRO,
    IMPRINT_SECTIONS,
    PRIVACY_INTRO,
    PRIVACY_SECTIONS,
  } from '@posteulen/shared/texts/legal.ts';
  import Register from './pages/Register.svelte';
  import Welcome from './pages/Welcome.svelte';
  import Measure from './pages/Measure.svelte';

  onMount(() => {
    void restore();
  });

  const needsLogin = $derived(
    route.path === '/app' || route.path.startsWith('/app/') || route.path === '/willkommen',
  );

  // Guard: logged-in areas only with session and local keys (SPEC 5.5).
  $effect(() => {
    if (!account.checked) return;
    if (needsLogin && !account.profile) navigate('/', true);
    else if (
      !needsLogin &&
      account.profile &&
      (route.path === '/' || route.path === '/konto-erstellen')
    )
      navigate('/app', true);
  });

  $effect(() => {
    const titles: Record<string, string> = {
      '/hilfe': de.pages.helpTitle,
      '/datenschutz': de.pages.privacyTitle,
      '/impressum': de.pages.imprintTitle,
    };
    const title = titles[route.path];
    document.title = title ? `${title} – ${de.app.name}` : de.app.name;
  });
</script>

<a class="skip-link" href="#main">{de.app.skipToContent}</a>
<StatusBanners />
<main id="main" tabindex="-1">
  {#if !account.checked}
    <p class="loading" role="status">…</p>
  {:else if route.path === '/'}
    <Start />
  {:else if needsLogin && !account.profile}
    <p class="loading" role="status">…</p>
  {:else if route.path === '/app' || route.path.startsWith('/app/')}
    <Shell />
  {:else if route.path === '/willkommen'}
    <Welcome />
  {:else if route.path === '/messung'}
    <Measure />
  {:else if route.path === '/hilfe'}
    <TextPage
      title={de.pages.helpTitle}
      intro={HELP_INTRO}
      sections={HELP_SECTIONS}
      faq={HELP_FAQ}
    />
  {:else if route.path === '/datenschutz'}
    <TextPage
      title={de.pages.privacyTitle}
      intro={PRIVACY_INTRO}
      sections={PRIVACY_SECTIONS}
      draft
    />
  {:else if route.path === '/impressum'}
    <TextPage title={de.pages.imprintTitle} intro={IMPRINT_INTRO} sections={IMPRINT_SECTIONS} />
  {:else if route.path === '/konto-erstellen'}
    <Register />
  {:else}
    <TextPage title={de.errors.not_found} intro={de.pages.notFound} sections={[]} />
  {/if}
</main>

<style>
  main:focus {
    outline: none;
  }

  .loading {
    text-align: center;
    padding: 3rem;
  }
</style>
