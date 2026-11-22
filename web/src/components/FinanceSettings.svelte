<script lang="ts">
  /**
   * v0.10: gold and bookings in the settings (SPEC 8.10) – the balance, the daily gold with its
   * rule and the last 20 bookings. Before v0.10 this was the page "Finanzen"; sending gold now
   * starts at the owl that carries it (8.5).
   */
  import { t, fill, formatGold, goldText } from '../lib/i18n.svelte.ts';
  import { GOLD } from '@posteulen/shared/constants.ts';
  import { finance, type Transaction } from '../lib/owls.ts';
  import { dateTime, time } from '../lib/format.ts';
  import { live } from '../lib/live.svelte.ts';
  import { account } from '../lib/auth.svelte.ts';
  import { privileged } from '../lib/purse.ts';

  let gold = $state(0);
  let transactions = $state<Transaction[]>([]);

  const typeTexts = t.finance as Record<string, string>;
  // Local time of the pay hour (03:00 UTC since v0.7) today (changes with daylight saving time).
  const today = new Date();
  const dailyTime = time(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), GOLD.DAILY_HOUR_UTC),
  );

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
</script>

<section class="card" aria-labelledby="finance-title" data-testid="finance">
  <h2 id="finance-title">{t.finance.title}</h2>
  <p class="balance">
    {fill(t.finance.balance, { amount: privileged() ? t.finance.endless : goldText(gold) })}
  </p>
  {#if privileged()}
    <!-- v1.3.1: the special status set by the admin (SPEC 9.1.7). -->
    <p class="notice" data-testid="privileged">
      <span aria-hidden="true">✨</span><span
        >{account.profile?.privileged?.until
          ? fill(t.finance.privilegedUntil, {
              until: dateTime(account.profile.privileged.until),
              amount: goldText(gold),
            })
          : fill(t.finance.privileged, { amount: goldText(gold) })}</span
      >
    </p>
  {/if}
  <p class="hint">
    {fill(t.finance.daily, {
      time: dailyTime,
      amount: goldText(account.profile?.dailyGold ?? GOLD.DAILY_LATER),
    })}
    {t.finance.dailyRule}
  </p>
  <h3 id="tx-title">{t.finance.transactions}</h3>
  {#if transactions.length === 0}
    <p>{t.finance.none}</p>
  {:else}
    <!-- Scrolls sideways on narrow screens; a scrollable region must be reachable by keyboard
         (WCAG 2.1.1, axe scrollable-region-focusable), hence tabindex on a labelled group. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="table-wrap" tabindex="0" role="group" aria-labelledby="tx-title">
      <table>
        <thead>
          <tr>
            <th scope="col">{t.finance.date}</th>
            <th scope="col">{t.finance.kind}</th>
            <th scope="col" class="amount">{t.finance.amount}</th>
            <th scope="col">{t.finance.counterpart}</th>
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
                  : (entry.counterpart ?? t.letters.unknown)}</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }

  .balance {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0;
  }

  .hint {
    color: var(--ink-soft);
  }

  h3 {
    font-size: 1.1rem;
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
