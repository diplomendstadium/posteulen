<script lang="ts">
  /**
   * v1.4: holiday mode (SPEC 8.10, 9.12). Up to three holidays a calendar year of up to six
   * weeks, starting at once or planned up to three months ahead. Meanwhile the owls stay at the
   * owl care station on Inchlonaig and are home exactly when the holiday ends; ended early, they
   * fly home at once. The times are entered in the time of the device.
   */
  import { onMount } from 'svelte';
  import { VACATION } from '@posteulen/shared/constants.ts';
  import { t, fill } from '../lib/i18n.svelte.ts';
  import ErrorText from './ErrorText.svelte';
  import { api } from '../lib/api.ts';
  import { currentContext, isCurrent } from '../lib/context.ts';
  import { account } from '../lib/auth.svelte.ts';
  import { dateTime } from '../lib/format.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { refreshTopics } from '../lib/live.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  interface VacationView {
    current: { startsAt: number; endsAt: number; active: boolean } | null;
    perYear: number;
    usedThisYear: number;
    usedNextYear: number;
  }

  let view = $state<VacationView | null>(null);
  let startNow = $state(true);
  let start = $state('');
  let end = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let saved = $state<string | null>(null);

  /** A moment as the value of an <input type="datetime-local"> in the time of the device. */
  function local(ms: number): string {
    const date = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
    return date.toISOString().slice(0, 16);
  }

  const left = $derived(view ? Math.max(0, view.perYear - view.usedThisYear) : VACATION.PER_YEAR);
  const minEnd = $derived(
    local(
      (startNow || !start ? Date.now() : new Date(start).getTime()) +
        VACATION.MIN_HOURS * 3_600_000,
    ),
  );

  async function load(): Promise<void> {
    const context = currentContext();
    if (!context) return;
    try {
      const result = await api<VacationView>('GET', '/api/vacation', undefined, { context });
      if (!isCurrent(context)) return;
      view = result;
    } catch (caught) {
      error = errorMessage(caught);
    }
  }

  onMount(() => {
    end = local(Date.now() + 14 * 86_400_000);
    start = local(Date.now() + 86_400_000);
    void load();
  });

  async function run(work: () => Promise<VacationView>, done: string): Promise<void> {
    if (busy || !status.online) return;
    busy = true;
    error = null;
    saved = null;
    const context = currentContext();
    if (!context) {
      busy = false;
      return;
    }
    try {
      const result = await work();
      if (!isCurrent(context)) return;
      view = result;
      saved = done;
      void refreshTopics('profile', 'owls', 'map');
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }

  const plan = (event: SubmitEvent) => {
    event.preventDefault();
    const endsAt = new Date(end).getTime();
    const startsAt = startNow ? null : new Date(start).getTime();
    if (!Number.isFinite(endsAt) || (startsAt !== null && !Number.isFinite(startsAt))) {
      error = t.vacation.badTime;
      return;
    }
    void run(
      () => api<VacationView>('POST', '/api/vacation', { startsAt, endsAt }),
      startNow ? t.vacation.started : t.vacation.planned,
    );
  };

  const cancel = () => {
    if (!confirm(t.vacation.cancelConfirm)) return;
    void run(() => api<VacationView>('POST', '/api/vacation/cancel', {}), t.vacation.cancelled);
  };

  const finish = () => {
    if (!confirm(t.vacation.endConfirm)) return;
    void run(() => api<VacationView>('POST', '/api/vacation/end', {}), t.vacation.ended);
  };

  // The profile knows about a holiday that began or ended meanwhile (event, other tab).
  const current = $derived(account.profile?.vacation ?? view?.current ?? null);
</script>

<section class="card" aria-labelledby="vacation-title" data-testid="vacation-settings">
  <h2 id="vacation-title">{t.vacation.title}</h2>
  <p>{t.vacation.intro}</p>
  <p>{t.vacation.care}</p>
  <p class="hint">
    {fill(t.vacation.rules, { left, perYear: VACATION.PER_YEAR, weeks: VACATION.MAX_DAYS / 7 })}
  </p>
  {#if current?.active}
    <p class="notice" role="status">
      <span aria-hidden="true">🏝</span><span
        >{fill(t.vacation.running, { until: dateTime(current.endsAt) })}</span
      >
    </p>
    <button
      class="button secondary"
      type="button"
      disabled={busy || !status.online}
      onclick={finish}>{t.vacation.end}</button
    >
  {:else if current}
    <p class="notice" role="status">
      <span aria-hidden="true">🧳</span><span
        >{fill(t.vacation.plannedFor, {
          from: dateTime(current.startsAt),
          until: dateTime(current.endsAt),
        })}</span
      >
    </p>
    <button
      class="button secondary"
      type="button"
      disabled={busy || !status.online}
      onclick={cancel}>{t.vacation.cancel}</button
    >
  {:else if view && left > 0}
    <form onsubmit={plan}>
      <fieldset>
        <legend>{t.vacation.startLegend}</legend>
        <label class="option"
          ><input
            type="radio"
            name="vacation-start"
            value="now"
            checked={startNow}
            onchange={() => (startNow = true)}
          />
          {t.vacation.startNow}</label
        >
        <label class="option"
          ><input
            type="radio"
            name="vacation-start"
            value="later"
            checked={!startNow}
            onchange={() => (startNow = false)}
          />
          {t.vacation.startLater}</label
        >
        {#if !startNow}
          <label for="vacation-start">{t.vacation.startAt}</label>
          <input
            id="vacation-start"
            type="datetime-local"
            bind:value={start}
            min={local(Date.now())}
            required
          />
        {/if}
      </fieldset>
      <label for="vacation-end">{t.vacation.endAt}</label>
      <input id="vacation-end" type="datetime-local" bind:value={end} min={minEnd} required />
      <p>
        <button class="button" type="submit" disabled={busy || !status.online}
          >{startNow ? t.vacation.startButton : t.vacation.planButton}</button
        >
      </p>
    </form>
  {:else if view}
    <p>{t.vacation.yearFull}</p>
  {/if}
  {#if saved}<p role="status">✔ {saved}</p>{/if}
  <ErrorText message={error} />
</section>

<style>
  fieldset {
    border: none;
    margin: 0 0 0.75rem;
    padding: 0;
  }

  legend {
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
  }

  .option input {
    width: 1.25rem;
    height: 1.25rem;
  }

  input[type='datetime-local'] {
    display: block;
    min-height: 2.75rem;
    max-width: 16rem;
    margin-bottom: 0.75rem;
  }

  .hint {
    font-size: 0.95em;
  }
</style>
