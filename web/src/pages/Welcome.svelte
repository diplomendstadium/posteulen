<script lang="ts">
  import { de } from '@posteulen/shared/texts/de.ts';
  import Link from '../components/Link.svelte';
</script>

<div class="page">
  <h1>{de.welcome.title}</h1>
  <p>{de.welcome.intro}</p>
  <section class="card">
    <h2>{de.welcome.android}</h2>
    <p>{de.welcome.androidSteps}</p>
    <h2>{de.welcome.ios}</h2>
    <p>{de.welcome.iosSteps}</p>
    <h2>{de.welcome.degoogled}</h2>
    <p>{de.welcome.degoogledSteps}</p>
  </section>
  <p class="notice"><span aria-hidden="true">ℹ</span><span>{de.welcome.pushLater}</span></p>
  <p><Link href="/app" class="button">{de.welcome.continue}</Link></p>
</div>

<style>
  .page {
    max-width: 44rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  h2 {
    font-size: 1.15rem;
  }
</style>
