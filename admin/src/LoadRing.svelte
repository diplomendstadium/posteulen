<script lang="ts">
  /**
   * v1.2.1: one ring of the server dashboard (SPEC 13 item 13): the bar runs once around at 100 %,
   * coloured from green (0 %) to red (100 %); in the middle what is measured and the value. The
   * level is set through the CSSOM (no inline style attribute, CSP).
   */
  let {
    id,
    label,
    period,
    value,
    text,
  }: { id: string; label: string; period: string; value: number | null; text: string } = $props();

  let gauge: HTMLDivElement | undefined = $state();
  $effect(() => {
    gauge?.style.setProperty('--value', String(Math.max(0, Math.min(100, value ?? 0))));
  });
  /** The soft hyphen of long labels stays out of what screen readers read. */
  const plainLabel = $derived(label.replaceAll('\u00AD', ''));
</script>

<div
  bind:this={gauge}
  class="gauge"
  class:empty={value === null}
  role="meter"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={value === null ? undefined : Math.round(value)}
  aria-valuetext={text}
  aria-label={`${plainLabel} (${period})`}
  data-testid={`server-${id}`}
>
  <span class="ring" aria-hidden="true"></span>
  <span class="inside" aria-hidden="true">
    <span class="label">{label}</span>
    <span class="value">{value === null ? '–' : text}</span>
    <span class="period">{period}</span>
  </span>
</div>

<style>
  /* The value can glide from 0 to its level when the panel opens. */
  @property --value {
    syntax: '<number>';
    inherits: true;
    initial-value: 0;
  }

  .gauge {
    --size: 10rem;
    --thickness: 1rem;
    position: relative;
    width: var(--size);
    height: var(--size);
  }

  /* The ring: green at 0 % to red at 100 % (once around), the rest of the way an opaque, pale
     track that covers the colours beyond the value. */
  .ring {
    --track: #e9dfcc;
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background:
      conic-gradient(transparent calc(var(--value) * 1%), var(--track) 0),
      conic-gradient(#2f9e44, #94c11f 25%, #f2c230 50%, #f07f1d 75%, #d62828);
    mask: radial-gradient(
      farthest-side,
      transparent calc(100% - var(--thickness) - 1px),
      #000 calc(100% - var(--thickness))
    );
    filter: drop-shadow(0 0.1rem 0.15rem rgb(43 29 14 / 25%));
  }

  .empty .ring {
    background: var(--track);
  }

  @media (prefers-reduced-motion: no-preference) {
    .gauge {
      animation: fill 1.2s ease-out;
    }
  }

  @keyframes fill {
    from {
      --value: 0;
    }
  }

  .inside {
    position: absolute;
    inset: var(--thickness);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    text-align: center;
    line-height: 1.15;
    hyphens: manual;
  }

  .label {
    font-weight: 700;
    font-size: 0.95rem;
  }

  .value {
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 700;
  }

  .period {
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
</style>
