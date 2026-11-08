/**
 * Owl picture overlays (SPEC 9.2.6): departure, arrival, feeding, petting. Only one at a
 * time; a new one replaces the old. The picture is loaded only when it is shown.
 */
import type { OwlImageKind, SceneId } from '@posteulen/shared/species.ts';

export interface OverlayImage {
  readonly id: number;
  readonly species: string;
  readonly kind: OwlImageKind;
  readonly caption: string;
  /** v0.7: a picture without a species (letters burning), with its own alternative text. */
  readonly scene?: { readonly id: SceneId; readonly alt: string };
}

export const overlay = $state<{ current: OverlayImage | null }>({ current: null });

let next = 1;

export function showOwlImage(species: string, kind: OwlImageKind, caption: string): void {
  overlay.current = { id: next++, species, kind, caption };
}

/** v0.7: a picture without a species, e.g. the letters burning in the fireplace. */
export function showSceneImage(id: SceneId, caption: string, alt: string): void {
  overlay.current = { id: next++, species: '', kind: 'normal', caption, scene: { id, alt } };
}

export function closeOwlImage(): void {
  overlay.current = null;
}
