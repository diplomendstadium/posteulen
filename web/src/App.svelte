<script lang="ts">
  import { i18n, setLanguage, t } from './lib/i18n.svelte.ts';
  import StatusBanners from './components/StatusBanners.svelte';
  import LanguageFlag from './components/LanguageFlag.svelte';
  import { onMount, untrack } from 'svelte';
  import { navigate, route } from './lib/router.svelte.ts';
  import { account, restore } from './lib/auth.svelte.ts';
  import Start from './pages/Start.svelte';
  import Shell from './pages/Shell.svelte';
  import TextPage from './pages/TextPage.svelte';
  import { helpOf } from '@posteulen/shared/texts/help.ts';
  import { legalOf } from '@posteulen/shared/texts/legal.ts';
  import Register from './pages/Register.svelte';
  import Welcome from './pages/Welcome.svelte';
  import Measure from './pages/Measure.svelte';

  onMount(() => {
    void restore();
  });

  const needsLogin = $derived(
    route.path === '/app' || route.path.startsWith('/app/') || route.path === '/willkommen',
  );

  /** After login (and whenever the profile changes) the account's language wins (v0.4). */
  $effect(() => {
    const language = account.profile?.language;
    if (language && language !== untrack(() => i18n.lang)) setLanguage(language);
  });

  const help = $derived(helpOf(i18n.lang));
  const legal = $derived(legalOf(i18n.lang));
  /** The signed-in area shows the flag in its own top bar. */
  const inShell = $derived(route.path === '/app' || route.path.startsWith('/app/'));

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
      '/hilfe': t.pages.helpTitle,
      '/datenschutz': t.pages.privacyTitle,
      '/impressum': t.pages.imprintTitle,
    };
    const title = titles[route.path];
    document.title = title ? `${title} – ${t.app.name}` : t.app.name;
  });
</script>

<!-- v0.4: everything is rendered anew when the language changes. -->
{#key i18n.lang}
  <a class="skip-link" href="#main">{t.app.skipToContent}</a>
  <StatusBanners />
  {#if !inShell || !account.profile}
    <div class="language-row"><LanguageFlag /></div>
  {/if}
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
        title={t.pages.helpTitle}
        intro={help.intro}
        sections={help.sections}
        faq={help.faq}
      />
    {:else if route.path === '/datenschutz'}
      <TextPage title={t.pages.privacyTitle} intro={legal.privacyIntro} sections={legal.privacy} />
    {:else if route.path === '/impressum'}
      <TextPage title={t.pages.imprintTitle} intro={legal.imprintIntro} sections={legal.imprint} />
    {:else if route.path === '/konto-erstellen'}
      <Register />
    {:else}
      <TextPage title={t.errors.not_found} intro={t.pages.notFound} sections={[]} />
    {/if}
  </main>
{/key}

<style>
  /* v0.4: the flag sits in its own row in the top right corner, above the content. */
  .language-row {
    display: flex;
    justify-content: flex-end;
    padding: 0.5rem 1rem 0;
  }

  main:focus {
    outline: none;
  }

  .loading {
    text-align: center;
    padding: 3rem;
  }
</style>
