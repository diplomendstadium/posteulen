/** Request schemas for owls, flights, gold and gifts (SPEC 6, 8.5, 8.6, 9). */
import * as v from 'valibot';
import { GOLD, LETTER } from '../constants.ts';
import { SPECIES } from '../species.ts';
import { Base64Url, Id, ShortText } from './common.ts';

/** Prefix of an owl reference that borrows a loan owl of the day on sending (9.6). */
export const LOAN_REF_PREFIX = 'loan:';

/** v0.7: prefix of an owl resting at the writer that takes a reply back to its sender. */
export const GUEST_REF_PREFIX = 'guest:';

/**
 * An own or loan owl, `loan:<species>` for a loan owl that is borrowed on sending, or (v0.7)
 * `guest:<owl id>` for a visiting owl that carries a reply back to its sender.
 */
export const OwlRef = v.union([
  Id,
  v.picklist(SPECIES.map((species) => `${LOAN_REF_PREFIX}${species.id}`)),
  v.pipe(v.string(), v.regex(/^guest:[A-Za-z0-9_-]{22}$/)),
]);

/** v0.7: rest at each recipient in hours (0 = none). */
export const RestHours = v.optional(
  v.picklist(LETTER.REST_HOURS_CHOICES as unknown as readonly [number, ...number[]]),
  0,
);

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

export const FlightPreview = v.strictObject({
  recipients: Recipients,
  /** v0.7: rest at each recipient (hours). */
  rest: RestHours,
  /**
   * v0.8.5: rest for loan owls and loan offers, if it differs from `rest` (the preselection
   * depends on the kind of owl, SPEC 8.4); without it `rest` counts for all owls.
   */
  restLoan: v.optional(
    v.picklist(LETTER.REST_HOURS_CHOICES as unknown as readonly [number, ...number[]]),
  ),
  /** v0.7: offer visiting owls resting here that can take a reply to their holder (letters). */
  guests: v.optional(v.boolean(), false),
});

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
