<script lang="ts">
  /**
   * Writing a letter (SPEC 8.4): parchment, text with counter, recipients, owl, rest, send.
   * v0.8.5: the owl choice loads by itself and stays while typing (also with an empty letter);
   * it only reloads when recipients or the rest change. The rest is preselected by the kind of
   * owl (own 2 hours, loan 24 hours) until the writer picks one by hand.
   */
  import { onMount, tick } from 'svelte';
  import { t, fill, locale } from '../lib/i18n.svelte.ts';
  import { countCodePoints } from '@posteulen/shared/names.ts';
  import { LETTER } from '@posteulen/shared/constants.ts';
  import { maxChars, sanitizeLetterText, type Parchment } from '@posteulen/shared/text-rules.ts';
  import ErrorText from './ErrorText.svelte';
  import OwlChoice from './OwlChoice.svelte';
  import { cargoCovers } from '@posteulen/shared/game/owls.ts';
  import type { Cargo } from '@posteulen/shared/species.ts';
  import { KeyMismatchError, prepare, sendPrepared, sendToBot } from '../lib/letters.ts';
  import { shortestOrder } from '@posteulen/shared/game/route.ts';
  import { mapInfo, previewFlights, type MapInfo, type OwlChoice as Choice } from '../lib/owls.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { showOwlImage } from '../lib/overlay.svelte.ts';
  import { status } from '../lib/status.svelte.ts';
  import { account } from '../lib/auth.svelte.ts';
  import { isChristmas } from '@posteulen/shared/game/season.ts';

  let {
    peerId,
    onsent,
    bot = false,
    guestOwl = null,
    guestOnly = false,
    presetOwl = null,
    presetRecipients = null,
    christmasPaper = 1,
  }: {
    peerId: string;
    /** v1.1: the Christmas parchment pair of the chat (the field looks like the sent letter). */
    christmasPaper?: number;
    onsent: () => void;
    bot?: boolean;
    /** v0.8: a bot that only takes replies with its own owl resting here. */
    guestOnly?: boolean;
    /** v0.7.1: reply with exactly this visiting owl (no other owls, no rest option). */
    guestOwl?: string | null;
    /** v0.8.5: "Brief schreiben" on an owl card – this owl is chosen in the editor. */
    presetOwl?: string | null;
    /** v0.8.5: the recipients picked there (the chat's peer among them). */
    presetRecipients?: readonly string[] | null;
  } = $props();
  /** The visiting owl is gone (flew on meanwhile): then the normal choice. */
  let guestGone = $state(false);
  const replying = $derived(guestOwl !== null && !guestGone);

  /** Refresh of the shown times while the editor stays open (they are estimates anyway). */
  const REFRESH_MS = 5 * 60_000;

  let parchment = $state<Parchment>('small');
  /**
   * v1.1: the writing field looks like the letter will look to its writer – font and parchment,
   * Christmas parchment while it is the Christmas season at the writer's home (decided anew when
   * sending, by the server).
   */
  const home = account.profile?.home;
  const christmasNow = home ? isChristmas(Date.now(), home.lat, home.lon) : false;
  const paper = $derived(christmasNow ? `christmas-${christmasPaper}A` : 'parchment-own');
  const printed = $derived(account.profile?.lettersPrint ?? false);
  /**
   * v1.3: ASCII mode (settings) – this one letter in a plain monospaced font for both sides.
   * Chosen anew for every letter; handwriting stays the default. Letters to people only.
   */
  const asciiMode = $derived(account.profile?.asciiMode ?? false);
  let mono = $state(false);
  /** v0.8.5: a rest picked by hand (hours); null = the preselection of the chosen owl's kind. */
  let restManual = $state<number | null>(null);
  let text = $state('');
  let smileyHint = $state(false);
  // svelte-ignore state_referenced_locally
  let recipients = $state<string[]>(
    presetRecipients && presetRecipients.length > 0 ? [...presetRecipients] : [peerId],
  );
  let extra = $state('');
  /** Owls ready for this letter with the server's preview (SPEC 8.4 step 5). */
  let prepared = $state<Choice[] | null>(null);
  let preparedAt = 0;
  // svelte-ignore state_referenced_locally
  let owlId = $state<string | null>(presetOwl);
  let busy = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let sentNotice = $state(false);

  const chosen = $derived(prepared?.find((choice) => choice.id === owlId) ?? null);
  const guestChosen = $derived(chosen?.guest === true);
  /** A rest only for letters to people (not bots, not with a visiting owl). */
  const restShown = $derived(!bot && !replying && !guestChosen);
  /** The rest that counts for an owl – the preview and the sending use the same (8.4). */
  function restFor(choice: Choice | null): number {
    if (bot || replying || choice?.guest) return 0;
    if (restManual !== null) return restManual;
    return choice?.kind === 'loan' ? LETTER.REST_HOURS_DEFAULT_LOAN : LETTER.REST_HOURS_DEFAULT_OWN;
  }
  const rest = $derived(restFor(chosen));
  const count = $derived(countCodePoints(text));
  const max = $derived(maxChars(parchment));
  /** v0.10: what the chosen parchment needs from the owl (SPEC 9.2.1). */
  const need = $derived<Cargo>(parchment === 'large' ? 'long' : 'short');
  const carries = (choice: Choice): boolean => cargoCovers(choice.cargo, need);
  /**
   * v0.10.1: loan owls of the day that are not borrowed yet only when no other owl (own, already
   * borrowed or visiting) can carry this letter – otherwise they would only crowd the choice.
   */
  const shown = $derived.by((): Choice[] | null => {
    if (!prepared) return null;
    const others = prepared.filter((choice) => !choice.offer);
    return others.some(carries) ? others : prepared;
  });
  // v0.10: switching to the long parchment lets go of an owl that cannot carry it;
  // v0.10.1 also of a loan offer that is no longer shown.
  $effect(() => {
    const current = prepared?.find((choice) => choice.id === owlId);
    if (current && (!cargoCovers(current.cargo, need) || !shown?.includes(current))) {
      owlId = shown?.find((choice) => !choice.offer && carries(choice))?.id ?? null;
    }
  });
  const nameOf = (id: string): string =>
    live.contacts.find((c) => c.userId === id)?.name ??
    live.bots.find((b) => b.userId === id)?.name ??
    t.letters.unknown;
  const candidates = $derived(
    live.contacts.filter((c) => c.active && !c.keyWarning && !recipients.includes(c.userId)),
  );

  function input(event: Event): void {
    const target = event.currentTarget as HTMLTextAreaElement;
    const clean = sanitizeLetterText(target.value);
    if (clean.removedEmoji) smileyHint = true;
    if (clean.text !== target.value) target.value = clean.text;
    text = clean.text;
  }

  /** Homes of the user and the contacts, loaded once for the route suggestion. */
  let places: MapInfo | null = null;

  /**
   * v0.3.2: several recipients are put in the order of the shortest round trip from home
   * (a suggestion – the arrows still change it). Without the homes the order stays as it is.
   */
  async function shortestRoute(list: string[]): Promise<string[]> {
    if (list.length < 2) return list;
    try {
      places ??= await mapInfo();
    } catch {
      return list;
    }
    const homes = list.map((id) => places?.contacts.find((contact) => contact.id === id));
    if (!places || homes.some((home) => home === undefined)) return list;
    const order = shortestOrder(
      places.home,
      homes.map((home) => ({ lat: home?.lat ?? 0, lon: home?.lon ?? 0 })),
    );
    return order.map((index) => list[index] ?? '');
  }

  let routeRequest = 0;

  async function setRecipients(list: string[]): Promise<void> {
    recipients = list;
    const request = ++routeRequest;
    const sorted = await shortestRoute(list);
    // Only if the recipients did not change meanwhile (arrows, another addition).
    if (request === routeRequest) recipients = sorted;
    void loadChoices();
  }

  function move(index: number, delta: number): void {
    routeRequest++;
    const next = [...recipients];
    const [item] = next.splice(index, 1);
    if (item === undefined) return;
    next.splice(index + delta, 0, item);
    recipients = next;
    void loadChoices();
  }

  let choiceRequest = 0;

  /**
   * The owl choice with the server's preview. Kept while typing; reloaded for other recipients
   * or another rest, and after five minutes (shown times are estimates).
   */
  async function loadChoices(): Promise<void> {
    const request = ++choiceRequest;
    loading = true;
    error = null;
    try {
      const manual = restManual;
      const own = bot || replying ? 0 : (manual ?? LETTER.REST_HOURS_DEFAULT_OWN);
      const loan = bot || replying ? 0 : (manual ?? LETTER.REST_HOURS_DEFAULT_LOAN);
      const choices = await previewFlights(recipients, {
        rest: own,
        restLoan: loan,
        // v0.8: also the resting owl of a control-centre bot.
        guests: true,
      });
      if (request !== choiceRequest) return;
      let list: Choice[];
      if (replying) {
        // v0.7.1: only the visiting owl the reply was started with.
        const guest = choices.filter((choice) => choice.id === `guest:${guestOwl}`);
        if (guest.length === 0) {
          // Flown on meanwhile: the normal choice, with rest and recipients (preview anew).
          guestGone = true;
          void loadChoices();
          return;
        }
        list = guest;
      } else if (guestOnly) {
        list = choices.filter((choice) => choice.id.startsWith('guest:'));
        if (list.length === 0) error = t.bots.botOwlOnly;
      } else {
        list = choices;
      }
      prepared = list;
      preparedAt = Date.now();
      // Keep the chosen owl if it can still fly; otherwise a visiting owl of the recipient
      // first (v0.7), then the first ready owl – never a loan offer (it costs gold).
      if (!list.some((choice) => choice.id === owlId && carries(choice))) {
        owlId = list.find((choice) => !choice.offer && carries(choice))?.id ?? null;
      }
    } catch (caught) {
      if (request === choiceRequest) error = errorMessage(caught);
    } finally {
      if (request === choiceRequest) loading = false;
    }
  }

  function chooseRest(event: Event): void {
    restManual = Number((event.currentTarget as HTMLSelectElement).value);
    void loadChoices();
  }

  onMount(() => {
    // v0.8.5: several recipients from an owl card are sorted like added ones.
    if (recipients.length > 1) void setRecipients(recipients);
    else void loadChoices();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !busy && Date.now() - preparedAt >= REFRESH_MS)
        void loadChoices();
    }, 60_000);
    return () => clearInterval(timer);
  });

  let errorBox = $state<HTMLElement | null>(null);

  /**
   * v1.4.3: a letter that cannot be sent shows why, and the page jumps to the message (the send
   * button is far below it, often outside the screen).
   */
  async function sendFailed(message: string): Promise<void> {
    error = message;
    await tick();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    errorBox?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }

  async function send(): Promise<void> {
    if (!prepared || !owlId || busy || !status.online) return;
    error = null;
    if (text.trim() === '') return void sendFailed(t.letters.empty);
    if (count > max) return void sendFailed(t.letters.tooLong);
    busy = true;
    try {
      // Bots: plain text, one recipient (SPEC 10.1); people: end-to-end encrypted (5.8).
      const result = bot
        ? await sendToBot(peerId, owlId, parchment, text)
        : await sendPrepared(
            await prepare(recipients, parchment, owlId, rest),
            parchment,
            text,
            asciiMode && mono ? 'mono' : 'hand',
          );
      showOwlImage(
        result.owl.species,
        'departure',
        fill(t.owls.departs, { name: result.owl.name }),
      );
      void refreshTopics('profile');
      text = '';
      mono = false;
      recipients = [peerId];
      sentNotice = true;
      onsent();
      // The owl has flown: a fresh choice for the next letter (a bot takes one letter a day,
      // so its editor closes anyway).
      if (!bot) void loadChoices();
    } catch (caught) {
      void sendFailed(
        caught instanceof KeyMismatchError
          ? fill(t.contacts.keyWarningLong, { name: nameOf(caught.message) })
          : errorMessage(caught),
      );
      // Something changed (keys, owl, gold): the choice is loaded again on request.
      prepared = null;
    } finally {
      busy = false;
    }
  }
