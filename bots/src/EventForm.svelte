<script lang="ts">
  /**
   * v0.8: planning an event (SPEC 10.8): time, move, letter in four versions (first contact and
   * follow-up, German and English) with up to two pictures, gift, context for the AI. Before
   * saving: preview as the players will see it, and a test of the AI personalisation.
   */
  import { CENTRAL_BOTS, LETTER, TIME } from '@posteulen/shared/constants.ts';
  import { SPECIES } from '@posteulen/shared/species.ts';
  import { api, apiRaw } from '../../admin/src/lib/api.ts';
  import { message } from '../../admin/src/lib/messages.ts';
  import { fill, speciesName, t } from '../../admin/src/lib/i18n.svelte.ts';
  import BotMap from './BotMap.svelte';
  import LetterPreview from './LetterPreview.svelte';
  import { deviceTimeZone, fromLocalInput, toLocalInput } from './lib/format.ts';
  import type { BotView, EventLetter, EventView } from './lib/types.ts';

  let {
    bot,
    event = null,
    ondone,
  }: { bot: BotView; event?: EventView | null; ondone: () => void } = $props();

  const species = SPECIES.filter((item) => !item.mythical || item.forBots);

  // The form starts from the event being edited (or empty) and is then edited freely.
  const start = (() => event)();
  let due = $state(toLocalInput(start?.dueAt ?? Date.now() + TIME.DAY));
  let withMove = $state(start?.move !== null && start?.move !== undefined);
  let moveLat = $state<number | null>(start?.move?.lat ?? null);
  let moveLon = $state<number | null>(start?.move?.lon ?? null);
  let withLetter = $state(start ? start.letter !== null : true);
  let letter = $state<EventLetter>(
    structuredClone(
      $state.snapshot(start?.letter) ?? {
        parchment: 'small',
        owlMode: 'default',
        texts: { de: { first: '', follow: '' }, en: { first: '', follow: '' } },
        media: [],
      },
    ) as EventLetter,
  );
  let giftKind = $state<'none' | 'gold' | 'owl'>(
    start?.gift ? ('gold' in start.gift ? 'gold' : 'owl') : 'none',
  );
  let giftGold = $state(start?.gift && 'gold' in start.gift ? start.gift.gold / 10 : 1);
  let giftSpecies = $state(
    start?.gift && 'species' in start.gift ? start.gift.species : 'waldkauz',
  );
  let context = $state(start?.context ?? '');

  let previewLanguage = $state<'de' | 'en'>('de');
  let previewVariant = $state<'first' | 'follow'>('first');
  let showPreview = $state(false);
  let aiLetter = $state('');
  let aiResult = $state<string | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const max = $derived(
    letter.parchment === 'large' ? LETTER.LARGE_MAX_CHARS : LETTER.SMALL_MAX_CHARS,
  );
  const dueMs = $derived(fromLocalInput(due));
  const giftText = $derived(
    giftKind === 'gold'
      ? fill(t.centre.summaryGold, { amount: String(giftGold) })
      : giftKind === 'owl'
        ? fill(t.centre.summaryOwl, { species: speciesName(giftSpecies) })
        : null,
  );

  function body() {
    return {
      dueAt: dueMs,
      move:
        withMove && moveLat !== null && moveLon !== null
          ? { lat: Number(moveLat), lon: Number(moveLon) }
          : null,
      letter: withLetter ? $state.snapshot(letter) : null,
      gift:
        giftKind === 'gold'
          ? { gold: Math.round(Number(giftGold) * 10) }
          : giftKind === 'owl'
            ? { species: giftSpecies }
            : null,
      context,
    };
  }

  async function run(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    try {
      await work();
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }

  const save = (submit: SubmitEvent) => {
    submit.preventDefault();
    return run(async () => {
      if (event) await api('PUT', `/api/bots/${bot.id}/events/${event.id}`, body());
      else await api('POST', `/api/bots/${bot.id}/events`, body());
      ondone();
    });
  };

  const upload = (input: HTMLInputElement) =>
    run(async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      const result = await apiRaw<{ id: string }>(
        `/api/bots/${bot.id}/media`,
        file.type || 'application/octet-stream',
        file,
      );
      if (!letter.media.includes(result.id)) letter.media = [...letter.media, result.id];
    });

  const testAi = () =>
    run(async () => {
      aiResult = null;
      const result = await api<{ text?: string; problem?: string }>(
        'POST',
        `/api/bots/${bot.id}/ai-test`,
        {
          // v0.8.3: a player who writes to the bot knows it – the AI adapts the follow-up letter
          // (in the other language if this one is empty, as when sending).
          language: previewLanguage,
          variant: 'follow',
          planned:
            letter.texts[previewLanguage].follow.trim() !== ''
              ? letter.texts[previewLanguage].follow
              : letter.texts[previewLanguage === 'de' ? 'en' : 'de'].follow,
          context,
          playerLetter: aiLetter,
          ...(Number.isFinite(dueMs) ? { dueAt: dueMs } : {}),
          ...(event ? { eventId: event.id } : {}),
        },
      );
      aiResult =
        result.text ??
        (t.centre as Record<string, string>)[`aiProblem_${result.problem ?? 'error'}`] ??
        t.centre.aiProblem_error;
    });

  const fields = [
    ['de', 'first', 'textFirstDe'],
    ['de', 'follow', 'textFollowDe'],
    ['en', 'first', 'textFirstEn'],
    ['en', 'follow', 'textFollowEn'],
  ] as const;
