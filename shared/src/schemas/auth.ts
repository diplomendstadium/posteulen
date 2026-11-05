/**
 * Request schemas of the authentication endpoints (user and admin API). Sizes are checked
 * before anything reaches OPAQUE (DEPENDENCIES: opaque 1.1.0 leaks memory on malformed input).
 */
import * as v from 'valibot';
import { Base64Url, Id, ShortText } from './common.ts';

// Sizes for ristretto255 OPAQUE as produced by @serenity-kit/opaque (base64url, unpadded).
export const OpaqueRegistrationRequest = Base64Url(43, 43);
export const OpaqueRegistrationRecord = Base64Url(256, 256);
export const OpaqueStartLoginRequest = Base64Url(128, 128);
export const OpaqueFinishLoginRequest = Base64Url(86, 86);

const AltchaPayload = v.strictObject({
  challenge: v.strictObject({
    parameters: v.strictObject({
      algorithm: v.literal('SHA-256'),
      nonce: Base64Url(1, 200),
      salt: Base64Url(1, 200),
      cost: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10)),
      keyLength: v.pipe(v.number(), v.integer(), v.minValue(16), v.maxValue(64)),
      keyPrefix: v.pipe(v.string(), v.regex(/^[0-9a-f]{1,128}$/)),
      expiresAt: v.optional(v.pipe(v.number(), v.integer())),
    }),
    signature: v.pipe(v.string(), v.regex(/^[0-9a-f]{64,128}$/)),
  }),
  solution: v.strictObject({
    counter: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2 ** 32 - 1)),
    derivedKey: v.pipe(v.string(), v.regex(/^[0-9a-f]{32,128}$/)),
    time: v.optional(v.number()),
  }),
});
export type AltchaPayloadInput = v.InferOutput<typeof AltchaPayload>;

export const KeyPackageSchema = v.strictObject({
  format: v.literal(1),
  wrappedMasterKey: Base64Url(96, 96),
  privateKeys: Base64Url(182, 182),
});

export const Home = v.strictObject({
  lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
  lon: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
});

export const RegisterStart = v.strictObject({
  name: ShortText(100),
  inviteCode: v.optional(ShortText(40)),
  altcha: AltchaPayload,
  registrationRequest: OpaqueRegistrationRequest,
});

export const RegisterFinish = v.strictObject({
  reservationId: Id,
  registrationRecord: OpaqueRegistrationRecord,
  ed25519Public: Base64Url(43, 43),
  x25519Public: Base64Url(43, 43),
  keyPackage: KeyPackageSchema,
  home: Home,
});

export const LoginStart = v.strictObject({
  name: ShortText(100),
  startLoginRequest: OpaqueStartLoginRequest,
  altcha: v.optional(AltchaPayload),
});

export const LoginFinish = v.strictObject({
  attemptId: Id,
  finishLoginRequest: OpaqueFinishLoginRequest,
});

export const ReauthStart = v.strictObject({
  purpose: v.picklist(['password', 'delete']),
  startLoginRequest: OpaqueStartLoginRequest,
  altcha: v.optional(AltchaPayload),
});

export const PasswordStart = v.strictObject({
  token: Id,
  registrationRequest: OpaqueRegistrationRequest,
});

export const PasswordFinish = v.strictObject({
  token: Id,
  registrationRecord: OpaqueRegistrationRecord,
  keyPackage: KeyPackageSchema,
});

export const AdminLoginStart = v.strictObject({
  startLoginRequest: OpaqueStartLoginRequest,
  altcha: v.optional(AltchaPayload),
});

export const AdminPasswordFinish = v.strictObject({
  token: Id,
  registrationRecord: OpaqueRegistrationRecord,
});

/** Answers that tell the client what to do next. */
export type LoginStartResponse =
  | { readonly status: 'ok'; readonly attemptId: string; readonly loginResponse: string }
  | { readonly status: 'captcha_required' }
  | { readonly status: 'wait'; readonly retryAfterSeconds: number };

export const AdminReauthStart = v.strictObject({
  startLoginRequest: OpaqueStartLoginRequest,
});

export const AdminPasswordStart = v.strictObject({
  token: Id,
  registrationRequest: OpaqueRegistrationRequest,
});

export const RegistrationModeUpdate = v.strictObject({
  mode: v.picklist(['closed', 'invite', 'open']),
});

export const ErrorLogUpdate = v.strictObject({
  read: v.literal(true),
});

export const AccountDelete = v.strictObject({ token: Id });

export const NameChange = v.strictObject({ name: v.pipe(v.string(), v.maxLength(100)) });

export const HomeChange = v.strictObject({ home: Home });

export const InactivityUpdate = v.strictObject({
  days: v.pipe(v.number(), v.integer(), v.minValue(60), v.maxValue(3650)),
});

/** Broadcast: plain text up to 3 000 characters (SPEC 13 item 6). */
export const Broadcast = v.strictObject({
  text: v.pipe(v.string(), v.minLength(1), v.maxLength(3000)),
});
