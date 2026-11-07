<script lang="ts">
  /** Measures the Argon2id hardening on this device (SPEC 5.3, F-06). Nothing is sent. */
  import { t, fill } from '../lib/i18n.svelte.ts';

  let running = $state(false);
  let result = $state<string | null>(null);

  async function measure(): Promise<void> {
    running = true;
    result = null;
    await new Promise((resolve) => setTimeout(resolve, 30));
    const opaque = await import('@serenity-kit/opaque');
    const client = await import('@posteulen/shared/crypto/opaque-client.ts');
    await client.ready();
    const setup = opaque.server.createSetup();
    const runs = 3;
    let total = 0;
    for (let i = 0; i < runs; i++) {
      const start = client.startRegistration('Messung mit einem langen Passwort');
      const { registrationResponse } = opaque.server.createRegistrationResponse({
        serverSetup: setup,
        userIdentifier: 'messung',
        registrationRequest: start.request,
      });
      const t0 = performance.now();
      client.finishRegistration(
        'Messung mit einem langen Passwort',
        start.state,
        registrationResponse,
      );
      total += performance.now() - t0;
    }
    result = fill(t.measure.result, { ms: Math.round(total / runs), runs });
    running = false;
  }
</script>

<div class="page">
  <h1 class="plate">{t.measure.title}</h1>
  <p>{t.measure.intro}</p>
  <button class="button" type="button" disabled={running} onclick={() => void measure()}
    >{t.measure.start}</button
  >
  {#if running}<p class="notice" role="status">{t.measure.running}</p>{/if}
  {#if result}<p class="notice" role="status" data-testid="measure-result">{result}</p>{/if}
  <p><small>{navigator.userAgent}</small></p>
</div>

<style>
  .page {
    max-width: 44rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }
</style>
