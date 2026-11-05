<script lang="ts">
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import Link from '../components/Link.svelte';
  import { dateTime } from '../lib/format.ts';
  import { live } from '../lib/live.svelte.ts';
</script>

<ul class="chats">
  <li>
    <Link href="/app/briefe/system" class="chat pinned">
      <span class="icon" aria-hidden="true">📌</span>
      <span class="who">{de.letters.system}</span>
      {#if live.systemUnread > 0}<span class="badge"
          >{fill(de.letters.unread, { count: live.systemUnread })}</span
        >{/if}
    </Link>
  </li>
  {#each live.chats as chat (chat.peerId)}
    <li>
      <Link href={`/app/briefe/${chat.peerId}`} class="chat">
        <span class="icon" aria-hidden="true">✉</span>
        <span class="who name">{chat.name ?? de.letters.unknown}</span>
        <span class="when">{dateTime(chat.lastActivityAt)}</span>
        {#if chat.unread > 0}<span class="badge"
            >{fill(de.letters.unread, { count: chat.unread })}</span
          >{/if}
      </Link>
    </li>
  {/each}
</ul>
{#if live.chats.length === 0}<p class="notice">
    <span aria-hidden="true">ℹ</span><span>{de.letters.none}</span>
  </p>{/if}

<style>
  .chats {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .chats :global(.chat) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    min-height: 3.25rem;
    padding: 0.5rem 1rem;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--ink);
    text-decoration: none;
  }

  .chats :global(.pinned) {
    border-width: 2px;
    border-color: var(--wood);
  }

  .who {
    font-weight: 700;
    flex: 1;
  }

  .when {
    color: var(--ink-soft);
    font-size: 0.9rem;
  }

  .badge {
    border: 2px solid var(--seal);
    color: var(--seal);
    border-radius: 999px;
    padding: 0 0.6rem;
    font-weight: 700;
    font-size: 0.9rem;
  }
</style>