</script>

<section class="card compose" aria-labelledby="compose-title">
  <h2 id="compose-title">{t.letters.compose}</h2>
  <fieldset>
    <legend>{t.letters.parchment}</legend>
    <label class="option"
      ><input type="radio" name="parchment" value="small" bind:group={parchment} />
      {t.letters.smallOption}</label
    >
    <label class="option"
      ><input type="radio" name="parchment" value="large" bind:group={parchment} />
      {t.letters.largeOption}</label
    >
  </fieldset>

  <label for="letter-text">{t.letters.text}</label>
  <div class="field">
    <textarea
      id="letter-text"
      rows="6"
      class={paper}
      class:printed
      class:mono={asciiMode && mono && !bot}
      data-christmas={christmasNow ? christmasPaper : undefined}
      value={text}
      oninput={input}
      aria-describedby="letter-count"></textarea>
  </div>
  {#if asciiMode && !bot}
    <label class="option mono-option"
      ><input type="checkbox" bind:checked={mono} data-testid="letter-mono" />
      {t.letters.monoOption}</label
    >
  {/if}
  <p id="letter-count" class:over={count > max} class="counter">
    {fill(t.letters.counter, { count, max: max.toLocaleString(locale()) })}
  </p>
  {#if smileyHint}<p class="notice" role="status">
      <span aria-hidden="true">✒</span><span>{t.letters.noSmileys}</span>
    </p>{/if}

  {#if !bot && !replying}
    <fieldset>
      <legend>{t.letters.recipients}</legend>
      <ol class="recipients">
        {#each recipients as id, index (id)}
          <li>
            <span class="name">{nameOf(id)}</span>
            {#if recipients.length > 1}
              <button
                type="button"
                class="button secondary small"
                aria-label={t.letters.up}
                disabled={index === 0}
                onclick={() => move(index, -1)}>↑</button
              >
              <button
                type="button"
                class="button secondary small"
                aria-label={t.letters.down}
                disabled={index === recipients.length - 1}
                onclick={() => move(index, 1)}>↓</button
              >
              <button
                type="button"
                class="button secondary small"
                aria-label={t.letters.removeRecipient}
                onclick={() => void setRecipients(recipients.filter((r) => r !== id))}>✕</button
              >
            {/if}
          </li>
        {/each}
      </ol>
      {#if recipients.length > 1}<p class="hint">{t.letters.routeHint}</p>{/if}
      {#if recipients.length < LETTER.MAX_RECIPIENTS && candidates.length > 0}
        <label for="extra">{t.letters.addRecipient}</label>
        <select
          id="extra"
          bind:value={extra}
          onchange={() => {
            if (extra) {
              void setRecipients([...recipients, extra]);
              extra = '';
            }
          }}
        >
          <option value="">{t.letters.choose}</option>
          {#each candidates as contact (contact.userId)}<option value={contact.userId}
              >{contact.name}</option
            >{/each}
        </select>
      {/if}
    </fieldset>
  {/if}

  {#if guestGone}<p class="notice" role="status">
      <span aria-hidden="true">🦉</span><span>{t.letters.guestGone}</span>
    </p>{/if}
  <div bind:this={errorBox}><ErrorText message={error} /></div>
  {#if prepared}
    <OwlChoice choices={shown ?? []} bind:selected={owlId} name="letter-owl" {need} />
  {:else if loading}
    <p class="hint" role="status">{t.letters.choicesLoading}</p>
  {:else}
    <button
      class="button secondary"
      type="button"
      disabled={!status.online}
      onclick={() => void loadChoices()}>{t.letters.preview}</button
    >
  {/if}
  {#if restShown}
    <!-- v0.7: the owl may rest at each recipient and take a reply back; v0.8.5 preselected by
         the kind of the chosen owl, hidden for a visiting owl. -->
    <label for="rest">{t.letters.restLabel}</label>
    <select id="rest" value={rest} onchange={chooseRest} aria-describedby="rest-hint">
      {#each LETTER.REST_HOURS_CHOICES as hours (hours)}
        <option value={hours}
          >{hours === 0 ? t.letters.restNone : fill(t.letters.restHours, { hours })}</option
        >
      {/each}
    </select>
    <p id="rest-hint" class="hint">
      {restManual === null
        ? chosen?.kind === 'loan'
          ? t.letters.restDefaultLoan
          : t.letters.restDefaultOwn
        : ''}
      {t.letters.restHint}
    </p>
  {/if}
  {#if live.storageFull}<p class="notice" role="status" data-testid="storage-notice">
      <span aria-hidden="true">🏰</span><span>{t.banner.storageFull}</span>
    </p>{/if}
  <button
    class="button"
    type="button"
    disabled={busy || !status.online || !owlId || !prepared || live.storageFull}
    onclick={() => void send()}>{t.letters.send}</button
  >
  {#if sentNotice}<p class="notice" role="status">
      <span aria-hidden="true">🦉</span><span>{t.letters.sent}</span>
    </p>{/if}
</section>

<style>
  .compose {
    margin-top: 1.5rem;
  }

  fieldset {
    border: none;
    padding: 0;
    margin: 0 0 1rem;
  }

  legend {
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 400;
    min-height: 2.75rem;
  }

  .option input {
    width: 1.5rem;
    height: 1.5rem;
    accent-color: var(--wood);
  }

  /* v1.1: the Christmas parchment places its continuation by the field width (cqw). */
  .field {
    container-type: inline-size;
  }

  /* v1.1: like the own letter in the chat – handwriting and parchment (classes in base.css). */
  textarea {
    display: block;
    width: 100%;
    min-height: 10rem;
    padding: 0.75rem clamp(0.75rem, 3vw, 1.25rem);
    border: 2px solid var(--line);
    border-radius: 0.5rem;
    font-family: var(--font-hand-own);
    font-size: 1.5rem;
    line-height: 1.4;
  }

  /* "Briefe in Druckschrift anzeigen" (8.10): the field follows it, as the letters do. */
  textarea.printed {
    font-family: var(--font-body);
    font-size: 1rem;
    line-height: 1.5;
  }

  /* v1.3: ASCII mode – a plain monospaced font, no line breaks of its own (SPEC 8.4). */
  textarea.mono {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    line-height: 1.3;
    white-space: pre;
    overflow-x: auto;
  }

  .mono-option {
    display: block;
    margin-top: 0.5rem;
  }

  .counter {
    margin: 0.25rem 0 1rem;
    color: var(--ink-soft);
  }

  .counter.over {
    color: var(--seal);
    font-weight: 700;
  }

  .recipients {
    padding-left: 1.5rem;
  }

  .recipients li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .recipients .name {
    flex: 1;
  }

  .small {
    padding: 0;
    width: 2.75rem;
  }

  select {
    min-height: 2.75rem;
    font: inherit;
    width: 100%;
  }

  .hint {
    color: var(--ink-soft);
    font-size: 0.9rem;
  }
</style>
