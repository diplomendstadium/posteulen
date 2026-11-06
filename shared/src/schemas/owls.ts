/** Request schemas for owls, flights, gold and gifts (SPEC 6, 8.5, 8.6, 9). */
import * as v from 'valibot';
import { GOLD, LETTER } from '../constants.ts';
import { SPECIES } from '../species.ts';
import { Base64Url, Id, ShortText } from './common.ts';

/** Prefix of an owl reference that borrows a loan owl of the day on sending (9.6). */
export const LOAN_REF_PREFIX = 'loan:';

/** An own or loan owl, or `loan:<species>` for a loan owl that is borrowed on sending. */
export const OwlRef = v.union([
  Id,
  v.picklist(SPECIES.map((species) => `${LOAN_REF_PREFIX}${species.id}`)),
]);

export const Recipients = v.pipe(
  v.array(Id),
  v.minLength(1),
  v.maxLength(LETTER.MAX_RECIPIENTS),
  v.check((ids) => new Set(ids).size === ids.length),
);

export const OwlBuy = v.strictObject({
  species: v.picklist(SPECIES.map((species) => species.id)),
});

export const OwlName = v.strictObject({ name: ShortText(60) });

/** Releasing needs the owl's exact name, typed by the user (v0.3). */
export const OwlRelease = v.strictObject({ name: ShortText(60) });

export const FlightPreview = v.strictObject({ recipients: Recipients });

/** A small cover letter (always small parchment, SPEC 9.1.4, 9.2.7). */
export const CoverLetter = v.strictObject({
  letterId: Id,
  ciphertext: Base64Url(5000, 6000),
  wrapRecipient: Base64Url(107, 107),
  wrapSender: Base64Url(107, 107),
});

export const GoldPrepare = v.strictObject({
  recipient: Id,
  amount: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(GOLD.TRANSFER_MIN),
    v.maxValue(GOLD.TRANSFER_MAX),
  ),
  owlId: OwlRef,
  withCover: v.boolean(),
});

export const GiftPrepare = v.strictObject({
  recipient: Id,
  withCover: v.boolean(),
});

export const CoverSend = v.strictObject({
  token: Id,
  cover: v.optional(CoverLetter),
});

export const OwlTreat = v.strictObject({ kind: v.picklist(['self', 'vet']) });

export const Loan = v.strictObject({
  species: v.picklist(SPECIES.map((species) => species.id)),
});

export const ChickGiftPrepare = v.strictObject({
  chickId: Id,
  recipient: Id,
  withCover: v.boolean(),
});
