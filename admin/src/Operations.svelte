<script lang="ts">
  /** Statistics, inactivity period and broadcasts (SPEC 13 items 1, 2, 4, 6). */
  import { onMount } from 'svelte';
  import { t, fill } from './lib/i18n.svelte.ts';
  import { locale } from './lib/i18n.svelte.ts';
  import { api } from './lib/api.ts';
  import { message } from './lib/messages.ts';

  interface Stats {
    accounts: { created: number; current: number; active30: number };
    letters: { total: number; last7: number };
  }
  interface Sent {
    id: number;
    createdAt: number;
    text: string;
  }

  let stats = $state<Stats | null>(null);
  let days = $state(180);
  let minimum = $state(60);
  let daysSaved = $state(false);
  let text = $state('');
  let sent = $state<Sent[]>([]);
  let sentCount = $state<number | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  const time = (ms: number): string =>
    new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(ms),
    );

  async function load(): Promise<void> {
    try {
      stats = await api<Stats>('GET', '/api/stats');
      const inactivity = await api<{ days: number; minimum: number }>(
        'GET',
        '/api/settings/inactivity',
      );
      days = inactivity.days;
      minimum = inactivity.minimum;
      sent = (await api<{ broadcasts: Sent[] }>('GET', '/api/broadcasts')).broadcasts;
    } catch (caught) {
      error = message(caught);
    }
  }

  onMount(() => {
    void load();
  });

  async function saveDays(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    daysSaved = false;
    try {
      days = (await api<{ days: number }>('PUT', '/api/settings/inactivity', { days })).days;
      daysSaved = true;
    } catch (caught) {
      error = message(caught);
    }
  }

  async function broadcast(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || text.trim() === '' || !confirm(t.admin.broadcastConfirm)) return;
    busy = true;
    try {
      sentCount = (await api<{ recipients: number }>('POST', '/api/broadcasts', { text }))
        .recipients;
      text = '';
      await load();
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }
</script>

{#if error}<p class="error" role="alert">⚠ {error}</p>{/if}

<section class="card" aria-labelledby="stats-title">
  <h2 id="stats-title">{t.admin.statsTitle}</h2>
  {#if stats}
    <ul class="plain" data-testid="admin-stats">
      <li>{fill(t.admin.statsCreated, { count: stats.accounts.created })}</li>
      <li>{fill(t.admin.statsCurrent, { count: stats.accounts.current })}</li>
      <li>{fill(t.admin.statsActive, { count: stats.accounts.active30 })}</li>
      <li>
        {fill(t.admin.statsLetters, { total: stats.letters.total, last7: stats.letters.last7 })}
      </li>
    </ul>
  {/if}
</section>

<section class="card" aria-labelledby="inactivity-title">
  <h2 id="inactivity-title">{t.admin.inactivityTitle}</h2>
  <p>{t.admin.inactivityIntro}</p>
  <form onsubmit={(event) => void saveDays(event)}>
    <label for="inactivity-days">{t.admin.inactivityDays}</label>
    <input
      id="inactivity-days"
      type="number"
      min={minimum}
      max="3650"
      step="1"
      bind:value={days}
      required
    />
    <button class="button" type="submit">{t.admin.inactivitySave}</button>
    {#if daysSaved}<p role="status">✔ {t.admin.modeSaved}</p>{/if}
  </form>
</section>

<section class="card" aria-labelledby="broadcast-title">
  <h2 id="broadcast-title">{t.admin.broadcastTitle}</h2>
  <p>{t.admin.broadcastIntro}</p>
  <form onsubmit={(event) => void broadcast(event)}>
    <label for="broadcast-text">{t.admin.broadcastText}</label>
    <textarea id="broadcast-text" rows="5" maxlength="3000" bind:value={text} required></textarea>
    <button class="button" type="submit" disabled={busy || text.trim() === ''}
      >{t.admin.broadcastSend}</button
    >
    {#if sentCount !== null}<p role="status">
        ✔ {fill(t.admin.broadcastSent, { count: sentCount })}
      </p>{/if}
  </form>
  {#if sent.length === 0}
    <p>{t.admin.broadcastsNone}</p>
  {:else}
    <ul class="plain sent">
      {#each sent as item (item.id)}
        <li><strong>{time(item.createdAt)}</strong> – {item.text}</li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }

  .plain {
    padding-left: 1.25rem;
  }

  .sent li {
    white-space: pre-wrap;
    margin-bottom: 0.5rem;
  }

  input,
  textarea {
    display: block;
    width: 100%;
    max-width: 40rem;
    min-height: 2.75rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.75rem;
  }

  input {
    max-width: 10rem;
  }
</style>
