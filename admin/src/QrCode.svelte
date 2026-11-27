<script lang="ts">
  /** v1.4.3: QR code for an authenticator app, as one SVG path (SPEC 5.11). */
  import { qrPath } from '@posteulen/shared/qr.ts';

  let { text, label }: { text: string; label: string } = $props();
  const qr = $derived(qrPath(text));
</script>

<svg
  class="qr"
  viewBox={`0 0 ${qr.size} ${qr.size}`}
  role="img"
  aria-label={label}
  shape-rendering="crispEdges"
>
  <rect width={qr.size} height={qr.size} fill="#fff" />
  <path d={qr.path} fill="#000" />
</svg>

<style>
  .qr {
    display: block;
    width: min(16rem, 100%);
    height: auto;
    margin: 0.5rem 0 1rem;
  }
</style>
