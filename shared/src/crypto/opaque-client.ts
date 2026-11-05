/**
 * Client side of OPAQUE (RFC 9807) with fixed Argon2id parameters (SPEC 5.3, D-03).
 * The password is NFC-normalised (SPEC 7.2) and never leaves this module except into OPAQUE.
 */
import * as opaque from '@serenity-kit/opaque';
import { SECURITY } from '../constants.ts';
import { normalizePassword } from '../names.ts';
import { fromBase64Url } from './encoding.ts';

export const KEY_STRETCHING = {
  'argon2id-custom': {
    memory: SECURITY.ARGON2_MEMORY_KIB,
    iterations: SECURITY.ARGON2_ITERATIONS,
    parallelism: SECURITY.ARGON2_PARALLELISM,
  },
} as const;

export async function ready(): Promise<void> {
  await opaque.ready;
}

export function startRegistration(password: string): { state: string; request: string } {
  const result = opaque.client.startRegistration({ password: normalizePassword(password) });
  return { state: result.clientRegistrationState, request: result.registrationRequest };
}

export function finishRegistration(
  password: string,
  state: string,
  response: string,
): { record: string; exportKey: Uint8Array } {
  const result = opaque.client.finishRegistration({
    password: normalizePassword(password),
    clientRegistrationState: state,
    registrationResponse: response,
    keyStretching: KEY_STRETCHING,
  });
  return { record: result.registrationRecord, exportKey: fromBase64Url(result.exportKey) };
}

export function startLogin(password: string): { state: string; request: string } {
  const result = opaque.client.startLogin({ password: normalizePassword(password) });
  return { state: result.clientLoginState, request: result.startLoginRequest };
}

/** Returns null for a wrong password or an unknown name – both look the same. */
export function finishLogin(
  password: string,
  state: string,
  response: string,
): { finishRequest: string; exportKey: Uint8Array } | null {
  const result = opaque.client.finishLogin({
    password: normalizePassword(password),
    clientLoginState: state,
    loginResponse: response,
    keyStretching: KEY_STRETCHING,
  });
  if (!result) return null;
  return { finishRequest: result.finishLoginRequest, exportKey: fromBase64Url(result.exportKey) };
}
