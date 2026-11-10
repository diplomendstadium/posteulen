<script lang="ts">
  /**
   * v0.8.2: timed banners for all accounts (SPEC 13 item 11) – shown in the app from start to
   * end, also to accounts created later; each user can hide one on their device.
   */
  import { onMount } from 'svelte';
  import { fill, locale, t } from './lib/i18n.svelte.ts';
  import { api } from './lib/api.ts';
  import { message } from './lib/messages.ts';

  interface Banner {
    id: string;
    textDe: string;
    textEn: string;
    startsAt: number;
    endsAt: number;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const local = (ms: number): string => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const time = (ms: number): string =>
    new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(ms),
    );

  let banners = $state<Banner[]>([]);
  let textDe = $state('');
  let textEn = $state('');
  let start = $state(local(Date.now()));
  let end = $state(local(Date.now() + 7 * 24 * 60 * 60 * 1000));
  let busy = $state(false);
  let error = $state<string | null>(null);
  let done = $state(false);

  async function load(): Promise<void> {
    try {
      banners = (await api<{ banners: Banner[] }>('GET', '/api/banners')).banners;
    } catch (caught) {
      error = message(caught);
    }
  }

  onMount(() => {
    void load();
  });

  async function create(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    busy = true;
    error = null;
    done = false;
    try {
      await api('POST', '/api/banners', {
        textDe,
        textEn,
        startsAt: new Date(start).getTime(),
        endsAt: new Date(end).getTime(),
      });
      textDe = textEn = '';
      done = true;
      await load();
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }

  async function remove(id: string): Promise<void> {
    await api('DELETE', `/api/banners/${id}`).catch((caught: unknown) => (error = message(caught)));
    await load();
  }
</script>

<section class="card" aria-labelledby="banners-title" data-testid="banners">
  <h2 id="banners-title">{t.admin.bannersTitle}</h2>
  <p>{t.admin.bannersIntro}</p>
  <form onsubmit={(event) => void create(event)}>
    <label for="banner-de">{t.admin.bannerTextDe}</label>
    <textarea id="banner-de" rows="2" maxlength="500" bind:value={textDe} required></textarea>
    <label for="banner-en">{t.admin.bannerTextEn}</label>
    <textarea id="banner-en" rows="2" maxlength="500" bind:value={textEn}></textarea>
    <label for="banner-start">{t.admin.bannerStart}</label>
    <input id="banner-start" type="datetime-local" bind:value={start} required />
    <label for="banner-end">{t.admin.bannerEnd}</label>
    <input id="banner-end" type="datetime-local" bind:value={end} required />
    {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
    {#if done}<p role="status">{t.admin.bannerSaved}</p>{/if}
    <button class="button" type="submit" disabled={busy || textDe.trim() === ''}
      >{t.admin.bannerCreate}</button
    >
  </form>
  {#if banners.length === 0}
    <p>{t.admin.bannersNone}</p>
  {:else}
    <ul class="list">
      {#each banners as banner (banner.id)}
        <li>
          <span class="when"
            >{fill(t.admin.bannerPeriod, {
              start: time(banner.startsAt),
              end: time(banner.endsAt),
            })}</span
          >
          <p class="text">{banner.textDe}</p>
          {#if banner.textEn}<p class="text" lang="en">{banner.textEn}</p>{/if}
          <button class="button secondary" type="button" onclick={() => void remove(banner.id)}
            >{t.admin.bannerDelete}</button
          >
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }

  textarea,
  input {
    display: block;
    width: 100%;
    max-width: 30rem;
    min-height: 2.75rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.75rem;
  }

  .list {
    list-style: none;
    padding: 0;
  }

  .list li {
    border-top: 1px solid var(--wood);
    padding: 0.5rem 0;
  }

  .when {
    color: var(--ink-soft);
    font-size: 0.9rem;
  }

  .text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }
</style>
