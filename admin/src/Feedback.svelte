<script lang="ts">
  /**
   * v0.7.1: messages of users to the admin (SPEC 13) – without sender, deleted after 90 days.
   * Shown as plain text only.
   */
  import { onMount } from 'svelte';
  import { t } from './lib/i18n.svelte.ts';
  import { locale } from './lib/i18n.svelte.ts';
  import { api } from './lib/api.ts';
  import { message } from './lib/messages.ts';

  interface Entry {
    id: string;
    text: string;
    createdAt: number;
  }

  let entries = $state<Entry[]>([]);
  let error = $state<string | null>(null);

  const time = (ms: number): string =>
    new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(ms),
    );

  async function load(): Promise<void> {
    try {
      entries = (await api<{ messages: Entry[] }>('GET', '/api/feedback')).messages;
    } catch (caught) {
      error = message(caught);
    }
  }

  onMount(() => {
    void load();
  });

  async function remove(id: string): Promise<void> {
    await api('DELETE', `/api/feedback/${id}`).catch(
      (caught: unknown) => (error = message(caught)),
    );
    await load();
  }
</script>

<section class="card" aria-labelledby="feedback-title">
  <h2 id="feedback-title">{t.admin.feedbackTitle}</h2>
  <p>{t.admin.feedbackIntro}</p>
  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  {#if entries.length === 0}
    <p>{t.admin.feedbackNone}</p>
  {:else}
    <ul class="list">
      {#each entries as entry (entry.id)}
        <li>
          <span class="when">{time(entry.createdAt)}</span>
          <p class="text">{entry.text}</p>
          <button class="button secondary" type="button" onclick={() => void remove(entry.id)}
            >{t.admin.feedbackDelete}</button
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

  .list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.75rem;
  }

  .list li {
    border-top: 1px solid var(--line);
    padding-top: 0.75rem;
  }

  .when {
    color: var(--ink-soft);
    font-size: 0.9rem;
  }

  .text {
    margin: 0.25rem 0 0.5rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }
</style>
