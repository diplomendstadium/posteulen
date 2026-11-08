/** v0.7: vouchers for gold or an owl (SPEC 13, 8.10). */
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
]);

/** User: redeem a code (typed by hand: spaces and dashes are ignored). */
export const VoucherRedeem = v.strictObject({ code: ShortText(40) });
