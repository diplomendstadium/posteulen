<script lang="ts">
  import { onMount } from 'svelte';
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { api } from '../lib/api.ts';
  import { dateTime } from '../lib/format.ts';
  import { live } from '../lib/live.svelte.ts';

  interface Message {
    id: string;
    type: string;
    params: Record<string, string | number>;
    createdAt: number;
    seen: boolean;
  }
  let messages = $state<Message[]>([]);

  async function load(): Promise<void> {
    try {
      messages = (await api<{ messages: Message[] }>('GET', '/api/system-messages')).messages;
      if (messages.some((m) => !m.seen)) await api('POST', '/api/system-messages/seen', {});
    } catch {
      // Loaded again with the next update.
    }
  }

  onMount(() => {
    void load();
  });

  $effect(() => {
    void live.systemUnread;
    if (live.systemUnread > 0) void load();
  });

  const textOf = (message: Message): string =>
    fill((de.system as Record<string, string>)[message.type] ?? message.type, message.params);
</script>

<ul class="messages" aria-live="polite">
  {#each messages as message (message.id)}
    <li><span class="when">{dateTime(message.createdAt)}</span> {textOf(message)}</li>
  {/each}
</ul>
<p class="hint">{de.letters.noReply}</p>

<style>
  .messages {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .messages li {
    padding: 0.75rem 1rem;
    background: var(--paper);
    border-left: 4px solid var(--wood);
    border-radius: 0.5rem;
  }

  .when {
    display: block;
    color: var(--ink-soft);
    font-size: 0.9rem;
  }

  .hint {
    color: var(--ink-soft);
  }
</style>
