<script lang="ts">
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import ErrorText from '../components/ErrorText.svelte';
  import Link from '../components/Link.svelte';
  import { api } from '../lib/api.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { status } from '../lib/status.svelte.ts';
  import {
    markCompared,
    openRequestLabel,
    requestLabel,
    safetyNumberWith,
    vault,
  } from '../lib/vault.svelte.ts';

  let name = $state('');
  let notice = $state<string | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let shown = $state<Record<string, string>>({});
  let labels = $state<Record<string, string>>({});

  $effect(() => {
    for (const request of live.requests) {
      if (labels[request.id] === undefined) {
        void openRequestLabel(request.label).then(
          (text) => (labels = { ...labels, [request.id]: text }),
        );
      }
    }
  });

  async function add(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || name.trim() === '') return;
    busy = true;
    error = notice = null;
    try {
      await api('POST', '/api/contacts/requests', { name, label: await requestLabel(name) });
      notice = fill(de.contacts.requestSaved, { name });
      name = '';
      await refreshTopics('contacts');
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }

  async function toggleSafety(userId: string): Promise<void> {
    if (shown[userId]) {
      shown = Object.fromEntries(Object.entries(shown).filter(([id]) => id !== userId));
      return;
    }
    shown = { ...shown, [userId]: (await safetyNumberWith(userId)) ?? '…' };
  }

  async function remove(userId: string, contactName: string, isBot = false): Promise<void> {
    const question = isBot ? de.bots.removeConfirm : de.contacts.removeConfirm;
    if (!confirm(fill(question, { name: contactName }))) return;
    await api('DELETE', `/api/contacts/${userId}`).catch(
      (caught: unknown) => (error = errorMessage(caught)),
    );
  }

  const hoursLeft = (expiresAt: number): number =>
    Math.max(1, Math.ceil((expiresAt - Date.now()) / 3_600_000));
</script>

<section class="card" aria-labelledby="add-title">
  <h2 id="add-title">{de.contacts.addTitle}</h2>
  <p>{de.contacts.addIntro}</p>
  <form onsubmit={add} novalidate>
    <label for="contact-name">{de.contacts.name}</label>
    <input id="contact-name" type="text" autocomplete="off" maxlength="100" bind:value={name} />
    <p class="actions">
      <button class="button" type="submit" disabled={busy || !status.online}
        >{de.contacts.add}</button
      >
    </p>
  </form>
  {#if notice}<p class="notice" role="status">
      <span aria-hidden="true">✉</span><span>{notice}</span>
    </p>{/if}
  <ErrorText message={error} />
</section>

{#each vault.changedKeys as changed (changed)}
  <p class="warning" role="alert">
    ⚠ {fill(de.contacts.keysChanged, {
      name: live.contacts.find((c) => c.userId === changed)?.name ?? '',
    })}
  </p>
{/each}

{#if live.bots.length > 0}
  <section aria-labelledby="bots-title">
    <h2 id="bots-title">{de.bots.title}</h2>
    <ul class="contacts">
      {#each live.bots as bot (bot.userId)}
        <li class="contact" data-testid="bot-contact">
          <span class="name"
            ><span aria-hidden="true">🤖</span>
            {bot.name}
            <span class="bot-label">{de.bots.label}</span></span
          >
          <span class="state">{(de.bots as Record<string, string>)[`type_${bot.type}`]}</span>
          <div class="buttons">
            <Link href={`/app/briefe/${bot.userId}`} class="button">{de.contacts.write}</Link>
            <button
              class="button secondary"
              type="button"
              onclick={() => void remove(bot.userId, bot.name, true)}>{de.contacts.remove}</button
            >
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<ul class="contacts">
  {#each live.requests as request (request.id)}
    <li class="contact">
      <span class="name">{labels[request.id] ?? '…'}</span>
      <span class="state"
        ><span aria-hidden="true">⏳</span>
        {fill(de.contacts.pending, { hours: hoursLeft(request.expiresAt) })}</span
      >
      <button
        class="button secondary"
        type="button"
        onclick={() =>
          void api('DELETE', `/api/contacts/requests/${request.id}`).then(
            () => (live.requests = live.requests.filter((r) => r.id !== request.id)),
          )}>{de.contacts.cancel}</button
      >
    </li>
  {/each}
  {#each live.contacts as contact (contact.userId)}
    {@const compared = vault.entries[contact.userId]?.entry.compared ?? false}
    <li class="contact" data-testid="person-contact">
      <span class="name">{contact.name}</span>
      <span class="state">
        {#if contact.keyWarning}<span class="bad"
            ><span aria-hidden="true">⚠</span> {de.contacts.keyWarning}</span
          >{/if}
        {#if !contact.active}<span><span aria-hidden="true">💤</span> {de.contacts.inactive}</span
          >{/if}
        {#if compared}<span><span aria-hidden="true">✔</span> {de.contacts.compared}</span
          >{:else}<span><span aria-hidden="true">?</span> {de.contacts.notCompared}</span>{/if}
      </span>
      <div class="buttons">
        {#if contact.active && !contact.keyWarning}<Link
            href={`/app/briefe/${contact.userId}`}
            class="button">{de.contacts.write}</Link
          >{/if}
        <button
          class="button secondary"
          type="button"
          aria-expanded={shown[contact.userId] !== undefined}
          onclick={() => void toggleSafety(contact.userId)}
        >
          {shown[contact.userId] ? de.contacts.hide : de.contacts.show}
        </button>
        <button
          class="button secondary"
          type="button"
          onclick={() => void remove(contact.userId, contact.name)}>{de.contacts.remove}</button
        >
      </div>
      {#if shown[contact.userId]}
        <div class="safety">
          <h3 class="name">{fill(de.contacts.safetyTitle, { name: contact.name })}</h3>
          <p>{de.contacts.safetyIntro}</p>
          <p class="number" data-testid="safety-number">{shown[contact.userId]}</p>
          {#if !compared}
            <button class="button" type="button" onclick={() => void markCompared(contact.userId)}
              >{fill(de.contacts.safetyConfirm, { name: contact.name })}</button
            >
          {/if}
          <p class="hint">{de.contacts.safetyNote}</p>
        </div>
      {/if}
    </li>
  {/each}
</ul>
{#if live.contacts.length === 0 && live.requests.length === 0}<p class="notice">
    <span aria-hidden="true">ℹ</span><span>{de.contacts.none}</span>
  </p>{/if}

<style>
  .bot-label {
    margin-left: 0.25rem;
    padding: 0 0.5rem;
    border: 2px solid var(--wood);
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.9rem;
  }

  section {
    margin-bottom: 1.5rem;
  }

  .actions {
    margin-top: 0.75rem;
  }

  .contacts {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.75rem;
  }

  .contact {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }

  .contact .name {
    flex: 1 1 10rem;
  }

  .state {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    color: var(--ink-soft);
  }

  .bad,
  .warning {
    color: var(--seal);
    font-weight: 700;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    width: 100%;
  }

  .safety {
    width: 100%;
    border-top: 1px solid var(--line);
    padding-top: 0.75rem;
  }

  .safety h3 {
    font-size: 1.05rem;
  }

  .number {
    font-family: ui-monospace, monospace;
    font-size: 1.15rem;
    letter-spacing: 0.05em;
    word-spacing: 0.4em;
    max-width: 22rem;
  }

  .hint {
    color: var(--ink-soft);
    font-size: 0.95rem;
  }
</style>
