/**
 * Self-hosted proof-of-work captcha (ALTCHA, SPEC 4.1, 5.10). The server signs a challenge
 * (HMAC key derived from the root secret), the browser brute-forces the counter, the server
 * verifies the solution once (replays are rejected until the challenge expires).
 */
import { randomInt } from 'node:crypto';
import { createChallenge, verifySolution, type Challenge } from 'altcha-lib';
import type { AltchaPayloadInput } from '@posteulen/shared/schemas/auth.ts';
import { deriveKey } from 'altcha-lib/algorithms/sha';
import { Ephemeral } from './limits.ts';

export const ALTCHA_ALGORITHM = 'SHA-256';
const VALID_MS = 10 * 60_000;

export type AltchaPayload = AltchaPayloadInput;

export class Altcha {
  private readonly used = new Ephemeral<true>(50_000);
  /** Challenges whose solution is being checked right now. */
  private readonly checking = new Set<string>();
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
    // The secret counter must be unpredictable (v0.6.1: CSPRNG instead of Math.random).
    const counter = randomInt(this.maxCounter);
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

  /**
   * True once per valid, solved challenge. While one request checks a solution (asynchronous),
   * the same challenge counts as taken: otherwise several requests sent at the same time could
   * all pass with one solution (v0.6.1). Only verified solutions are remembered, so forged
   * signatures cannot crowd real ones out of the list.
   */
  async verify(payload: AltchaPayload, _now?: number): Promise<boolean> {
    const now = Date.now();
    const signature = payload.challenge.signature;
    if (typeof signature !== 'string' || this.used.get(signature, now)) return false;
    if (this.checking.has(signature)) return false;
    if (payload.challenge.parameters.algorithm !== ALTCHA_ALGORITHM) return false;
    this.checking.add(signature);
    try {
      const verified = await this.check(payload, signature);
      if (verified) this.used.set(signature, true, VALID_MS, Date.now());
      return verified;
    } finally {
      this.checking.delete(signature);
    }
  }

  private async check(payload: AltchaPayload, signature: string): Promise<boolean> {
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
    return result.verified;
  }
}
