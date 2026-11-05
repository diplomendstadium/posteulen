<script lang="ts">
  import { onMount } from 'svelte';
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { SPECIES } from '@posteulen/shared/species.ts';
  import Compose from '../components/Compose.svelte';
  import LetterText from '../components/LetterText.svelte';
  import { api } from '../lib/api.ts';
  import { dateTime, time } from '../lib/format.ts';
  import { loadConversation, type ShownLetter } from '../lib/letters.ts';
  import { live } from '../lib/live.svelte.ts';
  import { navigate } from '../lib/router.svelte.ts';
  import { vault } from '../lib/vault.svelte.ts';

  let { peerId }: { peerId: string } = $props();

  let letters = $state<ShownLetter[]>([]);
  let loading = $state(true);

  const chat = $derived(live.chats.find((c) => c.peerId === peerId));
  const contact = $derived(live.contacts.find((c) => c.userId === peerId));
  const name = $derived(contact?.name ?? chat?.name ?? de.letters.unknown);
  const speciesName = (id: string): string => SPECIES.find((s) => s.id === id)?.name ?? id;

  async function load(): Promise<void> {
    try {
      letters = await loadConversation(peerId);
      loading = false;
      // A letter counts as read once it is shown in the visible conversation (SPEC 8.4).
      const unread = letters
        .filter((l) => l.role === 'recipient' && l.status === 'delivered' && !l.read)
        .map((l) => l.id);
      if (unread.length > 0 && document.visibilityState === 'visible')
        await api('POST', '/api/letters/read', { ids: unread });
      const unseen = letters
        .filter((l) => l.role === 'recipient' && !l.arrivalSeen)
        .map((l) => l.id);
      if (unseen.length > 0) await api('POST', '/api/letters/arrival-seen', { ids: unseen });
    } catch {
      // Offline or navigated away: the next update (SSE or return to the app) loads again.
    }
  }

  onMount(() => {
    void load();
  });

  $effect(() => {
    void live.chatVersion;
    void vault.loaded;
    void load();
  });

  function statusText(letter: ShownLetter): string {
    if (letter.status === 'returned') return de.letters.returned;
    if (letter.status === 'in_flight')
      return fill(de.letters.inFlight, { time: time(letter.arrivesAt) });
    return letter.read ? de.letters.read : de.letters.delivered;
  }

  async function deleteChat(): Promise<void> {
    if (!confirm(de.letters.deleteConfirm)) return;
    await api('DELETE', `/api/chats/${peerId}`);
    navigate('/app/briefe');
  }
</script>

<p class="partner"><span class="name">{name}</span></p>
{#if contact?.keyWarning}
  <p class="warning" role="alert">
    <span aria-hidden="true">⚠</span><span>{fill(de.contacts.keyWarningLong, { name })}</span>
  </p>
{/if}
{#if !contact && !loading}<p class="notice">
    <span aria-hidden="true">ℹ</span><span>{de.letters.notContact}</span>
  </p>{/if}

<ol class="letters" aria-live="polite">
  {#each letters as letter (letter.id)}
    <li class:mine={letter.role === 'sender'}>
      <p class="meta">
        {dateTime(letter.sentAt)} · {letter.parchment === 'large'
          ? de.letters.large
          : de.letters.small}
        {#if letter.role === 'recipient'}
          · {fill(de.letters.from, {
            owl: letter.owl.name,
            species: speciesName(letter.owl.species),
          })}{/if}
      </p>
      {#if letter.text !== null}
        <LetterText text={letter.text} />
      {:else}
        <p class="invalid">
          <span aria-hidden="true">⚠</span> <strong>{de.letters.invalid}</strong> – {de.letters
            .invalidLong}
        </p>
      {/if}
      {#if letter.role === 'sender'}
        <p class="status">
          <span aria-hidden="true"
            >{letter.status === 'returned'
              ? '↩'
              : letter.status === 'in_flight'
                ? '🦉'
                : letter.read
                  ? '✔✔'
                  : '✔'}</span
          >
          {statusText(letter)}
        </p>
      {/if}
    </li>
  {/each}
</ol>

{#if contact && contact.active && !contact.keyWarning}
  <Compose {peerId} onsent={() => void load()} />
{/if}

<p class="danger">
  <button class="button secondary" type="button" onclick={() => void deleteChat()}
    >{de.letters.deleteChat}</button
  >
</p>

<style>
  .partner {
    font-size: 1.2rem;
  }

  .letters {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.75rem;
  }

  .letters li {
    max-width: 85%;
    padding: 0.75rem 1rem;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }

  .letters li.mine {
    margin-left: auto;
    background: #f7eedb;
    border-color: var(--wood);
  }

  .meta,
  .status {
    margin: 0 0 0.25rem;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  .status {
    margin: 0.5rem 0 0;
  }

  .invalid,
  .warning {
    color: var(--seal);
  }

  .warning {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 2px solid var(--seal);
    border-radius: 0.5rem;
    font-weight: 700;
  }

  .danger {
    margin-top: 2rem;
  }
</style>
