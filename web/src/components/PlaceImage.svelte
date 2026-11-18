<script lang="ts">
  /**
   * v0.10: the picture of a place on top of its page – the Menagerie or the owl post office, by
   * day or by night at the player's fictional home (sun more than 6° below the horizon = night,
   * as for the homecoming pictures). v1.1: in the Christmas season at home the snowy Christmas
   * pictures, by day and by night (SPEC 9.2.6, 9.11). v1.2: inside the post office the picture of
   * the team of the day (SPEC 8.6, 9.6). v1.2.1: inside the Menagerie its own pictures (SPEC
   * 8.7); on the letters page the desk of the season at home (SPEC 9.11). v1.2.3: scene and
   * description come from lib/places.ts (also used by the info text on the start page).
   */
  import type { LoanTeam } from '@posteulen/shared/species.ts';
  import { sceneImage } from '../lib/owl-image.ts';
  import { homeLight } from '../lib/season.ts';
  import { placeAlt, placeScene, type Place } from '../lib/places.ts';

  let {
    place,
    team = 'A',
  }: {
    place: Place;
    team?: LoanTeam;
  } = $props();

  const light = homeLight();
  const { day } = light;
  const scene = $derived(placeScene(place, light, team));
  const image = $derived(sceneImage(scene));
  const alt = $derived(placeAlt(place, light));
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
