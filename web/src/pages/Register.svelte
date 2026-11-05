<script lang="ts">
  import { onMount } from 'svelte';
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { checkPassword, checkUserName } from '@posteulen/shared/names.ts';
  import { isLand } from '@posteulen/shared/map/landmask.ts';
  import Link from '../components/Link.svelte';
  import ErrorText from '../components/ErrorText.svelte';
  import PasswordInput from '../components/PasswordInput.svelte';
  import MapView from '../components/MapView.svelte';
  import { api } from '../lib/api.ts';
  import { register } from '../lib/auth.svelte.ts';
  import { landMask } from '../lib/map/map-data.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { navigate } from '../lib/router.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let mode = $state<'closed' | 'invite' | 'open' | null>(null);
  let name = $state('');
  let password = $state('');
  let repeat = $state('');
  let inviteCode = $state('');
  let confirmed = $state(false);
  let home = $state<{ lat: number; lon: number } | null>(null);
  let homeError = $state<string | null>(null);
  let error = $state<string | null>(null);
  let busy = $state<string | null>(null);
  const mask = landMask();

  onMount(() => {
    api<{ mode: 'closed' | 'invite' | 'open' }>('GET', '/api/registration')
      .then((result) => (mode = result.mode))
      .catch((caught: unknown) => (error = errorMessage(caught)));
  });

  async function pick(position: { lat: number; lon: number }): Promise<void> {
    const rounded = {
      lat: Math.round(position.lat * 100) / 100,
      lon: Math.round(position.lon * 100) / 100,
    };
    // Instant feedback from the land mask; the server checks again (SPEC 12.3).
    if (!isLand(await mask, rounded.lat, rounded.lon)) {
      home = null;
      homeError = de.register.homeWater;
      return;
    }
    homeError = null;
    home = rounded;
  }

  function localError(): string | null {
    const checked = checkUserName(name);
    if (typeof checked === 'string')
      return (de.errors as Record<string, string>)[`name_${checked}`] ?? de.errors.bad_request;
    const passwordError = checkPassword(password);
    if (passwordError === 'too_short') return de.register.tooShort;
    if (passwordError === 'too_long') return de.register.tooLong;
    if (password !== repeat) return de.register.mismatch;
    if (!home) return de.register.homeMissing;
    if (!confirmed) return de.register.confirmRequired;
    return null;
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || !status.online) return;
    error = localError();
    if (error || !home) return;
    busy = de.register.stepCaptcha;
    try {
      await register(
        { name, password, home, ...(mode === 'invite' ? { inviteCode } : {}) },
        (step) => (busy = step === 'captcha' ? de.register.stepCaptcha : de.register.stepKeys),
      );
      password = '';
      repeat = '';
      navigate('/willkommen', true);
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = null;
    }
  }
</script>

<div class="page">
  <p><Link href="/" class="back">← {de.app.back}</Link></p>
  <h1>{de.register.title}</h1>

  {#if mode === 'closed'}
    <p class="notice" role="status">
      <span aria-hidden="true">🔒</span><span>{de.register.closed}</span>
    </p>
  {:else if mode !== null}
    <form class="card" onsubmit={submit} novalidate>
      {#if mode === 'invite'}
        <p class="notice"><span aria-hidden="true">✉</span><span>{de.register.inviteOnly}</span></p>
        <div class="field">
          <label for="invite">{de.register.inviteCode}</label>
          <input
            id="invite"
            type="text"
            autocomplete="off"
            maxlength="40"
            bind:value={inviteCode}
          />
        </div>
      {/if}
      <div class="field">
        <label for="reg-name">{de.register.userName}</label>
        <input
          id="reg-name"
          type="text"
          autocomplete="username"
          maxlength="100"
          bind:value={name}
          aria-describedby="reg-name-hint"
        />
        <p class="hint" id="reg-name-hint">{de.register.userNameHint}</p>
      </div>
      <PasswordInput
        id="reg-password"
        label={de.register.password}
        autocomplete="new-password"
        hint={de.register.passwordHint}
        bind:value={password}
      />
      <PasswordInput
        id="reg-repeat"
        label={de.register.passwordRepeat}
        autocomplete="new-password"
        bind:value={repeat}
      />

      <fieldset class="field">
        <legend>{de.register.home}</legend>
        <p class="hint">{de.register.homeHint}</p>
        <MapView onpick={(position) => void pick(position)}>
          {#snippet markers(toSvg, scale)}
            {#if home}
              {@const p = toSvg(home.lat, home.lon)}
              <circle class="pin" cx={p.x} cy={p.y} r={14 * scale} stroke-width={5 * scale} />
            {/if}
          {/snippet}
        </MapView>
        {#if home}
          <p class="chosen" role="status">
            {fill(de.register.homeChosen, {
              lat: home.lat.toFixed(2).replace('.', ','),
              lon: home.lon.toFixed(2).replace('.', ','),
            })}
          </p>
        {/if}
        <ErrorText message={homeError} />
      </fieldset>

      <div class="confirm">
        <input id="confirm" type="checkbox" bind:checked={confirmed} />
        <label for="confirm">{de.register.warning}</label>
      </div>

      <ErrorText message={error} />
      <button class="button" type="submit" disabled={busy !== null || !status.online}
        >{de.register.submit}</button
      >
      {#if busy}<p class="notice" role="status">
          <span aria-hidden="true">⏳</span><span>{busy}</span>
        </p>{/if}
    </form>
  {/if}
</div>

<style>
  .page {
    max-width: 48rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  .page :global(.back) {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
  }

  .field {
    margin: 0 0 1rem;
  }

  fieldset {
    border: none;
    padding: 0;
  }

  legend {
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .hint {
    margin: 0.25rem 0 0.5rem;
    color: var(--ink-soft);
    font-size: 0.95rem;
  }

  .chosen {
    font-weight: 700;
  }

  .confirm {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 1rem;
    margin-bottom: 1rem;
    border: 2px solid var(--seal);
    border-radius: 0.5rem;
    background: var(--paper);
  }

  .confirm input {
    width: 1.75rem;
    height: 1.75rem;
    flex: none;
    accent-color: var(--seal);
  }

  .confirm label {
    font-weight: 400;
  }

  :global(.pin) {
    fill: var(--seal);
    stroke: var(--on-wood);
  }
</style>
