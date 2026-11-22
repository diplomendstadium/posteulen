/** v0.7: vouchers for gold or an owl; v1.3.1 also owl biscuits or treats (SPEC 13, 8.10). */
import * as v from 'valibot';
import { VOUCHER } from '../constants.ts';
import { SPECIES } from '../species.ts';
import { ShortText } from './common.ts';

/** Admin: a new voucher – gold (in tenths) or an owl of a species ('random': any but the phoenix). */
export const VoucherCreate = v.variant('kind', [
  v.strictObject({
    kind: v.literal('gold'),
    gold: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(VOUCHER.GOLD_MIN),
      v.maxValue(VOUCHER.GOLD_MAX),
    ),
  }),
  v.strictObject({
    kind: v.literal('owl'),
    species: v.picklist(['random', ...SPECIES.map((species) => species.id)]),
  }),
  // v1.3.1: owl biscuits or treats for the pouch (1–50, SPEC 9.1.6).
  v.strictObject({
    kind: v.picklist(['biscuits', 'treats']),
    count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(VOUCHER.BAG_MAX)),
  }),
]);

/** User: redeem a code (typed by hand: spaces and dashes are ignored). */
export const VoucherRedeem = v.strictObject({ code: ShortText(40) });

/**
 * v1.3.1: the admin makes a player privileged (SPEC 9.1.7, 13) – by name, for good (`until`
 * null) or until a point in time (ms) – or takes it back.
 */
export const PrivilegeGrant = v.strictObject({
  name: ShortText(80),
  until: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
});

export const PrivilegeRevoke = v.strictObject({ name: ShortText(80) });
