<script lang="ts">
  /**
   * v0.10: the picture of a place on top of its page – the Menagerie or the owl post office, by
   * day or by night at the player's fictional home (sun more than 6° below the horizon = night,
   * as for the homecoming pictures). v1.1: in the Christmas season at home the snowy Christmas
   * pictures, by day and by night (SPEC 9.2.6, 9.11). v1.2: inside the post office the picture of
   * the team of the day (SPEC 8.6, 9.6). v1.2.1: inside the Menagerie its own pictures (SPEC
   * 8.7); on the letters page the desk of the season at home (SPEC 9.11).
   */
  import type { LoanTeam, SceneId } from '@posteulen/shared/species.ts';
  import { t, fill } from '../lib/i18n.svelte.ts';
  import { sceneImage } from '../lib/owl-image.ts';
  import { homeLight, lettersScene } from '../lib/season.ts';

  let {
    place,
    team = 'A',
  }: {
    place: 'menagerie' | 'menagerieInside' | 'post' | 'postInside' | 'letters';
    team?: LoanTeam;
  } = $props();

  const light = homeLight();
  const { day, christmas } = light;
  const scene = $derived<SceneId>(
    place === 'letters'
      ? lettersScene(light)
      : (`${place}${place === 'postInside' ? team : ''}${christmas ? 'Xmas' : ''}${day ? 'Day' : 'Night'}` as SceneId),
  );
  const image = $derived(sceneImage(scene));
  const deskView = $derived(
    t.letters[
      `desk_${light.season}_${day ? 'day' : 'night'}` as `desk_${typeof light.season}_${'day' | 'night'}`
    ],
  );
  const alt = $derived(
    place === 'letters'
      ? fill(t.letters.picture, { view: deskView })
      : place === 'menagerieInside'
        ? christmas
          ? day
            ? t.menagerie.insideChristmasDay
            : t.menagerie.insideChristmasNight
          : day
            ? t.menagerie.insideDay
            : t.menagerie.insideNight
        : place === 'postInside'
          ? christmas
            ? day
              ? t.post.insideChristmasDay
              : t.post.insideChristmasNight
            : day
              ? t.post.insideDay
              : t.post.insideNight
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
