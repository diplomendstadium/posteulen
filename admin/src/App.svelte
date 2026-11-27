<script lang="ts">
  import { onMount } from 'svelte';
  import { t, fill } from './lib/i18n.svelte.ts';
  import { api, SESSION_ENDED_EVENT, touchSession } from './lib/api.ts';
  import { message } from './lib/messages.ts';
  import Dashboard from './Dashboard.svelte';
  import PanelLogin from './PanelLogin.svelte';
  import PasswordForm from './PasswordForm.svelte';
  import LanguageSwitch from './LanguageSwitch.svelte';
  import { panel } from './lib/i18n.svelte.ts';
  import { deviceTimeZone } from './lib/time.ts';

  let view = $state<'loading' | 'login' | 'change' | 'ready'>('loading');
  let error = $state<string | null>(null);
  let initial = $state('');

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
    // v0.7: after 10 minutes without activity the login expires (SPEC 13).
    const ended = (): void => {
      if (view === 'login' || view === 'loading') return;
      view = 'login';
      initial = '';
      error = t.admin.sessionExpired;
    };
    window.addEventListener(SESSION_ENDED_EVENT, ended);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, ended);
  });

  async function logout(): Promise<void> {
    await api('POST', '/api/logout', {}).catch(() => undefined);
    touchSession(true);
    view = 'login';
  }
</script>

<header class="topbar">
  <span class="brand">{t.admin.title}</span>
  <span class="tools">
    <LanguageSwitch />
    {#if view === 'ready' || view === 'change'}
      <button class="button secondary" type="button" onclick={() => void logout()}
        >{t.admin.logout}</button
      >
    {/if}
  </span>
</header>
{#key panel.lang}<main id="main" class="page">
    {#if view === 'login'}
      <PanelLogin
        id="admin"
        heading={t.admin.loginHeading}
        bind:error
        ondone={(password) => {
          initial = password;
          void check();
        }}
      />
    {:else if view === 'change'}
      <section class="card" aria-labelledby="admin-change">
        <h1 id="admin-change">{t.admin.changeTitle}</h1>
        <p>{t.admin.changeIntro}</p>
        <PasswordForm current={initial} ondone={() => void check()} />
      </section>
    {:else if view === 'ready'}
      <h1 class="visually-hidden">{t.admin.title}</h1>
      <Dashboard />
      <p class="zone">{fill(t.admin.timeZoneNote, { zone: deviceTimeZone() })}</p>
    {/if}
  </main>{/key}

<style>
  .zone {
    margin: 1.5rem 0 0;
    text-align: center;
    font-size: 0.9rem;
  }

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

  .tools {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .page {
    max-width: 48rem;
    margin: 2rem auto;
    padding: 0 1rem;
  }
</style>
