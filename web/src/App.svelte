<script lang="ts">
  import { de } from '@posteulen/shared/texts/de.ts';
  import StatusBanners from './components/StatusBanners.svelte';
  import { route } from './lib/router.svelte.ts';
  import Start from './pages/Start.svelte';
  import Shell from './pages/Shell.svelte';
  import InfoPage from './pages/InfoPage.svelte';

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
  {#if route.path === '/'}
    <Start />
  {:else if route.path === '/app' || route.path.startsWith('/app/')}
    <Shell />
  {:else if route.path === '/hilfe'}
    <InfoPage title={de.pages.helpTitle} />
  {:else if route.path === '/datenschutz'}
    <InfoPage title={de.pages.privacyTitle} draft />
  {:else if route.path === '/impressum'}
    <InfoPage title={de.pages.imprintTitle} />
  {:else if route.path === '/konto-erstellen'}
    <InfoPage title={de.start.createAccount} />
  {:else}
    <InfoPage title={de.errors.not_found} />
  {/if}
</main>

<style>
  main:focus {
    outline: none;
  }
</style>
