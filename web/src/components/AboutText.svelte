<script lang="ts">
  /**
   * The info text "Über PostEulen" at the bottom of the start page (SPEC 8.1): a fixed text in
   * the Markdown subset of shared/src/markdown.ts, rendered as elements (never as HTML). The
   * pictures float at half the width of the text and follow day, night, season and Christmas
   * at home (Berlin when signed out) like everywhere in the app; on narrow screens they stand
   * above their text at full width.
   */
  import { ABOUT_DE, ABOUT_EN } from '@posteulen/shared/texts/about.ts';
  import { parseMarkdown } from '@posteulen/shared/markdown.ts';
  import type { SceneId } from '@posteulen/shared/species.ts';
  import { i18n, t, fill, speciesName } from '../lib/i18n.svelte.ts';
  import { owlImage, sceneImage } from '../lib/owl-image.ts';
  import { groupScene, homeLight } from '../lib/season.ts';
  import { groupAlt, placeAlt, placeScene } from '../lib/places.ts';
  import Link from './Link.svelte';

  const light = homeLight();
  const host = typeof location === 'undefined' ? 'posteulen.de' : location.host;
  const blocks = $derived(
    parseMarkdown((i18n.lang === 'en' ? ABOUT_EN : ABOUT_DE).replaceAll('{host}', host)),
  );

  interface Picture {
    readonly scene: string;
    readonly files: Readonly<Record<string, string>>;
    readonly alt: string;
  }

  function scenePicture(scene: SceneId, alt: string): Picture | null {
    const image = sceneImage(scene);
    return image.placeholder ? null : { scene, files: image.files, alt };
  }

  function picture(name: string): Picture | null {
    switch (name) {
      case 'desk':
        return scenePicture(placeScene('letters', light), placeAlt('letters', light));
      case 'group':
        return scenePicture(groupScene(light), groupAlt(light));
      case 'menagerie':
        return scenePicture(placeScene('menagerie', light), placeAlt('menagerie', light));
      case 'post':
        return scenePicture(placeScene('post', light), placeAlt('post', light));
      case 'feeding': {
        const image = owlImage('elfenkauz', 'feeding');
        return image.placeholder
          ? null
          : {
              scene: 'elfenkauzFeeding',
              files: { s480: image.files.s480, s960: image.files.s960 ?? image.files.s480 },
              alt: fill(t.owls.feeding, { name: speciesName('elfenkauz') }),
            };
      }
      default:
        return null;
    }
  }
</script>

<section class="about card" aria-label={t.start.about} data-testid="about">
  {#each blocks as block, index (index)}
    {#if block.kind === 'heading'}
      <h2>{block.text}</h2>
    {:else if block.kind === 'picture'}
      {@const shown = picture(block.picture)}
      {#if shown}
        <figure class="picture {block.align}" data-scene={shown.scene}>
          <img
            src={shown.files['s960']}
            srcset={`${shown.files['s480']} 480w, ${shown.files['s960']} 960w`}
            sizes="(min-width: 60rem) 28rem, (min-width: 34rem) 50vw, 100vw"
            width="960"
            height="960"
            alt={shown.alt}
            loading="lazy"
            decoding="async"
          />
        </figure>
      {/if}
    {:else}
      <p>
        {#each block.inlines as inline, inlineIndex (inlineIndex)}
          {#if inline.kind === 'strong'}<strong>{inline.text}</strong
            >{:else if inline.kind === 'em'}<em>{inline.text}</em
            >{:else if inline.kind === 'link'}<Link href={inline.href}>{inline.text}</Link
            >{:else}{inline.text}{/if}
        {/each}
      </p>
    {/if}
  {/each}
</section>

<style>
  /* v1.2.3: as wide as the rest of the start page; the floating pictures stay inside the box. */
  .about {
    display: flow-root;
    margin-top: 1.5rem;
  }

  /* A heading next to a picture stays in one piece instead of wrapping around its bottom. */
  h2 {
    display: flow-root;
    margin-top: 1.75rem;
  }

  h2:first-child {
    margin-top: 0;
  }

  p:last-child {
    margin-bottom: 0;
  }

  .picture {
    margin: 0.25rem 0 1rem;
    width: 100%;
  }

  .picture img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    box-shadow: var(--shadow);
  }

  /* Half the width of the text, the text flows around it – from about 544 px on. */
  @media (min-width: 34rem) {
    /* Each picture starts below the previous one, so they keep their order and never touch. */
    .picture {
      width: calc(50% - 0.75rem);
      clear: both;
    }

    .picture.right {
      float: right;
      margin-left: 1.5rem;
    }

    .picture.left {
      float: left;
      margin-right: 1.5rem;
    }
  }
</style>
