<script lang="ts">
  /** v0.8: settings of a bot – character for the AI, home, owls (SPEC 10.6). */
  import { CENTRAL_BOTS } from '@posteulen/shared/constants.ts';
  import { SPECIES } from '@posteulen/shared/species.ts';
  import { api } from '../../admin/src/lib/api.ts';
  import { message } from '../../admin/src/lib/messages.ts';
  import { fill, speciesName, t } from '../../admin/src/lib/i18n.svelte.ts';
  import BotMap from './BotMap.svelte';
  import type { BotView } from './lib/types.ts';

  let { bot, onsaved }: { bot: BotView; onsaved: (bot: BotView) => void } = $props();

  // Every species of the game except the phoenix (SPEC 10.6).
  const species = SPECIES.filter((item) => !item.mythical);

  let name = $state('');
  let character = $state('');
  let lat = $state<number | null>(null);
  let lon = $state<number | null>(null);
  let owlMode = $state<'own' | 'loan'>('own');
  let owlSpecies = $state('');
  let owlName = $state('');
  let motivation = $state(1);
  let restHours = $state(24);
  let playerOwls = $state(false);
  $effect.pre(() => {
    name = bot.name;
    character = bot.character;
    lat = bot.home?.lat ?? null;
    lon = bot.home?.lon ?? null;
    owlMode = bot.owlMode;
    owlSpecies = bot.owlSpecies ?? '';
    owlName = bot.owlName ?? '';
    motivation = bot.motivation / 10;
    restHours = bot.restHours;
    playerOwls = bot.playerOwls;
  });

  let busy = $state(false);
  let error = $state<string | null>(null);
  let saved = $state(false);

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    busy = true;
    error = null;
    saved = false;
    try {
      const fresh = await api<BotView>('PUT', `/api/bots/${bot.id}/settings`, {
        name: name.trim(),
        character,
        home: lat !== null && lon !== null ? { lat: Number(lat), lon: Number(lon) } : null,
        owlMode,
        owlSpecies: owlSpecies === '' ? null : owlSpecies,
        owlName: owlName.trim() === '' ? null : owlName.trim(),
        motivation: Math.round(Number(motivation) * 10),
        restHours: Math.round(Number(restHours)),
        playerOwls,
      });
      saved = true;
      onsaved(fresh);
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }
</script>

<form class="card" onsubmit={(event) => void save(event)}>
  <label for="bot-name">{t.centre.name}</label>
  <input id="bot-name" type="text" maxlength={CENTRAL_BOTS.NAME_MAX_CHARS} bind:value={name} />

  <label for="bot-character">{t.centre.character}</label>
  <p class="hint">{t.centre.characterHint}</p>
  <textarea
    id="bot-character"
    rows="6"
    maxlength={CENTRAL_BOTS.CHARACTER_MAX_CHARS}
    bind:value={character}></textarea>

  <fieldset>
    <legend>{t.centre.home}</legend>
    <p class="hint">{t.centre.homeHint}</p>
    <div class="coords">
      <label
        >{t.centre.lat}
        <input type="number" min="-90" max="90" step="0.01" bind:value={lat} /></label
      >
      <label
        >{t.centre.lon}
        <input type="number" min="-180" max="180" step="0.01" bind:value={lon} /></label
      >
    </div>
    {#if lat !== null && lon !== null}
      <p>{fill(t.centre.pickedPlace, { lat: String(lat), lon: String(lon) })}</p>
    {:else}<p>{t.centre.noHome}</p>{/if}
    <BotMap
      marker={lat !== null && lon !== null ? { lat: Number(lat), lon: Number(lon) } : null}
      onpick={(place) => {
        lat = place.lat;
        lon = place.lon;
      }}
    />
  </fieldset>

  <fieldset>
    <legend>{t.centre.owlMode}</legend>
    <label class="choice"
      ><input type="radio" name="owl-mode" value="own" bind:group={owlMode} />
      {t.centre.owlOwn}</label
    >
    <label class="choice"
      ><input type="radio" name="owl-mode" value="loan" bind:group={owlMode} />
      {t.centre.owlLoan}</label
    >
    {#if owlMode === 'own'}
      <label for="owl-species">{t.centre.owlSpecies}</label>
      <select id="owl-species" bind:value={owlSpecies}>
        <option value=""></option>
        {#each species as item (item.id)}<option value={item.id}>{speciesName(item.id)}</option
          >{/each}
      </select>
      <label for="owl-name">{t.centre.owlName}</label>
      <input id="owl-name" type="text" maxlength="20" bind:value={owlName} />
      <p class="hint">{bot.owlSex === 'f' ? t.centre.owlSexF : t.centre.owlSexM}</p>
    {/if}
    <label for="motivation">{t.centre.motivation}</label>
    <input
      id="motivation"
      type="number"
      min={CENTRAL_BOTS.MOTIVATION_MIN / 10}
      max={CENTRAL_BOTS.MOTIVATION_MAX / 10}
      step="0.1"
      bind:value={motivation}
    />
    <p class="hint">{t.centre.motivationHint}</p>
    <label for="rest">{t.centre.restHours}</label>
    <input
      id="rest"
      type="number"
      min="0"
      max={CENTRAL_BOTS.REST_HOURS_MAX}
      step="1"
      bind:value={restHours}
    />
    <p class="hint">{t.centre.restHint}</p>
    <label class="choice"
      ><input type="checkbox" bind:checked={playerOwls} /> {t.centre.playerOwls}</label
    >
  </fieldset>

  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  {#if saved}<p role="status">{t.centre.saved}</p>{/if}
  <button class="button" type="submit" disabled={busy}>{t.centre.save}</button>
</form>

<style>
  input:not([type='radio'], [type='checkbox']),
  select,
  textarea {
    display: block;
    width: 100%;
    max-width: 40rem;
    min-height: 2.75rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.75rem;
  }

  fieldset {
    border: 1px solid var(--wood-dark);
    border-radius: 0.5rem;
    margin: 1rem 0;
    padding: 0.75rem;
  }

  .coords {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .choice {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    min-height: 2.75rem;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }
</style>
