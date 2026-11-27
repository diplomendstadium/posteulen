<script lang="ts">
  /**
   * v1.4.3: the lower part of „Server der Instanz“ (SPEC 13 item 13): uptime, updates waiting for
   * Debian and PostEulen (checked every hour by posteulen-check.timer), the nightly automatic
   * updates with their switch, and the daily check of public blocklists (not on Tor-only).
   */
  import { onMount } from 'svelte';
  import { t, fill, locale } from './lib/i18n.svelte.ts';
  import { api } from './lib/api.ts';
  import { message } from './lib/messages.ts';
  import { formatDuration } from './lib/time.ts';

  type Group = 'spam_ip' | 'spam_domain' | 'ads';
  interface Result {
    list: string;
    name: string;
    group: Group;
    target: string;
    state: 'clean' | 'listed' | 'unknown';
  }
  interface Info {
    version: string;
    checkedAt: number | null;
    bootAt: number | null;
    aptUpdates: number | null;
    rebootRequired: boolean;
    latest: string | null;
    updateAvailable: boolean | null;
    autoUpdate: {
      enabled: boolean;
      lastRunAt: number | null;
      result: 'ok' | 'error' | 'off' | 'skipped' | null;
      aptUpgraded: number | null;
      posteulen: 'current' | 'updated' | 'error' | null;
      rebooted: boolean;
    };
    blocklists: { torOnly: true } | { torOnly: false; checkedAt: number | null; results: Result[] };
  }

  let info = $state<Info | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let saved = $state(false);
  let now = $state(Date.now());

  const time = (ms: number): string =>
    new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(ms),
    );

  const load = (): void => {
    api<Info>('GET', '/api/server-info')
      .then((result) => {
        info = result;
        now = Date.now();
      })
      .catch((caught: unknown) => (error = message(caught)));
  };

  onMount(() => {
    load();
    // The helper checks every hour; an open panel follows it.
    const timer = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(timer);
  });

  async function toggle(input: HTMLInputElement): Promise<void> {
    busy = true;
    error = null;
    saved = false;
    try {
      info = await api<Info>('PUT', '/api/settings/auto-update', { enabled: input.checked });
      saved = true;
    } catch (caught) {
      input.checked = !input.checked;
      error = message(caught);
    } finally {
      busy = false;
    }
  }

  const uptime = $derived(
    info?.bootAt
      ? fill(t.admin.infoUptimeValue, {
          duration: formatDuration(now - info.bootAt, {
            day: t.admin.durationDay,
            days: t.admin.durationDays,
            hour: t.admin.durationHour,
            hours: t.admin.durationHours,
            minute: t.admin.durationMinute,
            minutes: t.admin.durationMinutes,
          }),
          time: time(info.bootAt),
        })
      : t.admin.infoNotYet,
  );

  const debian = $derived(
    !info || info.checkedAt === null
      ? t.admin.infoNotYet
      : info.aptUpdates === null
        ? t.admin.infoUnknown
        : info.aptUpdates === 0
          ? t.admin.infoDebianNone
          : info.aptUpdates === 1
            ? t.admin.infoDebianOne
            : fill(t.admin.infoDebianSome, { count: info.aptUpdates }),
  );

  const posteulen = $derived(
    !info
      ? ''
      : info.checkedAt === null
        ? t.admin.infoNotYet
        : info.latest === null
          ? fill(t.admin.infoPosteulenUnknown, { version: info.version })
          : info.updateAvailable
            ? fill(t.admin.infoPosteulenNew, { latest: info.latest, version: info.version })
            : fill(t.admin.infoPosteulenCurrent, { version: info.version }),
  );

  const groups: Group[] = ['spam_ip', 'spam_domain', 'ads'];
  const groupText = (group: Group): string =>
    (t.admin as Record<string, string>)[`blockGroup_${group}`] ?? group;
  const stateText = (state: Result['state']): string =>
    (t.admin as Record<string, string>)[`blockState_${state}`] ?? state;
  const resultText = (result: 'ok' | 'error' | 'off' | 'skipped'): string =>
    (t.admin as Record<string, string>)[`autoResult_${result}`] ?? result;
</script>

