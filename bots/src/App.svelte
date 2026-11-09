<script lang="ts">
  /**
   * v0.8: the bots control centre (SPEC 10.12) – own login (OPAQUE, like the admin panel but
   * with its own password, cookie and sessions), 12 hours idle expiry, German or English.
   */
  import { onMount } from 'svelte';
  import { ACCOUNT, TIME } from '@posteulen/shared/constants.ts';
  import { api, SESSION_ENDED_EVENT, setIdleTime, touchSession } from '../../admin/src/lib/api.ts';
  import { login } from '../../admin/src/lib/auth.ts';
  import { message } from '../../admin/src/lib/messages.ts';
  import { fill, panel, t } from '../../admin/src/lib/i18n.svelte.ts';
  import LanguageSwitch from '../../admin/src/LanguageSwitch.svelte';
  import PasswordForm from '../../admin/src/PasswordForm.svelte';
  import Overview from './Overview.svelte';
  import BotPage from './BotPage.svelte';

  setIdleTime(ACCOUNT.BOTS_SESSION_IDLE_HOURS * TIME.HOUR);

  let view = $state<'loading' | 'login' | 'change' | 'ready'>('loading');
  let password = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let initial = $state('');
  /** The open bot (null: overview). */
  let botId = $state<string | null>(null);

  async function check(): Promise<void> {
    try {
      const session = await api<{ state: 'none' | 'active'; mustChangePassword?: boolean }>(
        'GET',
        '/api/session',
      );
      view = session.state !== 'active' ? 'login' : session.mustChangePassword ? 'change' : 'ready';
      touchSession(view === 'login');
    } catch (caught) {
      view = 'login';
      error = message(caught);
    }
  }

  onMount(() => {
    void check();
    const ended = (): void => {
      if (view === 'login' || view === 'loading') return;
      view = 'login';
      password = '';
      initial = '';
      botId = null;
      error = t.centre.sessionExpired;
    };
    window.addEventListener(SESSION_ENDED_EVENT, ended);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, ended);
  });

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    busy = true;
    error = null;
    try {
      const outcome = await login(password);
      if (outcome === 'ok') {
        initial = password;
        password = '';
        await check();
      } else if (outcome === 'wrong') error = t.admin.wrong;
      else error = fill(t.start.wait, { seconds: outcome.wait });
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }

  async function logout(): Promise<void> {
    await api('POST', '/api/logout', {}).catch(() => undefined);
    touchSession(true);
    botId = null;
    view = 'login';
  }
</script>

<header class="topbar">
  <span class="brand">{t.centre.title}</span>
  <span class="tools">
    <LanguageSwitch />
    {#if view === 'ready' || view === 'change'}
      <button class="button secondary" type="button" onclick={() => void logout()}
        >{t.admin.logout}</button
      >
    {/if}
  </span>
</header>
{#key panel.lang}
  <main id="main" class="page">
    {#if view === 'login'}
      <section class="card" aria-labelledby="centre-login">
        <h1 id="centre-login">{t.centre.loginHeading}</h1>
        <form onsubmit={submit} novalidate>
          <label for="centre-password">{t.admin.password}</label>
          <input
            id="centre-password"
            type="password"
            autocomplete="current-password"
            bind:value={password}
          />
          {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
          <p class="actions">
            <button class="button" type="submit" disabled={busy}>{t.admin.login}</button>
          </p>
        </form>
      </section>
    {:else if view === 'change'}
      <section class="card" aria-labelledby="centre-change">
        <h1 id="centre-change">{t.admin.changeTitle}</h1>
        <p>{t.admin.changeIntro}</p>
        <PasswordForm current={initial} ondone={() => void check()} />
      </section>
    {:else if view === 'ready'}
      {#if botId === null}
        <Overview onopen={(id) => (botId = id)} />
      {:else}
        <BotPage id={botId} onback={() => (botId = null)} />
      {/if}
    {/if}
  </main>
{/key}

<style>
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.5rem 1rem;
    background: var(--wood-dark);
    color: var(--on-wood);
    font-family: var(--font-display);
    font-weight: 700;
  }

  .topbar :global(.button) {
    background: var(--paper);
  }

  .tools {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .page {
    max-width: 64rem;
    margin: 2rem auto;
    padding: 0 1rem;
  }

  .actions {
    margin-top: 1rem;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }

  input {
    display: block;
    width: 100%;
    max-width: 30rem;
    min-height: 2.75rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
  }
</style>
