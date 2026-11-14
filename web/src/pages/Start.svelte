<script lang="ts">
  import { t, fill } from '../lib/i18n.svelte.ts';
  import { REPOSITORY_URL } from '@posteulen/shared/version.ts';
  import { DONATION } from '@posteulen/shared/constants.ts';
  import Link from '../components/Link.svelte';
  import ErrorText from '../components/ErrorText.svelte';
  import PasswordInput from '../components/PasswordInput.svelte';
  import { login } from '../lib/auth.svelte.ts';
  import { navigate } from '../lib/router.svelte.ts';
  import { status } from '../lib/status.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { sceneImage } from '../lib/owl-image.ts';
  import { onMount } from 'svelte';
  import { api } from '../lib/api.ts';

  /** The whole menagerie on its perches, next to the login (v0.3.1: instead of the tawny owl). */
  const group = sceneImage('group');

  let name = $state('');
  let password = $state('');
  let busy = $state<string | null>(null);
  let error = $state<string | null>(null);
  /** v0.9: the onion address – only once the server has set up Tor and it is running (SPEC 8.1). */
  let onion = $state<string | null>(null);

  onMount(() => {
    api<{ url?: unknown }>('GET', '/api/onion')
      .then((body) => {
        const url = body.url;
        onion = typeof url === 'string' && url.startsWith('http://') ? url : null;
      })
      .catch(() => {
        // Offline or an older server: simply no link.
      });
  });

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || !status.online) return;
    error = null;
    busy = t.start.loggingIn;
    try {
      const outcome = await login(name, password, (step) => {
        busy = step === 'captcha' ? t.start.stepCaptcha : t.start.stepPassword;
      });
      if (outcome === 'ok') {
        password = '';
        navigate('/app', true);
      } else if (outcome === 'wrong') {
        error = t.start.wrong;
      } else {
        error = fill(t.start.wait, { seconds: outcome.wait });
      }
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = null;
    }
  }
</script>

<div class="start">
  <header class="hero card">
    <img class="logo" src="/icons/icon.svg" alt="" width="96" height="96" />
    <h1>{t.start.title}</h1>
    <p class="intro">{t.start.intro}</p>
  </header>

  <div class="columns">
    <section class="card" aria-labelledby="login-heading">
      <h2 id="login-heading">{t.start.loginHeading}</h2>
      <form onsubmit={submit} novalidate>
        <div class="field">
          <label for="login-name">{t.start.userName}</label>
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
          label={t.start.password}
          autocomplete="current-password"
          bind:value={password}
        />
        <ErrorText message={error} />
        <div class="actions">
          <button class="button" type="submit" disabled={busy !== null || !status.online}
            >{t.start.login}</button
          >
          <Link href="/konto-erstellen" class="button secondary">{t.start.createAccount}</Link>
        </div>
        {#if busy}<p class="notice" role="status">
            <span aria-hidden="true">⏳</span><span>{busy}</span>
          </p>{/if}
      </form>
    </section>

    {#if !group.placeholder}
      <figure class="group">
        <img
          src={group.files['s960']}
          srcset={`${group.files['s480']} 480w, ${group.files['s960']} 960w`}
          sizes="(min-width: 48rem) 28rem, 100vw"
          width="960"
          height="960"
          alt={t.start.groupAlt}
          decoding="async"
        />
      </figure>
    {/if}
  </div>

  <nav class="footer-links card" aria-label={t.nav.main}>
    <Link href="/hilfe">{t.nav.help}</Link>
    <Link href="/datenschutz">{t.nav.privacy}</Link>
    <Link href="/impressum">{t.nav.imprint}</Link>
    <a href={DONATION.URL} target="_blank" rel="noopener noreferrer"
      >{t.nav.donate}<span class="visually-hidden">{` ${t.nav.donateLink}`}</span></a
    >
    <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer"
      >{t.app.sourceCode}<span class="visually-hidden">{t.app.versionLink}</span></a
    >
    {#if onion}
      <a href={onion} rel="noopener noreferrer" data-testid="tor-link"
        >{t.nav.tor}<span class="visually-hidden">{` ${t.nav.torLink}`}</span></a
      >
    {/if}
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

  .group {
    margin: 0 auto;
    width: 100%;
    max-width: 28rem;
  }

  .group img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    box-shadow: var(--shadow);
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

  /*
   * v0.7: side by side, the login box and the group picture have the same width and height –
   * the square picture sets the height, the box stretches to it; should the box ever need
   * more room, the picture fills that height with minimal cropping.
   */
  @media (min-width: 48rem) {
    .columns {
      grid-template-columns: 1fr 1fr;
      align-items: stretch;
    }

    .columns > .card {
      margin: 0;
    }

    .group {
      max-width: none;
      aspect-ratio: 1;
    }

    .group img {
      height: 100%;
      object-fit: cover;
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

  .footer-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0 1.5rem;
    margin: 2rem auto 0;
    padding: 0.25rem 1rem;
    width: fit-content;
    max-width: 100%;
  }

  .footer-links :global(a) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.75rem;
    min-width: 2.75rem;
  }
</style>
