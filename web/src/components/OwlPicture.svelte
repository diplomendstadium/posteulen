<script lang="ts">
  import type { OwlImageKind } from '@posteulen/shared/species.ts';
  import { de } from '@posteulen/shared/texts/de.ts';
  import { owlImage } from '../lib/owl-image.ts';

  let {
    speciesId,
    kind = 'normal',
    alt,
    size = 160,
  }: { speciesId: string; kind?: OwlImageKind; alt: string; size?: 160 | 480 } = $props();

  const image = $derived(owlImage(speciesId, kind));
</script>

<img
  src={size === 160 ? image.files.s160 : image.files.s480}
  srcset={`${image.files.s160} 160w, ${image.files.s480} 480w`}
  sizes={`${size}px`}
  width={size}
  height={size}
  alt={image.placeholder ? `${alt} (${de.images.placeholderAlt})` : alt}
  loading="lazy"
  decoding="async"
/>

<style>
  img {
    display: block;
    width: 100%;
    max-width: var(--owl-size, 160px);
    height: auto;
    aspect-ratio: 1;
    border-radius: var(--radius);
    border: 1px solid var(--line);
  }
</style>
