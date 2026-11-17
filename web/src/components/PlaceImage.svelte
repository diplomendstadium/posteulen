<script lang="ts">
  /**
   * v0.10: the picture of a place on top of its page – the Menagerie or the owl post office, by
   * day or by night at the player's fictional home (sun more than 6° below the horizon = night,
   * as for the homecoming pictures). v1.1: in the Christmas season at home the snowy Christmas
   * pictures, by day and by night (SPEC 9.2.6, 9.11).
   */
  import type { SceneId } from '@posteulen/shared/species.ts';
  import { t } from '../lib/i18n.svelte.ts';
  import { sceneImage } from '../lib/owl-image.ts';
  import { homeLight } from '../lib/season.ts';

  /** v1.1: also the letters page – one picture for all times of day and the whole year. */
  let { place }: { place: 'menagerie' | 'post' | 'letters' } = $props();

  const { day, christmas } = homeLight();
  const scene = $derived<SceneId>(
    place === 'letters'
      ? 'letters'
      : (`${place}${christmas ? 'Xmas' : ''}${day ? 'Day' : 'Night'}` as SceneId),
  );
  const image = $derived(sceneImage(scene));
  const alt = $derived(
    place === 'letters'
      ? t.letters.picture
      : place === 'menagerie'
        ? christmas
          ? day
            ? t.menagerie.pictureChristmasDay
            : t.menagerie.pictureChristmasNight
          : day
            ? t.menagerie.pictureDay
            : t.menagerie.pictureNight
        : christmas
          ? day
            ? t.post.pictureChristmasDay
            : t.post.pictureChristmasNight
          : day
            ? t.post.pictureDay
            : t.post.pictureNight,
  );
</script>

{#if !image.placeholder}
  <figure
    class="place"
    data-testid="place-image"
    data-daytime={day ? 'day' : 'night'}
    data-scene={scene}
  >
    <img
      src={image.files['s960']}
      srcset={`${image.files['s480']} 480w, ${image.files['s960']} 960w`}
      sizes="(min-width: 60rem) 60rem, 100vw"
      width="960"
      height="960"
      {alt}
      decoding="async"
    />
  </figure>
{/if}

<style>
  /* v0.10.1: as wide as the other contents of the page, the whole square. */
  .place {
    margin: 0 0 1rem;
  }

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 0.5rem;
    box-shadow: 0 0.25rem 1rem rgb(0 0 0 / 25%);
  }
</style>
