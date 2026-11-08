/** v0.7.1: a short message to the admin (SPEC 8.10). The text rules are checked on the server. */
import * as v from 'valibot';
import { ShortText } from './common.ts';

export const FeedbackSend = v.strictObject({ text: ShortText(2000) });
