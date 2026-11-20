/**
 * Account context (SPEC 5.5): the signed-in account ID together with a generation that is
 * renewed with every change of authentication (login, registration, restored session, sign-out,
 * a session switched in another tab). Every asynchronous piece of work – requests, key checks,
 * vault synchronisation, decryption, local storage – captures the context it started in and
 * drops its result and side effects as soon as that context is no longer current.
 *
 * Plain TypeScript without Svelte state, so it can be used (and tested) everywhere.
 */

export interface AccountContext {
  /** The account the work belongs to. */
  readonly accountId: string;
  /** Unique per authentication change, never reused within a page's lifetime. */
  readonly generation: number;
  /** Aborted as soon as the context ends – cancels running requests where possible. */
  readonly signal: AbortSignal;
}

/** A result or side effect of an outdated context was dropped. Never shown to the user. */
export class StaleContextError extends Error {
  constructor() {
    super('stale_context');
    this.name = 'StaleContextError';
  }
}

let generation = 0;
let active: { context: AccountContext; controller: AbortController } | null = null;

/** Starts a new context for an account; the previous one ends (its work is aborted). */
export function beginContext(accountId: string): AccountContext {
  endContext();
  const controller = new AbortController();
  const context: AccountContext = { accountId, generation, signal: controller.signal };
  active = { context, controller };
  return context;
}

/** Ends the current context (sign-out, 401, session switched elsewhere). */
export function endContext(): void {
  generation++;
  const previous = active;
  active = null;
  previous?.controller.abort();
}

/** The context of the signed-in account, or null when nobody is signed in. */
export function currentContext(): AccountContext | null {
  return active?.context ?? null;
}

/** The current generation; changes with every authentication change. */
export function contextGeneration(): number {
  return generation;
}

export function isCurrent(context: AccountContext | null | undefined): context is AccountContext {
  return context !== null && context !== undefined && active?.context === context;
}

/** Throws if the context ended in the meantime – call after every await. */
export function assertCurrent(context: AccountContext): void {
  if (!isCurrent(context)) throw new StaleContextError();
}

/** The current context or an error: for work that only makes sense while signed in. */
export function requireContext(): AccountContext {
  const context = currentContext();
  if (!context) throw new StaleContextError();
  return context;
}

/** Test hook: back to the state of a fresh page. */
export function resetContextsForTests(): void {
  active?.controller.abort();
  active = null;
  generation = 0;
}
