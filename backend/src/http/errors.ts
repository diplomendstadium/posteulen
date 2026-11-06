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

/**
 * Pre-handler for state-changing endpoints without payload: anything but no body or `{}` is
 * an unknown field and rejected (SPEC 6, security review stage 6).
 */
export async function emptyBody(request: { body?: unknown }): Promise<void> {
  const body = request.body;
  if (body === undefined || body === null) return;
  if (typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0) return;
  throw new HttpError(400, 'bad_request');
}
