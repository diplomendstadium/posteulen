<script lang="ts">
  import { de } from '@posteulen/shared/texts/de.ts';
  import Link from '../components/Link.svelte';
  import OwlPicture from '../components/OwlPicture.svelte';

  let notice = $state(false);

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    notice = true;
  }
</script>

<div class="start">
  <header class="hero">
    <img class="logo" src="/icons/icon.svg" alt="" width="96" height="96" />
    <h1>{de.start.title}</h1>
    <p class="intro">{de.start.intro}</p>
  </header>

  <div class="columns">
    <section class="card" aria-labelledby="login-heading">
      <h2 id="login-heading">{de.start.loginHeading}</h2>
      <form onsubmit={submit} novalidate>
        <div class="field">
          <label for="login-name">{de.start.userName}</label>
          <input id="login-name" name="username" type="text" autocomplete="username" />
        </div>
        <div class="field">
          <label for="login-password">{de.start.password}</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autocomplete="current-password"
          />
        </div>
        <div class="actions">
          <button class="button" type="submit">{de.start.login}</button>
          <Link href="/konto-erstellen" class="button secondary">{de.start.createAccount}</Link>
        </div>
        {#if notice}
          <p class="notice" role="status">
            <span aria-hidden="true">ℹ</span><span>{de.start.notYet}</span>
          </p>
        {/if}
      </form>
    </section>

    <figure class="owl">
      <OwlPicture speciesId="waldkauz" alt="Ein Waldkauz" size={480} />
    </figure>
  </div>

  <nav class="footer-links" aria-label={de.nav.main}>
    <Link href="/hilfe">{de.nav.help}</Link>
    <Link href="/datenschutz">{de.nav.privacy}</Link>
    <Link href="/impressum">{de.nav.imprint}</Link>
  </nav>
</div>

<style>
  .start {
    max-width: 60rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  .hero {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .logo {
    margin: 0 auto 0.5rem;
    display: block;
  }

  .intro {
    max-width: 36rem;
    margin: 0 auto;
    color: var(--ink-soft);
  }

  .columns {
    display: grid;
    gap: 1.5rem;
    align-items: center;
  }

  @media (min-width: 48rem) {
    .columns {
      grid-template-columns: 1fr 1fr;
    }
  }

  .field {
    margin-bottom: 1rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .owl {
    margin: 0;
    display: flex;
    justify-content: center;
    --owl-size: 22rem;
  }

  .footer-links {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 2rem;
  }

  .footer-links :global(a) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.75rem;
    min-width: 2.75rem;
  }
</style>
