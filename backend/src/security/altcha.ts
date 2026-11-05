/**
 * Self-hosted proof-of-work captcha (ALTCHA, SPEC 4.1, 5.10). The server signs a challenge
 * (HMAC key derived from the root secret), the browser brute-forces the counter, the server
 * verifies the solution once (replays are rejected until the challenge expires).
 */
import { createChallenge, verifySolution, type Challenge } from 'altcha-lib';
import type { AltchaPayloadInput } from '@posteulen/shared/schemas/auth.ts';
import { deriveKey } from 'altcha-lib/algorithms/sha';
import { Ephemeral } from './limits.ts';

export const ALTCHA_ALGORITHM = 'SHA-256';
const VALID_MS = 10 * 60_000;

export type AltchaPayload = AltchaPayloadInput;

export class Altcha {
  private readonly used = new Ephemeral<true>(50_000);
  private readonly secret: string;
  /** Upper bound of the secret counter; average work = maxCounter / 2 hashes. */
  private readonly maxCounter: number;

  constructor(secret: string, maxCounter: number) {
    this.secret = secret;
    this.maxCounter = maxCounter;
  }

  /**
   * altcha-lib checks expiry against the system clock, so challenges always use real time
   * (the injected game clock is ignored here).
   */
  async create(_now?: number): Promise<Challenge> {
    const now = Date.now();
    const counter = Math.floor(Math.random() * this.maxCounter);
    const challenge = await createChallenge({
      algorithm: ALTCHA_ALGORITHM,
      cost: 1,
      counter,
      deriveKey,
      hmacSignatureSecret: this.secret,
      expiresAt: Math.floor((now + VALID_MS) / 1000),
    });
    return {
      parameters: challenge.parameters,
      ...(challenge.signature ? { signature: challenge.signature } : {}),
    };
  }

  /** True once per valid, solved challenge. */
  async verify(payload: AltchaPayload, _now?: number): Promise<boolean> {
    const now = Date.now();
    const signature = payload.challenge.signature;
    if (typeof signature !== 'string' || this.used.get(signature, now)) return false;
    if (payload.challenge.parameters.algorithm !== ALTCHA_ALGORITHM) return false;
    let result;
    try {
      const { expiresAt, ...parameters } = payload.challenge.parameters;
      result = await verifySolution({
        challenge: {
          parameters: expiresAt === undefined ? parameters : { ...parameters, expiresAt },
          signature,
        },
        solution: {
          counter: payload.solution.counter,
          derivedKey: payload.solution.derivedKey,
        },
        deriveKey,
        hmacSignatureSecret: this.secret,
      });
    } catch {
      return false;
    }
    if (!result.verified) return false;
    this.used.set(signature, true, VALID_MS, now);
    return true;
  }
}
