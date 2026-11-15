<script lang="ts">
  /**
   * v0.10: the picture of a place on top of its page – the Menagerie or the owl post office, by
   * day or by night at the player's fictional home (sun more than 6° below the horizon = night,
   * as for the homecoming pictures). Without a home (should not happen when signed in): by day.
   */
  import { isDay } from '@posteulen/shared/game/sun.ts';
  import { account } from '../lib/auth.svelte.ts';
  import { t } from '../lib/i18n.svelte.ts';
  import { sceneImage } from '../lib/owl-image.ts';

  let { place }: { place: 'menagerie' | 'post' } = $props();

  const home = account.profile?.home;
  const day = home ? isDay(Date.now(), home.lat, home.lon) : true;
  const image = $derived(
    sceneImage(
      place === 'menagerie'
        ? day
          ? 'menagerieDay'
          : 'menagerieNight'
        : day
          ? 'postDay'
          : 'postNight',
    ),
  );
  const alt = $derived(
    place === 'menagerie'
      ? day
        ? t.menagerie.pictureDay
        : t.menagerie.pictureNight
      : day
        ? t.post.pictureDay
        : t.post.pictureNight,
  );
</script>

{#if !image.placeholder}
  <figure class="place" data-testid="place-image" data-daytime={day ? 'day' : 'night'}>
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
