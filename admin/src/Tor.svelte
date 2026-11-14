<script lang="ts">
  /**
   * v0.9: the onion service (SPEC 13 item 9, 16.5): address, state and the switch. Switching off
   * stops Tor on the server within a few seconds (root helper); the keys and thus the address stay.
   */
  import { onMount } from 'svelte';
  import { t, fill, locale } from './lib/i18n.svelte.ts';
  import { api } from './lib/api.ts';
  import { message } from './lib/messages.ts';

  interface Overview {
    onion: string | null;
    enabled: boolean;
    status: 'ok' | 'error' | 'off' | null;
    statusAt: number | null;
    message: string | null;
  }

  let info = $state<Overview | null>(null);
  let error = $state<string | null>(null);
  let saved = $state(false);
  let busy = $state(false);

  const time = (ms: number): string =>
    new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(ms),
    );

  const stateText = $derived.by((): string => {
    if (!info) return '';
    if (!info.onion) return t.admin.torNotSetUp;
    if (!info.enabled) return t.admin.torStateOff;
    if (info.status === 'ok') return t.admin.torStateOk;
    if (info.status === 'error') return t.admin.torStateError;
    return t.admin.torStatePending;
  });

  async function load(): Promise<void> {
    try {
      info = await api<Overview>('GET', '/api/settings/tor');
    } catch (caught) {
      error = message(caught);
    }
  }

  onMount(() => {
    void load();
  });

  async function toggle(input: HTMLInputElement): Promise<void> {
    const enabled = input.checked;
    if (busy) return;
    if (!enabled && !confirm(t.admin.torOffConfirm)) {
      input.checked = true;
      return;
    }
    busy = true;
    saved = false;
    try {
      info = await api<Overview>('PUT', '/api/settings/tor', { enabled });
      saved = true;
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }
</script>

<section class="card" aria-labelledby="tor-title" data-testid="admin-tor">
  <h2 id="tor-title">{t.admin.torTitle}</h2>
  <p>{t.admin.torIntro}</p>
  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  {#if info}
    <dl>
      <dt>{t.admin.torAddress}</dt>
      <dd class="address">{info.onion ?? t.admin.torNoAddress}</dd>
      <dt>{t.admin.torState}</dt>
      <dd>
        {stateText}
        {#if info.statusAt !== null && info.onion}
          <span class="when">({fill(t.admin.torStateSince, { time: time(info.statusAt) })})</span>
        {/if}
        {#if info.status === 'error' && info.message}<br /><span>{info.message}</span>{/if}
      </dd>
    </dl>
    <label class="switch">
      <input
        type="checkbox"
        checked={info.enabled}
        disabled={busy}
        onchange={(event) => void toggle(event.currentTarget)}
      />
      {t.admin.torSwitch}
    </label>
    <p class="hint">{t.admin.torSwitchHint}</p>
    {#if saved}<p role="status">
        ✔ {info.enabled ? t.admin.torSavedOn : t.admin.torSavedOff}
      </p>{/if}
  {/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }

  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 1rem;
    margin: 0 0 1rem;
  }

  dt {
    font-weight: bold;
  }

  dd {
    margin: 0;
    min-width: 0;
  }

  .address {
    font-family: monospace;
    overflow-wrap: anywhere;
  }

  .when {
    font-size: 0.9em;
  }

  .switch {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
  }

  .switch input {
    width: 1.5rem;
    height: 1.5rem;
  }

  .hint {
    font-size: 0.9em;
  }

  @media (max-width: 30rem) {
    dl {
      grid-template-columns: 1fr;
    }
  }
</style>
