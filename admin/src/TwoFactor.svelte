<script lang="ts">
  /**
   * v1.4.3: two-factor sign-in of the admin panel or the bots control centre (SPEC 5.11). Without
   * app and backup code, `posteulen-cli admin-reset` / `bots-reset` on the server resets it.
   */
  import { onMount } from 'svelte';
  import { t, fill } from './lib/i18n.svelte.ts';
  import {
    disableTwoFactor,
    enableTwoFactor,
    startTwoFactor,
    twoFactorState,
    type TwoFactorState,
  } from './lib/auth.ts';
  import { message } from './lib/messages.ts';
  import QrCode from './QrCode.svelte';

  let { command }: { command: 'admin-reset' | 'bots-reset' } = $props();

  let tf = $state<TwoFactorState | null>(null);
  let password = $state('');
  let code = $state('');
  let setup = $state<{ secret: string; uri: string } | null>(null);
  let backupCodes = $state<string[] | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let done = $state<string | null>(null);

  const refresh = async (): Promise<void> => {
    tf = await twoFactorState();
  };

  onMount(() => {
    refresh().catch((caught: unknown) => (error = message(caught)));
  });

  const statusText = $derived(
    !tf || !tf.active
      ? t.twoFactor.off
      : tf.backupLeft === 0
        ? t.twoFactor.onNone
        : tf.backupLeft === 1
          ? t.twoFactor.onOne
          : fill(t.twoFactor.on, { count: tf.backupLeft }),
  );

  const outcomeError = (outcome: 'wrong' | 'code' | { wait: number }): string =>
    outcome === 'wrong'
      ? t.admin.wrong
      : outcome === 'code'
        ? t.twoFactor.wrong
        : fill(t.start.wait, { seconds: outcome.wait });

  async function run(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    done = null;
    try {
      await work();
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }

  const start = () =>
    run(async () => {
      const result = await startTwoFactor(password);
      if (typeof result === 'string' || 'wait' in result) {
        error = outcomeError(result);
        return;
      }
      password = '';
      code = '';
      setup = result;
    });

  const confirm = () =>
    run(async () => {
      backupCodes = await enableTwoFactor(code);
      setup = null;
      code = '';
      done = t.twoFactor.enabled;
      await refresh();
    });

  const disable = () =>
    run(async () => {
      const outcome = await disableTwoFactor(password, code);
      if (outcome !== 'ok') {
        error = outcomeError(outcome);
        return;
      }
      password = '';
      code = '';
      done = t.twoFactor.disabled;
      await refresh();
    });
</script>

<section class="card" aria-labelledby="tf-title" data-testid="two-factor">
  <h2 id="tf-title">{t.twoFactor.title}</h2>
  <p>{t.twoFactor.intro}</p>
  <p>⚠ {fill(t.twoFactor.warningPanel, { command })}</p>
  <p data-testid="two-factor-state"><strong>{statusText}</strong></p>

  {#if backupCodes}
    <div data-testid="backup-codes">
      <h3>{t.twoFactor.codesTitle}</h3>
      <p>{t.twoFactor.codes}</p>
      <ol class="codes">
        {#each backupCodes as item (item)}<li><code>{item}</code></li>{/each}
      </ol>
      <p>
        <button class="button" type="button" onclick={() => (backupCodes = null)}
          >{t.twoFactor.codesDone}</button
        >
      </p>
    </div>
  {:else if setup}
    <p>{t.twoFactor.scan}</p>
    <QrCode text={setup.uri} label={t.twoFactor.qrAlt} />
    <p>
      {t.twoFactor.secret}:
      <code class="secret" data-testid="two-factor-secret">{setup.secret}</code>
    </p>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
      novalidate
    >
      <label for="tf-confirm">{t.twoFactor.code}</label>
      <input
        id="tf-confirm"
        type="text"
        class="code"
        autocomplete="one-time-code"
        maxlength="32"
        bind:value={code}
      />
      {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
      <p class="actions">
        <button class="button" type="submit" disabled={busy || code.trim() === ''}
          >{t.twoFactor.confirm}</button
        >
        <button
          class="button secondary"
          type="button"
          onclick={() => {
            setup = null;
            code = '';
            error = null;
          }}>{t.twoFactor.cancel}</button
        >
      </p>
    </form>
  {:else if tf?.active}
    <p>{t.twoFactor.disableIntro}</p>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void disable();
      }}
      novalidate
    >
      <label for="tf-off-password">{t.admin.password}</label>
      <input
        id="tf-off-password"
        type="password"
        autocomplete="current-password"
        bind:value={password}
      />
      <label for="tf-off-code">{t.twoFactor.code}</label>
      <input
        id="tf-off-code"
        type="text"
        class="code"
        autocomplete="one-time-code"
        maxlength="32"
        bind:value={code}
      />
      <p class="hint">{t.twoFactor.codeHint}</p>
      {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
      <p class="actions">
        <button
          class="button secondary"
          type="submit"
          disabled={busy || !password || code.trim() === ''}>{t.twoFactor.disable}</button
        >
      </p>
    </form>
  {:else if tf}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void start();
      }}
      novalidate
    >
      <label for="tf-password">{t.admin.password}</label>
      <input
        id="tf-password"
        type="password"
        autocomplete="current-password"
        bind:value={password}
      />
      {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
      <p class="actions">
        <button class="button" type="submit" disabled={busy || !password}
          >{t.twoFactor.start}</button
        >
      </p>
    </form>
  {:else if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  {#if done}<p role="status">✔ {done}</p>{/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }

  input {
    display: block;
    width: 100%;
    max-width: 30rem;
    min-height: 2.75rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
  }

  .code {
    max-width: 16rem;
    font-family: monospace;
    letter-spacing: 0.1em;
  }

  .codes {
    columns: 2;
    column-gap: 2rem;
    max-width: 24rem;
  }

  .codes code,
  .secret {
    font-family: monospace;
    font-size: 1.05rem;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .hint {
    font-size: 0.9rem;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }

  @media (max-width: 22rem) {
    .codes {
      columns: 1;
    }
  }
</style>
