<script lang="ts">
  /**
   * v0.10: "Gold verschicken" on the card of a ready own or loan owl that carries gold (SPEC 8.5,
   * 9.1.4): one contact, the amount and an optional cover letter; the server-computed arrival of
   * exactly this owl is shown before sending. Before v0.10 this was part of the finance page.
   */
  import { t, fill, goldText } from '../lib/i18n.svelte.ts';
  import { maxTransfer, parseGold, transferProblem } from '@posteulen/shared/game/gold.ts';
  import CoverInput from './CoverInput.svelte';
  import ErrorText from './ErrorText.svelte';
  import { KeyMismatchError } from '../lib/letters.ts';
  import { previewFlights, sendGold, type Owl } from '../lib/owls.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { dateTime } from '../lib/format.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { account } from '../lib/auth.svelte.ts';
  import { showOwlImage } from '../lib/overlay.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let { owl, onclose, onsent }: { owl: Owl; onclose: () => void; onsent: () => void } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let recipient = $state('');
  let amountText = $state('');
  let cover = $state<string | null>(null);
  let arrival = $state<number | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const gold = $derived(account.profile?.gold ?? 0);
  const possible = $derived(maxTransfer(gold));
  const contacts = $derived(live.contacts.filter((c) => c.active && !c.keyWarning));
  const nameOf = (id: string): string =>
    live.contacts.find((c) => c.userId === id)?.name ?? t.letters.unknown;

  $effect(() => {
    if (dialog && !dialog.open) dialog.showModal();
  });

  async function check(): Promise<void> {
    error = null;
    const amount = parseGold(amountText);
    if (amount === undefined) return void (error = t.finance.amountInvalid);
    const problem = transferProblem(gold, amount);
    if (problem) return void (error = t.errors[problem]);
    if (!recipient) return;
    busy = true;
    try {
      const choices = await previewFlights([recipient]);
      const mine = choices.find((choice) => choice.id === owl.id);
      if (!mine) return void (error = t.errors.owl_not_ready);
      arrival = mine.arrivals[0]?.at ?? null;
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }

  async function send(): Promise<void> {
    const amount = parseGold(amountText);
    if (amount === undefined || busy) return;
    busy = true;
    error = null;
    try {
      const result = await sendGold(recipient, amount, owl.id, cover);
      showOwlImage(
        result.owl.species,
        'departure',
        `${fill(t.owls.departs, { name: result.owl.name })} ${fill(t.finance.sent, {
          owl: result.owl.name,
          amount: goldText(amount),
          name: nameOf(recipient),
          time: dateTime(result.arrivesAt),
        })}`,
      );
      await refreshTopics('profile', 'owls');
      onsent();
      dialog?.close();
    } catch (caught) {
      error =
        caught instanceof KeyMismatchError
          ? fill(t.contacts.keyWarningLong, { name: nameOf(caught.message) })
          : errorMessage(caught);
    } finally {
      busy = false;
    }
  }
</script>

<dialog bind:this={dialog} aria-labelledby="gold-title" {onclose} data-testid="gold-dialog">
  <h2 id="gold-title">{fill(t.finance.sendTitle, { owl: owl.name ?? '' })}</h2>
  <p class="hint">{t.finance.sendHint}</p>
  {#if possible <= 0}
    <p class="notice"><span aria-hidden="true">ℹ</span><span>{t.finance.notPossible}</span></p>
  {:else if contacts.length === 0}
    <p>{t.owls.writeNobody}</p>
  {:else}
    <p>{fill(t.finance.maxNow, { amount: goldText(possible) })}</p>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void (arrival === null ? check() : send());
      }}
    >
      <label for="gold-to">{t.finance.recipient}</label>
      <select id="gold-to" bind:value={recipient} required onchange={() => (arrival = null)}>
        <option value="">{t.letters.choose}</option>
        {#each contacts as contact (contact.userId)}<option value={contact.userId}
            >{contact.name}</option
          >{/each}
      </select>
      <label for="gold-amount">{t.finance.amountLabel}</label>
      <input
        id="gold-amount"
        inputmode="decimal"
        bind:value={amountText}
        required
        oninput={() => (arrival = null)}
      />
      <CoverInput bind:value={cover} id="gold-cover" />
      {#if arrival !== null}
        <p class="notice" role="status">
          <span aria-hidden="true">🦉</span><span
            >{fill(t.letters.arrival, { name: nameOf(recipient), time: dateTime(arrival) })}</span
          >
        </p>
      {/if}
      <ErrorText message={error} />
      <div class="buttons">
        <button class="button" type="submit" disabled={busy || !status.online}>
          {arrival === null ? t.finance.check : t.finance.send}
        </button>
        <button class="button secondary" type="button" onclick={() => dialog?.close()}
          >{t.owls.cancel}</button
        >
      </div>
    </form>
  {/if}
  {#if possible <= 0 || contacts.length === 0}
    <div class="buttons">
      <button class="button secondary" type="button" onclick={() => dialog?.close()}
        >{t.owls.cancel}</button
      >
    </div>
  {/if}
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

  .hint {
    color: var(--ink-soft);
  }

  select,
  input {
    display: block;
    width: 100%;
    min-height: 2.75rem;
    font: inherit;
    padding: 0 0.75rem;
    margin-bottom: 0.75rem;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
</style>
