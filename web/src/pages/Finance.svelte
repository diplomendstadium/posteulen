<script lang="ts">
  /** Finance overview (SPEC 8.6): balance, last 20 transactions, gold by owl. */
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { GOLD } from '@posteulen/shared/constants.ts';
  import {
    formatGold,
    maxTransfer,
    parseGold,
    transferProblem,
  } from '@posteulen/shared/game/gold.ts';
  import CoverInput from '../components/CoverInput.svelte';
  import ErrorText from '../components/ErrorText.svelte';
  import OwlChoice from '../components/OwlChoice.svelte';
  import { KeyMismatchError } from '../lib/letters.ts';
  import {
    finance,
    previewFlights,
    sendGold,
    type OwlChoice as Choice,
    type Transaction,
  } from '../lib/owls.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { dateTime, time } from '../lib/format.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { showOwlImage } from '../lib/overlay.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let gold = $state(0);
  let transactions = $state<Transaction[]>([]);
  let recipient = $state('');
  let amountText = $state('');
  let cover = $state<string | null>(null);
  let choices = $state<Choice[] | null>(null);
  let owlId = $state<string | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let sent = $state<string | null>(null);

  const goldText = (tenths: number): string => `${formatGold(tenths)} Gold`;
  const contacts = $derived(live.contacts.filter((c) => c.active && !c.keyWarning));
  const nameOf = (id: string): string =>
    live.contacts.find((c) => c.userId === id)?.name ?? de.letters.unknown;
  const typeTexts = de.finance as Record<string, string>;
  // Local time of 15:00 UTC today (changes with daylight saving time).
  const today = new Date();
  const dailyTime = time(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), GOLD.DAILY_HOUR_UTC),
  );
  const possible = $derived(maxTransfer(gold));

  async function load(): Promise<void> {
    try {
      const result = await finance();
      gold = result.gold;
      transactions = result.transactions;
    } catch {
      // Loaded again with the next update.
    }
  }

  $effect(() => {
    void live.financeVersion;
    void load();
  });

  async function chooseOwl(): Promise<void> {
    error = null;
    sent = null;
    const amount = parseGold(amountText);
    if (amount === undefined) return void (error = de.finance.amountInvalid);
    const problem = transferProblem(gold, amount);
    if (problem) return void (error = de.errors[problem]);
    if (!recipient) return;
    busy = true;
    try {
      choices = await previewFlights([recipient]);
      owlId = choices.find((choice) => !choice.offer)?.id ?? null;
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }

  async function send(): Promise<void> {
    const amount = parseGold(amountText);
    if (amount === undefined || !owlId || busy) return;
    busy = true;
    error = null;
    try {
      const result = await sendGold(recipient, amount, owlId, cover);
      showOwlImage(
        result.owl.species,
        'departure',
        fill(de.owls.departs, { name: result.owl.name }),
      );
      sent = fill(de.finance.sent, {
        owl: result.owl.name,
        amount: goldText(amount),
        name: nameOf(recipient),
        time: dateTime(result.arrivesAt),
      });
      choices = null;
      amountText = '';
      await Promise.all([load(), refreshTopics('profile')]);
    } catch (caught) {
      error =
        caught instanceof KeyMismatchError
          ? fill(de.contacts.keyWarningLong, { name: nameOf(caught.message) })
          : errorMessage(caught);
    } finally {
      busy = false;
    }
  }
</script>

<div class="card summary">
  <p class="balance">{fill(de.finance.balance, { amount: goldText(gold) })}</p>
  <p class="hint">{fill(de.finance.daily, { time: dailyTime })}</p>
</div>

<section class="card" aria-labelledby="send-title">
  <h2 id="send-title">{de.finance.sendTitle}</h2>
  <p class="hint">{de.finance.sendHint}</p>
  {#if possible <= 0}
    <p class="notice"><span aria-hidden="true">ℹ</span><span>{de.finance.notPossible}</span></p>
  {:else}
    <p>{fill(de.finance.maxNow, { amount: goldText(possible) })}</p>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void (choices ? send() : chooseOwl());
      }}
    >
      <label for="gold-to">{de.finance.recipient}</label>
      <select id="gold-to" bind:value={recipient} required onchange={() => (choices = null)}>
        <option value="">{de.letters.choose}</option>
        {#each contacts as contact (contact.userId)}<option value={contact.userId}
            >{contact.name}</option
          >{/each}
      </select>
      <label for="gold-amount">{de.finance.amountLabel}</label>
      <input
        id="gold-amount"
        inputmode="decimal"
        bind:value={amountText}
        required
        oninput={() => (choices = null)}
      />
      <CoverInput bind:value={cover} id="gold-cover" />
      {#if choices}
        <OwlChoice {choices} bind:selected={owlId} name="gold-owl" />
      {/if}
      <ErrorText message={error} />
      {#if sent}<p class="notice" role="status">
          <span aria-hidden="true">🦉</span><span>{sent}</span>
        </p>{/if}
      <button
        class="button"
        type="submit"
        disabled={busy || !status.online || (choices !== null && !owlId)}
      >
        {choices ? de.finance.send : de.letters.preview}
      </button>
    </form>
  {/if}
</section>

<section class="card" aria-labelledby="tx-title">
  <h2 id="tx-title">{de.finance.transactions}</h2>
  {#if transactions.length === 0}
    <p>{de.finance.none}</p>
  {:else}
    <!-- Scrolls sideways on narrow screens; a scrollable region must be reachable by keyboard
         (WCAG 2.1.1, axe scrollable-region-focusable), hence tabindex on a labelled group. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="table-wrap" tabindex="0" role="group" aria-labelledby="tx-title">
      <table>
        <thead>
          <tr>
            <th scope="col">{de.finance.date}</th>
            <th scope="col">{de.finance.kind}</th>
            <th scope="col" class="amount">{de.finance.amount}</th>
            <th scope="col">{de.finance.counterpart}</th>
          </tr>
        </thead>
        <tbody>
          {#each transactions as entry (entry.id)}
            <tr>
              <td>{dateTime(entry.at)}</td>
              <td
                >{fill(typeTexts[`type_${entry.type}`] ?? entry.type, {
                  name: entry.counterpart ?? '',
                })}</td
              >
              <td class="amount" class:minus={entry.amount < 0}>
                {entry.amount > 0 ? '+' : '−'}{formatGold(Math.abs(entry.amount))}
              </td>
              <td
                >{entry.counterpart === undefined
                  ? ''
                  : (entry.counterpart ?? de.letters.unknown)}</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .summary {
    margin-bottom: 1rem;
  }

  .summary > :last-child {
    margin-bottom: 0;
  }

  .balance {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0;
  }

  .hint {
    color: var(--ink-soft);
  }

  section {
    margin-top: 1.5rem;
  }

  select,
  input {
    width: 100%;
    max-width: 24rem;
    margin-bottom: 0.75rem;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--paper);
  }

  th,
  td {
    text-align: left;
    padding: 0.5rem;
    border-bottom: 1px solid var(--line);
  }

  .amount {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .minus {
    color: var(--seal);
  }
</style>
