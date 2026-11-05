<script lang="ts">
  import { onMount } from 'svelte';
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { api } from './lib/api.ts';
  import { message } from './lib/messages.ts';
  import PasswordForm from './PasswordForm.svelte';

  type Mode = 'closed' | 'invite' | 'open';
  interface Invite {
    id: string;
    hint: string;
    expiresAt: number;
  }
  interface Entry {
    id: number;
    at: number;
    component: string;
    severity: 'info' | 'warning' | 'error';
    what: string;
    cause: string;
    action: string;
    read: boolean;
  }

  let mode = $state<Mode>('closed');
  let modeSaved = $state(false);
  let invites = $state<Invite[]>([]);
  let fresh = $state<{ code: string; expiresAt: number } | null>(null);
  let entries = $state<Entry[]>([]);
  let error = $state<string | null>(null);
  let passwordChanged = $state(false);

  const time = (ms: number): string =>
    new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(ms),
    );

  async function load(): Promise<void> {
    try {
      mode = (await api<{ mode: Mode }>('GET', '/api/settings/registration')).mode;
      invites = (await api<{ invites: Invite[] }>('GET', '/api/invites')).invites;
      entries = (await api<{ entries: Entry[] }>('GET', '/api/errors')).entries;
    } catch (caught) {
      error = message(caught);
    }
  }

  onMount(() => {
    void load();
  });

  async function saveMode(event: Event): Promise<void> {
    const value = (event.currentTarget as HTMLSelectElement).value as Mode;
    try {
      mode = (await api<{ mode: Mode }>('PUT', '/api/settings/registration', { mode: value })).mode;
      modeSaved = true;
    } catch (caught) {
      error = message(caught);
    }
  }

  async function createInvite(): Promise<void> {
    try {
      fresh = await api<{ code: string; expiresAt: number }>('POST', '/api/invites', {});
      await load();
    } catch (caught) {
      error = message(caught);
    }
  }

  async function revoke(id: string): Promise<void> {
    await api('DELETE', `/api/invites/${id}`).catch((caught: unknown) => (error = message(caught)));
    await load();
  }

  async function markRead(id: number): Promise<void> {
    await api('PATCH', `/api/errors/${id}`, { read: true }).catch(
      (caught: unknown) => (error = message(caught)),
    );
    await load();
  }

  async function remove(id: number): Promise<void> {
    await api('DELETE', `/api/errors/${id}`).catch((caught: unknown) => (error = message(caught)));
    await load();
  }
</script>

{#if error}<p class="error" role="alert">⚠ {error}</p>{/if}

<section class="card" aria-labelledby="reg-title">
  <h2 id="reg-title">{de.admin.registrationTitle}</h2>
  <select aria-labelledby="reg-title" value={mode} onchange={(event) => void saveMode(event)}>
    <option value="closed">{de.admin.modeClosed}</option>
    <option value="invite">{de.admin.modeInvite}</option>
    <option value="open">{de.admin.modeOpen}</option>
  </select>
  {#if modeSaved}<p role="status">✔ {de.admin.modeSaved}</p>{/if}
</section>

<section class="card" aria-labelledby="inv-title">
  <h2 id="inv-title">{de.admin.invitesTitle}</h2>
  <p>{de.admin.invitesIntro}</p>
  <button class="button" type="button" onclick={() => void createInvite()}
    >{de.admin.inviteCreate}</button
  >
  {#if fresh}
    <p class="code" role="status">
      {fill(de.admin.inviteNew, { code: fresh.code, until: time(fresh.expiresAt) })}
    </p>
  {/if}
  {#if invites.length === 0}
    <p>{de.admin.invitesNone}</p>
  {:else}
    <ul class="list">
      {#each invites as invite (invite.id)}
        <li>
          <span
            >{fill(de.admin.inviteHint, { hint: invite.hint, until: time(invite.expiresAt) })}</span
          >
          <button class="button secondary" type="button" onclick={() => void revoke(invite.id)}
            >{de.admin.inviteRevoke}</button
          >
        </li>
      {/each}
    </ul>
  {/if}
</section>

<section class="card" aria-labelledby="err-title">
  <h2 id="err-title">{de.admin.errorsTitle}</h2>
  {#if entries.length === 0}
    <p>{de.admin.errorsNone}</p>
  {:else}
    <ul class="list errors">
      {#each entries as entry (entry.id)}
        <li>
          <div>
            <p class="what">
              <strong>{de.admin[`severity_${entry.severity}`]}</strong> · {time(entry.at)} · {entry.component}
              {#if !entry.read}<span class="badge">{de.admin.unread}</span>{/if}
            </p>
            <p>{entry.what}</p>
            <p><strong>{de.admin.errorCause}:</strong> {entry.cause}</p>
            <p><strong>{de.admin.errorAction}:</strong> {entry.action}</p>
          </div>
          <div class="buttons">
            {#if !entry.read}<button
                class="button secondary"
                type="button"
                onclick={() => void markRead(entry.id)}>{de.admin.errorRead}</button
              >{/if}
            <button class="button secondary" type="button" onclick={() => void remove(entry.id)}
              >{de.admin.errorDelete}</button
            >
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<section class="card" aria-labelledby="pw-title">
  <h2 id="pw-title">{de.admin.passwordTitle}</h2>
  <PasswordForm ondone={() => (passwordChanged = true)} />
  {#if passwordChanged}<p role="status">✔ {de.admin.changed}</p>{/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }

  select {
    min-height: 2.75rem;
    font: inherit;
    padding: 0.25rem 0.5rem;
  }

  .list {
    list-style: none;
    padding: 0;
  }

  .list li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    padding: 0.5rem 0;
    border-top: 1px solid var(--line);
  }

  .errors li {
    align-items: flex-start;
  }

  .errors p {
    margin: 0 0 0.25rem;
  }

  .buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .code {
    font-weight: 700;
    font-size: 1.2rem;
  }

  .badge {
    border: 2px solid var(--seal);
    color: var(--seal);
    border-radius: 999px;
    padding: 0 0.5rem;
    font-size: 0.85rem;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }
</style>
