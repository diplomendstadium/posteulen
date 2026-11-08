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

onSignOut(clearReplyWith);
