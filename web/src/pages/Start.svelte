<script lang="ts">
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import Link from '../components/Link.svelte';
  import OwlPicture from '../components/OwlPicture.svelte';
  import ErrorText from '../components/ErrorText.svelte';
  import PasswordInput from '../components/PasswordInput.svelte';
  import { login } from '../lib/auth.svelte.ts';
  import { navigate } from '../lib/router.svelte.ts';
  import { status } from '../lib/status.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';

  let name = $state('');
  let password = $state('');
  let busy = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || !status.online) return;
    error = null;
    busy = de.start.loggingIn;
    try {
      const outcome = await login(name, password, (step) => {
        busy = step === 'captcha' ? de.start.stepCaptcha : de.start.stepPassword;
      });
      if (outcome === 'ok') {
        password = '';
        navigate('/app', true);
      } else if (outcome === 'wrong') {
        error = de.start.wrong;
      } else {
        error = fill(de.start.wait, { seconds: outcome.wait });
      }
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = null;
    }
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
          <input
            id="login-name"
            name="username"
            type="text"
            autocomplete="username"
            maxlength="100"
            bind:value={name}
          />
        </div>
        <PasswordInput
          id="login-password"
          label={de.start.password}
          autocomplete="current-password"
          bind:value={password}
        />
        <ErrorText message={error} />
        <div class="actions">
          <button class="button" type="submit" disabled={busy !== null || !status.online}
            >{de.start.login}</button
          >
          <Link href="/konto-erstellen" class="button secondary">{de.start.createAccount}</Link>
        </div>
        {#if busy}<p class="notice" role="status">
            <span aria-hidden="true">⏳</span><span>{busy}</span>
          </p>{/if}
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
