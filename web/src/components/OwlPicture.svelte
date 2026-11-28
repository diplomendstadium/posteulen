<script lang="ts">
  import type { OwlImageKind } from '@posteulen/shared/species.ts';
  import type { ChickLook } from '@posteulen/shared/game/look.ts';
  import { t } from '../lib/i18n.svelte.ts';
  import { owlImage, sceneImage } from '../lib/owl-image.ts';
  import { homeLight, standardKind } from '../lib/season.ts';

  let {
    speciesId,
    kind = 'normal',
    alt,
    size = 160,
    perch = false,
    wide = false,
    second = false,
    chickLook = 0,
  }: {
    speciesId: string;
    kind?: OwlImageKind;
    alt: string;
    size?: 160 | 480;
    /** Empty perch instead of the owl (lent to the menagerie, v0.3). */
    perch?: boolean;
    /** v1.1: across the whole width of its card (owl overview, borrowed owls). */
    wide?: boolean;
    /** v1.4.2: the second look of its species (SPEC 9.2.6). */
    second?: boolean;
    /** v1.5.0: the chick look – standard, second or third chick picture (SPEC 9.2.6). */
    chickLook?: ChickLook;
  } = $props();

  /**
   * v1.1: the standard pictures follow the light at the player's home – awake in the dark by
   * night, the Christmas pictures in the Christmas season (SPEC 9.2.6). Decided when shown.
   */
  const light = homeLight();

  const image = $derived.by(() => {
    if (!perch) return owlImage(speciesId, standardKind(kind, light, second, chickLook));
    const scene = sceneImage('perch');
    return {
      files: {
        s160: scene.files['s160'] ?? '',
        s480: scene.files['s480'] ?? '',
        s960: scene.files['s960'],
      } as {
        s160: string;
        s480: string;
        s960?: string;
      },
      placeholder: scene.placeholder,
    };
  });
</script>

<img
  class:wide
  src={size === 160 && !wide ? image.files.s160 : image.files.s480}
  srcset={`${image.files.s160} 160w, ${image.files.s480} 480w${image.files.s960 ? `, ${image.files.s960} 960w` : ''}`}
  sizes={wide ? '(min-width: 48rem) 29rem, 100vw' : `${size}px`}
  width={size}
  height={size}
  alt={image.placeholder ? `${alt} (${t.images.placeholderAlt})` : alt}
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

  img.wide {
    max-width: 100%;
  }
</style>
