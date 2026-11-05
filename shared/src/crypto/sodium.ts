/** Lazily initialised libsodium (libsodium-wrappers-sumo, SPEC 4.1). */
import sodiumModule from 'libsodium-wrappers-sumo';

export type Sodium = typeof sodiumModule;

let ready: Promise<Sodium> | undefined;

export function sodium(): Promise<Sodium> {
  ready ??= sodiumModule.ready.then(() => sodiumModule);
  return ready;
}
