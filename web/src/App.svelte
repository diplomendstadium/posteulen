<script lang="ts">
  import { de } from '@posteulen/shared/texts/de.ts';
  import StatusBanners from './components/StatusBanners.svelte';
  import { onMount } from 'svelte';
  import { navigate, route } from './lib/router.svelte.ts';
  import { account, restore } from './lib/auth.svelte.ts';
  import Start from './pages/Start.svelte';
  import Shell from './pages/Shell.svelte';
  import InfoPage from './pages/InfoPage.svelte';
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
    <InfoPage title={de.pages.helpTitle} />
  {:else if route.path === '/datenschutz'}
    <InfoPage title={de.pages.privacyTitle} draft />
  {:else if route.path === '/impressum'}
    <InfoPage title={de.pages.imprintTitle} />
  {:else if route.path === '/konto-erstellen'}
    <Register />
  {:else}
    <InfoPage title={de.errors.not_found} />
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
