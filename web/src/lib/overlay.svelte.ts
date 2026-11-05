/**
 * Owl picture overlays (SPEC 9.2.6): departure, arrival, feeding, petting. Only one at a
 * time; a new one replaces the old. The picture is loaded only when it is shown.
 */
import type { OwlImageKind } from '@posteulen/shared/species.ts';

export interface OverlayImage {
  readonly id: number;
  readonly species: string;
  readonly kind: OwlImageKind;
  readonly caption: string;
}

export const overlay = $state<{ current: OverlayImage | null }>({ current: null });

let next = 1;

export function showOwlImage(species: string, kind: OwlImageKind, caption: string): void {
  overlay.current = { id: next++, species, kind, caption };
}

export function closeOwlImage(): void {
  overlay.current = null;
}
