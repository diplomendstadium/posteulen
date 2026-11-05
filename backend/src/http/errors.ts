import * as v from 'valibot';

/** An expected error with a code the clients translate (texts/de.ts → errors.*). */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly extra: Record<string, unknown>;

  constructor(status: number, code: string, extra: Record<string, unknown> = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/** Strict schema validation; any deviation is a plain bad_request (SPEC 6). */
export function parse<TSchema extends v.GenericSchema>(
  schema: TSchema,
  input: unknown,
): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, input);
  if (!result.success) throw new HttpError(400, 'bad_request');
  return result.output;
}