</script>

<form class="card" onsubmit={(submit) => void save(submit)} data-testid="event-form">
  <h2>{event ? t.centre.eventEdit : t.centre.eventNew}</h2>
  <label for="event-due">{t.centre.dueAt}</label>
  <input id="event-due" type="datetime-local" bind:value={due} required />
  <p class="hint">{fill(t.admin.timeZoneNote, { zone: deviceTimeZone() })}</p>

  <label class="choice"><input type="checkbox" bind:checked={withMove} /> {t.centre.withMove}</label
  >
  {#if withMove}
    <fieldset>
      <legend>{t.centre.moveTo}</legend>
      <div class="coords">
        <label
          >{t.centre.lat}
          <input type="number" min="-90" max="90" step="0.01" bind:value={moveLat} /></label
        >
        <label
          >{t.centre.lon}
          <input type="number" min="-180" max="180" step="0.01" bind:value={moveLon} /></label
        >
      </div>
      <BotMap
        marker={moveLat !== null && moveLon !== null
          ? { lat: Number(moveLat), lon: Number(moveLon) }
          : null}
        onpick={(place) => {
          moveLat = place.lat;
          moveLon = place.lon;
        }}
      />
    </fieldset>
  {/if}

  <label class="choice"
    ><input type="checkbox" bind:checked={withLetter} /> {t.centre.withLetter}</label
  >
  {#if withLetter}
    <fieldset>
      <legend>{t.centre.withLetter}</legend>
      <label for="event-parchment">{t.centre.parchment}</label>
      <select id="event-parchment" bind:value={letter.parchment}>
        <option value="small">{t.centre.parchmentSmall}</option>
        <option value="large">{t.centre.parchmentLarge}</option>
      </select>
      <label for="event-owl">{t.centre.eventOwl}</label>
      <select id="event-owl" bind:value={letter.owlMode}>
        <option value="default">{t.centre.owlDefault}</option>
        <option value="own">{t.centre.owlOwn}</option>
        <option value="loan">{t.centre.owlLoan}</option>
      </select>
      {#each fields as [language, variant, label] (label)}
        <label for={`text-${language}-${variant}`}>{t.centre[label]}</label>
        <textarea
          id={`text-${language}-${variant}`}
          rows="5"
          maxlength={max}
          bind:value={letter.texts[language][variant]}></textarea>
        <p class="hint">{Array.from(letter.texts[language][variant]).length} / {max}</p>
      {/each}
      <p>{t.centre.pictures}</p>
      <ul class="pictures">
        {#each letter.media as id (id)}
          <li>
            <img src={`/api/media/${id}`} alt="" />
            <button
              class="button secondary"
              type="button"
              onclick={() => (letter.media = letter.media.filter((other) => other !== id))}
              >{t.centre.removePicture}</button
            >
          </li>
        {/each}
      </ul>
      {#if letter.media.length < CENTRAL_BOTS.MEDIA_PER_LETTER}
        <label for="event-picture">{t.centre.addPicture}</label>
        <input
          id="event-picture"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onchange={(change) => void upload(change.currentTarget)}
        />
      {/if}
    </fieldset>
  {/if}

  <fieldset>
    <legend>{t.centre.gift}</legend>
    <label class="choice"
      ><input type="radio" value="none" bind:group={giftKind} /> {t.centre.giftNone}</label
    >
    <label class="choice"
      ><input type="radio" value="gold" bind:group={giftKind} /> {t.centre.giftGold}</label
    >
    <label class="choice"
      ><input type="radio" value="owl" bind:group={giftKind} /> {t.centre.giftOwl}</label
    >
    {#if giftKind === 'gold'}
      <label for="gift-gold">{t.centre.giftAmount}</label>
      <input id="gift-gold" type="number" min="0.1" max="100" step="0.1" bind:value={giftGold} />
    {:else if giftKind === 'owl'}
      <label for="gift-species">{t.centre.giftSpecies}</label>
      <select id="gift-species" bind:value={giftSpecies}>
        {#each species as item (item.id)}<option value={item.id}>{speciesName(item.id)}</option
          >{/each}
      </select>
    {/if}
  </fieldset>

  <label for="event-context">{t.centre.context}</label>
  <textarea
    id="event-context"
    rows="3"
    maxlength={CENTRAL_BOTS.CONTEXT_MAX_CHARS}
    bind:value={context}></textarea>

  {#if withLetter}
    <fieldset>
      <legend>{t.centre.preview}</legend>
      <div class="coords">
        <label
          >{t.centre.previewLanguage}
          <select bind:value={previewLanguage}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select></label
        >
        <label
          >{t.centre.previewVariant}
          <select bind:value={previewVariant}>
            <option value="first">{t.centre.variantFirst}</option>
            <option value="follow">{t.centre.variantFollow}</option>
          </select></label
        >
      </div>
      <button class="button secondary" type="button" onclick={() => (showPreview = !showPreview)}
        >{t.centre.preview}</button
      >
      {#if showPreview}
        <LetterPreview
          name={bot.name}
          text={letter.texts[previewLanguage][previewVariant]}
          parchment={letter.parchment}
          media={letter.media}
          gift={giftText}
          language={previewLanguage}
        />
      {/if}
      <h3>{t.centre.aiTest}</h3>
      <p class="hint">{t.centre.aiTestIntro}</p>
      <label for="ai-letter">{t.centre.aiLetter}</label>
      <textarea id="ai-letter" rows="3" bind:value={aiLetter}></textarea>
      <button
        class="button secondary"
        type="button"
        disabled={busy || aiLetter.trim() === ''}
        onclick={() => void testAi()}>{t.centre.aiRun}</button
      >
      {#if aiResult !== null}
        <p><strong>{t.centre.aiResult}</strong></p>
        <p class="ai" data-testid="ai-result">{aiResult}</p>
      {/if}
    </fieldset>
  {/if}

  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  <p class="actions">
    <button class="button" type="submit" disabled={busy}>{t.centre.saveEvent}</button>
    <button class="button secondary" type="button" onclick={ondone}>{t.centre.cancel}</button>
  </p>
</form>

<style>
  input:not([type='radio'], [type='checkbox'], [type='file']),
  select,
  textarea {
    display: block;
    width: 100%;
    max-width: 40rem;
    min-height: 2.75rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
  }

  fieldset {
    border: 1px solid var(--wood-dark);
    border-radius: 0.5rem;
    margin: 1rem 0;
    padding: 0.75rem;
  }

  .coords,
  .actions {
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

  .pictures {
    list-style: none;
    padding: 0;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .pictures img {
    display: block;
    max-width: 12rem;
    max-height: 8rem;
    margin-bottom: 0.25rem;
  }

  .ai {
    white-space: pre-wrap;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }
</style>
