<script lang="ts">
  /**
   * v1.3.1: the special status for players (SPEC 9.1.7, 13) – by name, for good or until a point
   * in time: unlimited gold, no limits on giving gold and owls. The list shows only the players
   * who have it now; each can be revoked at once. The player gets a system message both times.
   */
  import { onMount } from 'svelte';
  import { t, fill, locale } from './lib/i18n.svelte.ts';
  import { api } from './lib/api.ts';
  import { message } from './lib/messages.ts';

  interface Entry {
    name: string;
    since: number;
    until: number | null;
  }

  let players = $state<Entry[]>([]);
  let name = $state('');
  let duration = $state<'forever' | 'until'>('forever');
  let until = $state('');
  let done = $state<string | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  const time = (ms: number): string =>
    new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(ms),
    );

  async function load(): Promise<void> {
    try {
      players = (await api<{ players: Entry[] }>('GET', '/api/privileged')).players;
    } catch (caught) {
      error = message(caught);
    }
  }

  onMount(() => {
    void load();
  });

  async function grant(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || name.trim() === '') return;
    error = null;
    done = null;
    // The field holds the local time of this device (datetime-local).
    const end = duration === 'until' ? new Date(until).getTime() : null;
    if (end !== null && !(end > Date.now())) {
      error = t.admin.privilegedPast;
      return;
    }
    busy = true;
    try {
      const entry = await api<Entry>('POST', '/api/privileged', { name: name.trim(), until: end });
      done = fill(t.admin.privilegedGranted, { name: entry.name });
      name = '';
      await load();
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }

  async function revoke(entry: Entry): Promise<void> {
    if (!confirm(fill(t.admin.privilegedRevokeConfirm, { name: entry.name }))) return;
    error = null;
    done = null;
    await api('POST', '/api/privileged/revoke', { name: entry.name }).catch(
      (caught: unknown) => (error = message(caught)),
    );
    await load();
  }
</script>

<section class="card" aria-labelledby="privileged-title">
  <h2 id="privileged-title">{t.admin.privilegedTitle}</h2>
  <p>{t.admin.privilegedIntro}</p>
  <form onsubmit={grant}>
    <label for="privileged-name">{t.admin.privilegedName}</label>
    <input
      id="privileged-name"
      type="text"
      bind:value={name}
      maxlength="40"
      autocomplete="off"
      spellcheck="false"
    />
    <fieldset>
      <legend>{t.admin.privilegedDuration}</legend>
      <label
        ><input type="radio" value="forever" bind:group={duration} />
        {t.admin.privilegedForever}</label
      >
      <label
        ><input type="radio" value="until" bind:group={duration} />
        {t.admin.privilegedUntilOption}</label
      >
    </fieldset>
    {#if duration === 'until'}
      <label for="privileged-until">{t.admin.privilegedUntil}</label>
      <input id="privileged-until" type="datetime-local" bind:value={until} required />
    {/if}
    <p>
      <button class="button" type="submit" disabled={busy}>{t.admin.privilegedGrant}</button>
    </p>
  </form>
  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  {#if done}<p role="status">{done}</p>{/if}
  {#if players.length === 0}
    <p>{t.admin.privilegedNone}</p>
  {:else}
    <ul class="list" data-testid="privileged-list">
      {#each players as entry (entry.name)}
        <li>
          <span
            >{fill(t.admin.privilegedEntry, {
              name: entry.name,
              since: time(entry.since),
              until:
                entry.until === null
                  ? t.admin.privilegedEntryForever
                  : fill(t.admin.privilegedEntryUntil, { until: time(entry.until) }),
            })}</span
          >
          <button class="button secondary" type="button" onclick={() => void revoke(entry)}
            >{t.admin.privilegedRevoke}</button
          >
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }

  fieldset {
    border: none;
    padding: 0;
    margin: 0.75rem 0;
  }

  fieldset label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-right: 1.25rem;
    font-weight: 400;
  }

  .list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .list li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    justify-content: space-between;
  }
</style>
