<script lang="ts">
  /**
   * v1.4.3: sign-in of the admin panel and the bots control centre – password, then (if switched
   * on) the code of the second factor (SPEC 5.11).
   */
  import { autofocus } from '@posteulen/shared/autofocus.ts';
  import { t, fill } from './lib/i18n.svelte.ts';
  import { login } from './lib/auth.ts';
  import { message } from './lib/messages.ts';

  let {
    id,
    heading,
    error = $bindable(null),
    ondone,
  }: {
    id: string;
    heading: string;
    error?: string | null;
    ondone: (password: string) => void;
  } = $props();

  let password = $state('');
  let busy = $state(false);
  let codeAsked = $state(false);
  let code = $state('');
  let answerCode: ((code: string | null) => void) | null = null;

  const askCode = (wrong: boolean): Promise<string | null> =>
    new Promise((resolve) => {
      code = '';
      error = wrong ? t.twoFactor.wrong : null;
      busy = false;
      codeAsked = true;
      answerCode = resolve;
    });

  function giveCode(value: string | null): void {
    const resolve = answerCode;
    answerCode = null;
    codeAsked = false;
    resolve?.(value);
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (codeAsked) {
      if (code.trim() === '') return;
      busy = true;
      error = null;
      giveCode(code.trim());
      return;
    }
    if (busy) return;
    busy = true;
    error = null;
    try {
      const outcome = await login(password, askCode);
      if (outcome === 'ok') {
        const used = password;
        password = '';
        ondone(used);
      } else if (outcome === 'wrong') error = t.admin.wrong;
      else if (outcome === 'code') error = t.twoFactor.wrong;
      else if (outcome === 'cancelled') error = null;
      else error = fill(t.start.wait, { seconds: outcome.wait });
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
      codeAsked = false;
    }
  }
</script>

<section class="card" aria-labelledby={`${id}-login`}>
  <h1 id={`${id}-login`}>{heading}</h1>
  <form onsubmit={submit} novalidate>
    <label for={`${id}-password`}>{t.admin.password}</label>
    <input
      id={`${id}-password`}
      type="password"
      autocomplete="current-password"
      bind:value={password}
      use:autofocus
    />
    {#if codeAsked}
      <div data-testid="panel-code">
        <h2>{t.twoFactor.loginHeading}</h2>
        <p>{t.twoFactor.loginIntro}</p>
        <label for={`${id}-code`}>{t.twoFactor.code}</label>
        <input
          id={`${id}-code`}
          type="text"
          class="code"
          autocomplete="one-time-code"
          autocapitalize="characters"
          spellcheck="false"
          maxlength="32"
          bind:value={code}
          use:autofocus
        />
        <p class="hint">{t.twoFactor.codeHint}</p>
      </div>
    {/if}
    {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
    <p class="actions">
      {#if codeAsked}
        <button class="button" type="submit" disabled={code.trim() === ''}
          >{t.twoFactor.loginSubmit}</button
        >
        <button class="button secondary" type="button" onclick={() => giveCode(null)}
          >{t.twoFactor.cancel}</button
        >
      {:else}
        <button class="button" type="submit" disabled={busy}>{t.admin.login}</button>
      {/if}
    </p>
  </form>
</section>

<style>
  .actions {
    margin-top: 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }

  input {
    display: block;
    width: 100%;
    max-width: 30rem;
    min-height: 2.75rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
  }

  .code {
    max-width: 16rem;
    font-family: monospace;
    letter-spacing: 0.1em;
  }

  h2 {
    margin: 1.5rem 0 0.5rem;
    font-size: 1.15rem;
  }

  .hint {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
  }
</style>
