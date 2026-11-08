/** Request schemas for contacts, vault, letters and push (SPEC 6). */
import * as v from 'valibot';
import { LETTER } from '../constants.ts';
import { Base64Url, Id, ShortText } from './common.ts';
import { OwlRef, Recipients, RestHours } from './owls.ts';

export const ContactRequest = v.strictObject({
  name: ShortText(100),
  /** The requested name, encrypted with the requester's vault key (shown only to them). */
  label: Base64Url(40, 600),
});

export const VaultPut = v.strictObject({
  version: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1_000_000)),
  blob: Base64Url(40, 8000),
});

export const LetterPrepare = v.strictObject({
  recipients: Recipients,
  parchment: v.picklist(['small', 'large']),
  owlId: OwlRef,
  /** v0.7: rest at each recipient (hours). */
  rest: RestHours,
});

export const LetterSend = v.strictObject({
  token: Id,
  items: v.pipe(
    v.array(
      v.strictObject({
        letterId: Id,
        ciphertext: Base64Url(5000, 88_000),
        wrapRecipient: Base64Url(107, 107),
        wrapSender: Base64Url(107, 107),
      }),
    ),
    v.minLength(1),
    v.maxLength(LETTER.MAX_RECIPIENTS),
  ),
});

export const IdList = v.strictObject({
  ids: v.pipe(v.array(Id), v.minLength(1), v.maxLength(200)),
});

export const PushSubscriptionInput = v.strictObject({
  endpoint: v.pipe(v.string(), v.maxLength(2000), v.startsWith('https://')),
  keys: v.strictObject({
    p256dh: Base64Url(80, 100),
    auth: Base64Url(16, 32),
  }),
});

export const PushAck = v.strictObject({ id: Id });

/** A plain-text letter to one's own bot (SPEC 10.1: not end-to-end encrypted). */
export const BotLetterSend = v.strictObject({
  botId: Id,
  owlId: OwlRef,
  parchment: v.picklist(['small', 'large']),
  text: v.pipe(v.string(), v.maxLength(LETTER.LARGE_MAX_CHARS * 2)),
});
