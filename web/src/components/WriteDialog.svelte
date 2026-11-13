<script lang="ts">
  /**
   * v0.8.5: "Brief schreiben" on the card of a ready own or loan owl (SPEC 8.5): pick up to five
   * contacts – or one bot – and the chat opens with this owl and these recipients in the editor.
   */
  import { LETTER } from '@posteulen/shared/constants.ts';
  import { t, fill } from '../lib/i18n.svelte.ts';
  import { live } from '../lib/live.svelte.ts';
  import { navigate } from '../lib/router.svelte.ts';
  import { clearReplyWith, writeWith } from '../lib/reply.svelte.ts';
  import type { Owl } from '../lib/owls.ts';

  let { owl, onclose }: { owl: Owl; onclose: () => void } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let picked = $state<string[]>([]);

  /** Contacts that can get letters right now (active, keys fine – as in the editor). */
  const contacts = $derived(live.contacts.filter((c) => c.active && !c.keyWarning));
  /** Bots that take player owls and can be written to now (one letter a day, SPEC 10.1). */
  const bots = $derived(
    live.bots.filter(
      (b) =>
        (b.type === 'explainer' || b.playerOwls) &&
        (b.writableFrom === null || b.writableFrom <= Date.now()),
    ),
  );
  const botPicked = $derived(picked.some((id) => bots.some((b) => b.userId === id)));
  const full = $derived(picked.length >= LETTER.MAX_RECIPIENTS);

  $effect(() => {
    if (dialog && !dialog.open) dialog.showModal();
  });

  function toggle(id: string, on: boolean): void {
    picked = on ? [...picked, id] : picked.filter((other) => other !== id);
  }

  function write(): void {
    const [first] = picked;
    if (first === undefined) return;
    clearReplyWith();
    writeWith.peerId = first;
    writeWith.owlId = owl.id;
    writeWith.recipients = [...picked];
    dialog?.close();
    navigate(`/app/briefe/${first}`);
  }
</script>

<dialog bind:this={dialog} aria-labelledby="write-title" {onclose}>
  <h2 id="write-title">{fill(t.owls.writeTitle, { name: owl.name ?? '' })}</h2>
  {#if contacts.length === 0 && bots.length === 0}
    <p>{t.owls.writeNobody}</p>
  {:else}
    <p class="hint">{t.owls.writeIntro}</p>
    {#if contacts.length > 0}
      <fieldset>
        <legend>{t.owls.writeContacts}</legend>
        {#each contacts as contact (contact.userId)}
          {@const on = picked.includes(contact.userId)}
          <label class="option">
            <input
              type="checkbox"
              checked={on}
              disabled={!on && (botPicked || full)}
              onchange={(event) => toggle(contact.userId, event.currentTarget.checked)}
            />
            {contact.name}
          </label>
        {/each}
      </fieldset>
    {/if}
    {#if bots.length > 0}
      <fieldset>
        <legend>{t.owls.writeBots}</legend>
        {#each bots as bot (bot.userId)}
          {@const on = picked.includes(bot.userId)}
          <label class="option">
            <input
              type="checkbox"
              checked={on}
              disabled={!on && picked.length > 0}
              onchange={(event) => toggle(bot.userId, event.currentTarget.checked)}
            />
            {bot.name}
          </label>
        {/each}
      </fieldset>
    {/if}
  {/if}
  <div class="buttons">
    {#if contacts.length > 0 || bots.length > 0}
      <button class="button" type="button" disabled={picked.length === 0} onclick={write}
        >{t.owls.writeGo}</button
      >
    {/if}
    <button class="button secondary" type="button" onclick={() => dialog?.close()}
      >{t.owls.cancel}</button
    >
  </div>
</dialog>

<style>
  dialog {
    width: min(100% - 2rem, 30rem);
    max-height: calc(100dvh - 2rem);
    padding: 1.25rem 1.25rem 1rem;
    border: 3px solid var(--wood);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
  }

  dialog::backdrop {
    background: rgb(43 29 14 / 0.55);
  }

  h2 {
    font-size: 1.25rem;
  }

  fieldset {
    border: none;
    padding: 0;
    margin: 0 0 0.75rem;
  }

  legend {
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 400;
    min-height: 2.75rem;
    overflow-wrap: anywhere;
  }

  .option input {
    flex: none;
    width: 1.5rem;
    height: 1.5rem;
    accent-color: var(--wood);
  }

  .hint {
    color: var(--ink-soft);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>
