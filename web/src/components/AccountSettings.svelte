<script lang="ts">
  /** Name, home and deletion (SPEC 7.3–7.5, 8.10). */
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { isLand } from '@posteulen/shared/map/landmask.ts';
  import ErrorText from './ErrorText.svelte';
  import MapView from './MapView.svelte';
  import PasswordInput from './PasswordInput.svelte';
  import { account, changeHome, changeName, deleteAccount } from '../lib/auth.svelte.ts';
  import { landMask } from '../lib/map/map-data.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { navigate } from '../lib/router.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let name = $state('');
  let nameError = $state<string | null>(null);
  let nameDone = $state<string | null>(null);
  let home = $state<{ lat: number; lon: number } | null>(null);
  let homeError = $state<string | null>(null);
  let homeDone = $state(false);
  let password = $state('');
  let deleteError = $state<string | null>(null);
  let busy = $state(false);

  const profile = $derived(account.profile);
  const year = new Date().getUTCFullYear();
  const nameBlocked = $derived((profile?.nameChangedYear ?? 0) >= year);
  const homeBlocked = $derived((profile?.homeChangesLeft ?? 0) <= 0);
  const homeFrom = $derived(
    profile
      ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(
          new Date(`${profile.homeChangeFrom}T00:00:00Z`),
        )
      : '',
  );

  async function run(work: () => Promise<void>, onError: (message: string) => void) {
    if (busy || !status.online) return;
    busy = true;
    try {
      await work();
    } catch (caught) {
      onError(errorMessage(caught));
    } finally {
      busy = false;
    }
  }

  const saveName = () =>
    run(
      async () => {
        nameError = null;
        await changeName(name.trim());
        nameDone = fill(de.settings.nameChanged, { name: account.profile?.name ?? '' });
        name = '';
      },
      (message) => (nameError = message),
    );

  async function pick(position: { lat: number; lon: number }): Promise<void> {
    homeDone = false;
    const rounded = {
      lat: Math.round(position.lat * 100) / 100,
      lon: Math.round(position.lon * 100) / 100,
    };
    if (!isLand(await landMask(), rounded.lat, rounded.lon)) {
      homeError = de.errors.home_invalid;
      home = null;
      return;
    }
    homeError = null;
    home = rounded;
  }

  const saveHome = () =>
    run(
      async () => {
        if (!home) return;
        await changeHome(home);
        home = null;
        homeDone = true;
      },
      (message) => (homeError = message),
    );

  const remove = () =>
    run(
      async () => {
        deleteError = null;
        if (!confirm(de.settings.deleteConfirm)) return;
        const outcome = await deleteAccount(password);
        if (outcome === 'ok') navigate('/', true);
        else if (outcome === 'wrong') deleteError = de.settings.wrongOld;
        else deleteError = fill(de.start.wait, { seconds: outcome.wait });
      },
      (message) => (deleteError = message),
    );
</script>

<section class="card" aria-labelledby="name-title">
  <h2 id="name-title">{de.settings.nameTitle}</h2>
  <p>{de.settings.nameIntro}</p>
  {#if nameBlocked}
    <p class="notice"><span aria-hidden="true">ℹ</span><span>{de.settings.nameBlocked}</span></p>
  {:else}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void saveName();
      }}
    >
      <label for="new-name">{de.settings.newName}</label>
      <input
        id="new-name"
        type="text"
        bind:value={name}
        maxlength="40"
        autocomplete="off"
        required
      />
      <ErrorText message={nameError} />
      <button class="button" type="submit" disabled={busy || !status.online}
        >{de.settings.nameSave}</button
      >
    </form>
  {/if}
  {#if nameDone}<p class="notice" role="status">
      <span aria-hidden="true">✔</span><span>{nameDone}</span>
    </p>{/if}
</section>

<section class="card" aria-labelledby="home-title">
  <h2 id="home-title">{de.settings.homeTitle}</h2>
  <p>{de.settings.homeIntro}</p>
  {#if homeBlocked}
    <p class="notice">
      <span aria-hidden="true">ℹ</span><span
        >{fill(de.settings.homeBlocked, { date: homeFrom })}</span
      >
    </p>
  {:else}
    <p>{fill(de.settings.homeLeft, { count: profile?.homeChangesLeft ?? 0 })}</p>
    <MapView onpick={(position) => void pick(position)}>
      {#snippet markers(toSvg, scale)}
        {#if profile}
          {@const now = toSvg(profile.home.lat, profile.home.lon)}
          <rect
            class="current"
            x={now.x - 9 * scale}
            y={now.y - 9 * scale}
            width={18 * scale}
            height={18 * scale}
          />
        {/if}
        {#if home}
          {@const p = toSvg(home.lat, home.lon)}
          <circle class="pin" cx={p.x} cy={p.y} r={10 * scale} stroke-width={3 * scale} />
        {/if}
      {/snippet}
    </MapView>
    {#if home}
      <p role="status">
        {fill(de.register.homeChosen, {
          lat: home.lat.toFixed(2).replace('.', ','),
          lon: home.lon.toFixed(2).replace('.', ','),
        })}
      </p>
    {/if}
    <ErrorText message={homeError} />
    <button
      class="button"
      type="button"
      disabled={!home || busy || !status.online}
      onclick={() => void saveHome()}>{de.settings.homeSave}</button
    >
  {/if}
  {#if homeDone}<p class="notice" role="status">
      <span aria-hidden="true">✔</span><span>{de.settings.homeChanged}</span>
    </p>{/if}
</section>

<section class="card" aria-labelledby="delete-title">
  <h2 id="delete-title">{de.settings.deleteTitle}</h2>
  <p>{de.settings.deleteIntro}</p>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      void remove();
    }}
  >
    <PasswordInput
      id="delete-password"
      label={de.settings.deletePassword}
      autocomplete="current-password"
      bind:value={password}
    />
    <ErrorText message={deleteError} />
    <button class="button danger" type="submit" disabled={busy || !password || !status.online}
      >{de.settings.deleteButton}</button
    >
  </form>
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }

  input {
    width: 100%;
    max-width: 24rem;
    margin-bottom: 0.75rem;
  }

  .pin {
    fill: var(--seal);
    stroke: var(--paper);
  }

  .current {
    fill: var(--wood);
    opacity: 0.7;
  }
</style>
