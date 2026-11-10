<script lang="ts">
  /**
   * v0.8.3: when the first and the last player get the owl of an event (SPEC 10.12) – real times
   * of owls on their way or arrived, "ca." for estimates.
   */
  import { fill, t } from '../../admin/src/lib/i18n.svelte.ts';
  import { dateTime } from './lib/format.ts';
  import type { EventView } from './lib/types.ts';

  let { reach }: { reach: EventView['reach'] } = $props();

  const shown = (time: { at: number; estimated: boolean }): string =>
    time.estimated ? fill(t.centre.reachAbout, { time: dateTime(time.at) }) : dateTime(time.at);
</script>

{#if reach}
  <div class="reach" data-testid="event-reach">
    <p>{fill(t.centre.reachFirst, { time: shown(reach.first) })}</p>
    <p>{fill(t.centre.reachLast, { time: shown(reach.last) })}</p>
    {#if reach.first.estimated || reach.last.estimated}<p class="hint">{t.centre.reachHint}</p>{/if}
  </div>
{/if}

<style>
  .reach p {
    margin: 0.15rem 0;
  }

  .hint {
    font-size: 0.9rem;
    opacity: 0.85;
  }
</style>
