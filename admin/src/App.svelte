<script lang="ts">
  import { onMount } from 'svelte';
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { api } from './lib/api.ts';
  import { login } from './lib/auth.ts';
  import { message } from './lib/messages.ts';
  import Dashboard from './Dashboard.svelte';
  import PasswordForm from './PasswordForm.svelte';

  let view = $state<'loading' | 'login' | 'change' | 'ready'>('loading');
  let password = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let initial = $state('');

  async function check(): Promise<void> {
    try {
      const session = await api<{ state: 'none' | 'active'; mustChangePassword?: boolean }>(
        'GET',
        '/api/session',
      );
      view = session.state !== 'active' ? 'login' : session.mustChangePassword ? 'change' : 'ready';
    } catch (caught) {
      view = 'login';
      error = message(caught);
    }
  }

  onMount(() => {
    void check();
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
      } else if (outcome === 'wrong') error = de.admin.wrong;
      else error = fill(de.start.wait, { seconds: outcome.wait });
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }

  async function logout(): Promise<void> {
    await api('POST', '/api/logout', {}).catch(() => undefined);
    view = 'login';
  }
</script>

<header class="topbar">
  <span class="brand">{de.admin.title}</span>
  {#if view === 'ready' || view === 'change'}
    <button class="button secondary" type="button" onclick={() => void logout()}
      >{de.admin.logout}</button
    >
  {/if}
</header>
<main id="main" class="page">
  {#if view === 'login'}
    <section class="card" aria-labelledby="admin-login">
      <h1 id="admin-login">{de.admin.loginHeading}</h1>
      <form onsubmit={submit} novalidate>
        <label for="admin-password">{de.admin.password}</label>
        <input
          id="admin-password"
          type="password"
          autocomplete="current-password"
          bind:value={password}
        />
        {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
        <p class="actions">
          <button class="button" type="submit" disabled={busy}>{de.admin.login}</button>
        </p>
      </form>
    </section>
  {:else if view === 'change'}
    <section class="card" aria-labelledby="admin-change">
      <h1 id="admin-change">{de.admin.changeTitle}</h1>
      <p>{de.admin.changeIntro}</p>
      <PasswordForm current={initial} ondone={() => void check()} />
    </section>
  {:else if view === 'ready'}
    <h1 class="visually-hidden">{de.admin.title}</h1>
    <Dashboard />
  {/if}
</main>

<style>
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: var(--wood-dark);
    color: var(--on-wood);
    font-family: var(--font-display);
    font-weight: 700;
  }

  .topbar .button {
    background: var(--paper);
  }

  .page {
    max-width: 48rem;
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
</style>
