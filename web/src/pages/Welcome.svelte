<script lang="ts">
  /**
   * After registration (SPEC 8.1, v0.3): in plain words how PostEulen gets onto the home
   * screen without an app store, for Android/Chrome, iPhone/Safari and everything else, and
   * what notifications are about. Special cases (phones without Google) only in the help.
   */
  import { de } from '@posteulen/shared/texts/de.ts';
  import Link from '../components/Link.svelte';
  import PushSettings from '../components/PushSettings.svelte';
</script>

<div class="page">
  <header class="card">
    <h1>{de.welcome.title}</h1>
    <p>{de.welcome.intro}</p>
  </header>

  <section class="card" aria-labelledby="app-title">
    <h2 id="app-title">{de.welcome.appTitle}</h2>
    <p>{de.welcome.app1}</p>
    <p>{de.welcome.app2}</p>

    <h3>{de.welcome.android}</h3>
    <ol>
      {#each de.welcome.androidSteps as step, index (index)}<li>{step}</li>{/each}
    </ol>

    <h3>{de.welcome.ios}</h3>
    <ol>
      {#each de.welcome.iosSteps as step, index (index)}<li>{step}</li>{/each}
    </ol>

    <h3>{de.welcome.other}</h3>
    <p>{de.welcome.otherSteps}</p>
  </section>

  <section class="card" aria-labelledby="push-intro-title">
    <h2 id="push-intro-title">{de.welcome.pushTitle}</h2>
    <p>{de.welcome.push1}</p>
    <p>{de.welcome.push2}</p>
    <p>{de.welcome.push3}</p>
  </section>

  <PushSettings />

  <p class="plate"><Link href="/hilfe#installieren">{de.welcome.helpLink}</Link></p>
  <p><Link href="/app" class="button">{de.welcome.continue}</Link></p>
</div>

<style>
  .page {
    max-width: 44rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
    display: grid;
    gap: 1.25rem;
  }

  .page > * {
    margin: 0;
  }

  h3 {
    font-size: 1.1rem;
    margin-top: 1.25rem;
  }

  ol {
    padding-left: 1.5rem;
  }

  li + li {
    margin-top: 0.4rem;
  }

  .card > :last-child {
    margin-bottom: 0;
  }
</style>
