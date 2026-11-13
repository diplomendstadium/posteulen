/**
 * v0.7.1: "Give it a reply" on a visiting owl opens the chat with its holder with exactly this
 * owl chosen (no other owls, no rest option, SPEC 8.4). Kept only in memory for the next chat.
 */
import { onSignOut } from './auth.svelte.ts';

export const replyWith = $state<{ peerId: string | null; owlId: string | null }>({
  peerId: null,
  owlId: null,
});

export function clearReplyWith(): void {
  replyWith.peerId = null;
  replyWith.owlId = null;
}

/**
 * v0.8.5: "Brief schreiben" on the card of a ready own or loan owl: the chat of the first
 * chosen recipient opens with this owl and all chosen recipients in the editor.
 */
export const writeWith = $state<{
  peerId: string | null;
  owlId: string | null;
  recipients: string[];
}>({ peerId: null, owlId: null, recipients: [] });

export function clearWriteWith(): void {
  writeWith.peerId = null;
  writeWith.owlId = null;
  writeWith.recipients = [];
}

onSignOut(clearReplyWith);
onSignOut(clearWriteWith);