{#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
{#if info}
  <dl data-testid="server-info">
    <dt>{t.admin.infoUptime}</dt>
    <dd>{uptime}</dd>
    <dt>{t.admin.infoDebian}</dt>
    <dd>
      {debian}
      {#if info.rebootRequired}<br /><span>⚠ {t.admin.infoReboot}</span>{/if}
    </dd>
    <dt>{t.admin.infoPosteulen}</dt>
    <dd>
      {#if info.updateAvailable}<span class="icon" aria-hidden="true">⬆</span>{/if}{posteulen}
    </dd>
  </dl>
  <p class="hint">
    {info.checkedAt === null
      ? t.admin.infoNeverChecked
      : fill(t.admin.infoChecked, { time: time(info.checkedAt) })}
  </p>

  <h3>{t.admin.autoTitle}</h3>
  <p>{t.admin.autoIntro}</p>
  <label class="switch">
    <input
      type="checkbox"
      checked={info.autoUpdate.enabled}
      disabled={busy}
      onchange={(event) => void toggle(event.currentTarget)}
    />
    {t.admin.autoSwitch}
  </label>
  {#if saved}<p role="status">
      ✔ {info.autoUpdate.enabled ? t.admin.autoSavedOn : t.admin.autoSavedOff}
    </p>{/if}
  <dl data-testid="auto-update">
    <dt>{t.admin.autoLast}</dt>
    <dd>
      {#if info.autoUpdate.lastRunAt === null || info.autoUpdate.result === null}
        {t.admin.autoNever}
      {:else}
        {time(info.autoUpdate.lastRunAt)}: {resultText(info.autoUpdate.result)}
        {#if info.autoUpdate.result === 'ok' || info.autoUpdate.result === 'error'}
          <br />
          {info.autoUpdate.posteulen === null
            ? ''
            : `${
                info.autoUpdate.aptUpgraded === null
                  ? t.admin.autoDebianError
                  : fill(t.admin.autoDebian, { count: info.autoUpdate.aptUpgraded })
              } · ${(t.admin as Record<string, string>)[`autoPe_${info.autoUpdate.posteulen}`]}`}
          {#if info.autoUpdate.rebooted}<br />{t.admin.autoRebooted}{/if}
        {/if}
      {/if}
    </dd>
  </dl>

  <h3>{t.admin.blockTitle}</h3>
  {#if info.blocklists.torOnly}
    <p data-testid="blocklists-tor-only">{t.admin.blockTorOnly}</p>
  {:else}
    <p>{t.admin.blockIntro}</p>
    {#if info.blocklists.checkedAt === null}
      <p class="hint">{t.admin.blockNone}</p>
    {:else}
      {@const results = info.blocklists.results}
      {#each groups as group (group)}
        <h4>{groupText(group)}</h4>
        {@const rows = results.filter((result) => result.group === group)}
        {#if rows.length === 0}
          <p class="hint">{t.admin.blockNoAddress}</p>
        {:else}
          <ul class="lists" data-testid={`blocklists-${group}`}>
            {#each rows as row (`${row.list} ${row.target}`)}
              <li class:listed={row.state === 'listed'}>
                <span class="name">{row.name}</span>
                <span class="target">{row.target}</span>
                <span class="state"
                  >{#if row.state === 'listed'}<span class="icon" aria-hidden="true">⚠</span
                    >{/if}{stateText(row.state)}</span
                >
              </li>
            {/each}
          </ul>
        {/if}
      {/each}
      <p class="hint">
        {fill(t.admin.blockChecked, { time: time(info.blocklists.checkedAt) })}
        {#if results.some((result) => result.state === 'unknown')}{t.admin.blockUnknownHint}{/if}
      </p>
    {/if}
  {/if}
{/if}

<style>
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 1rem;
    margin: 1rem 0 0.5rem;
  }

  dt {
    font-weight: bold;
  }

  dd {
    margin: 0;
    min-width: 0;
  }

  h3 {
    margin: 1.5rem 0 0.5rem;
  }

  h4 {
    margin: 1rem 0 0.25rem;
    font-size: 1rem;
  }

  .switch {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
  }

  .switch input {
    width: 1.5rem;
    height: 1.5rem;
  }

  .lists {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .lists li {
    display: grid;
    grid-template-columns: 11rem minmax(0, 1fr) 10rem;
    gap: 0.25rem 1rem;
    padding: 0.25rem 0;
    border-bottom: 1px solid var(--wood-dark);
  }

  .target {
    font-family: monospace;
    overflow-wrap: anywhere;
  }

  .state {
    text-align: right;
  }

  .icon {
    margin-right: 0.3em;
  }

  .listed .state {
    font-weight: 700;
    color: var(--seal);
  }

  .hint {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }

  @media (max-width: 30rem) {
    dl {
      grid-template-columns: 1fr;
    }

    .lists li {
      grid-template-columns: minmax(0, 1fr) max-content;
    }

    .target {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }
</style>
