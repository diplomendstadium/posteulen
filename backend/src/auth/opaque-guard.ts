/**
 * Server calls into @serenity-kit/opaque and checks of what clients hand in (v0.6.1).
 *
 * Protocol messages of the right size can still be malformed (e.g. not a valid point); the
 * library then throws. That is a bad request, not a server error: before v0.6.1 every such
 * request ended as a 500 with an entry in the admin error log – and anyone could send them.
 */
import * as opaque from '@serenity-kit/opaque';
import { sodium } from '@posteulen/shared/crypto/sodium.ts';
import { HttpError } from '../http/errors.ts';

/** Runs an OPAQUE server step; a malformed message becomes 400 bad_request. */
export function opaqueStep<T>(run: () => T): T {
  try {
    return run();
  } catch {
    throw new HttpError(400, 'bad_request');
  }
}

let probe: string | undefined;

/** A well-formed login request, only used to check that a record can be read. */
function probeRequest(): string {
  probe ??= opaque.client.startLogin({ password: 'posteulen-record-check' }).startLoginRequest;
  return probe;
}

/**
 * A registration record is stored only if the server can use it for logins: a broken record
 * would otherwise make every later login attempt for this name fail with an error.
 */
export function checkRegistrationRecord(
  serverSetup: string,
  userIdentifier: string,
  registrationRecord: string,
): void {
  opaqueStep(() =>
    opaque.server.startLogin({
      serverSetup,
      userIdentifier,
      registrationRecord,
      startLoginRequest: probeRequest(),
    }),
  );
}

/**
 * Public identity keys of a new account (v0.6.1): Ed25519 must be a valid point of the main
 * subgroup, X25519 must not be of small order (letters to such a key could not be sealed).
 */
export async function checkPublicKeys(ed25519: Uint8Array, x25519: Uint8Array): Promise<void> {
  const s = await sodium();
  if (ed25519.length !== 32 || x25519.length !== 32) throw new HttpError(400, 'bad_request');
  if (!s.crypto_core_ed25519_is_valid_point(ed25519)) throw new HttpError(400, 'bad_request');
  try {
    s.crypto_scalarmult(s.randombytes_buf(32), x25519);
  } catch {
    throw new HttpError(400, 'bad_request');
  }
}
