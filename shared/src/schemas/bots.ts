/**
 * v0.8: requests of the bots control centre and the export format (SPEC 10.12, Anhang S).
 * Strict like every schema: exact types, lengths, no unknown fields.
 */
import * as v from 'valibot';
import { CENTRAL_BOTS, LETTER } from '../constants.ts';
import { Id } from './common.ts';

const Text = (max: number) => v.pipe(v.string(), v.maxLength(max));

/** Coordinates of a bot home or move: anywhere (the server checks for land). */
export const Place = v.strictObject({
  lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
  lon: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
});

export const BotCreate = v.strictObject({
  name: Text(CENTRAL_BOTS.NAME_MAX_CHARS * 4),
});

export const SpeciesId = v.pipe(v.string(), v.regex(/^[a-z0-9-]{2,40}$/));

export const BotSettings = v.strictObject({
  name: Text(CENTRAL_BOTS.NAME_MAX_CHARS * 4),
  character: Text(CENTRAL_BOTS.CHARACTER_MAX_CHARS),
  home: v.nullable(Place),
  owlMode: v.picklist(['own', 'loan']),
  owlSpecies: v.nullable(SpeciesId),
  owlName: v.nullable(Text(40)),
  /** Tenths: 5 (0.5) to 200 (20.0). */
  motivation: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(CENTRAL_BOTS.MOTIVATION_MIN),
    v.maxValue(CENTRAL_BOTS.MOTIVATION_MAX),
  ),
  restHours: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.maxValue(CENTRAL_BOTS.REST_HOURS_MAX),
  ),
  playerOwls: v.boolean(),
});

export const BotStateChange = v.strictObject({
  state: v.picklist(['active', 'paused']),
});

/** Deleting asks for the exact name of the bot (SPEC 10.10). */
export const BotDelete = v.strictObject({
  name: Text(CENTRAL_BOTS.NAME_MAX_CHARS * 4),
});

const LetterTexts = v.strictObject({
  first: Text(LETTER.LARGE_MAX_CHARS),
  follow: Text(LETTER.LARGE_MAX_CHARS),
});

export const EventLetter = v.strictObject({
  parchment: v.picklist(['small', 'large']),
  owlMode: v.picklist(['default', 'own', 'loan']),
  texts: v.strictObject({ de: LetterTexts, en: LetterTexts }),
  media: v.pipe(v.array(Id), v.maxLength(CENTRAL_BOTS.MEDIA_PER_LETTER)),
});

export const EventGift = v.union([
  v.strictObject({
    gold: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(CENTRAL_BOTS.GIFT_GOLD_MIN),
      v.maxValue(CENTRAL_BOTS.GIFT_GOLD_MAX),
    ),
  }),
  v.strictObject({ species: SpeciesId }),
]);

export const EventInput = v.strictObject({
  dueAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  move: v.nullable(Place),
  letter: v.nullable(EventLetter),
  gift: v.nullable(EventGift),
  context: Text(CENTRAL_BOTS.CONTEXT_MAX_CHARS),
});

/** The test of the AI personalisation: nothing is sent or stored (SPEC 10.12). */
export const AiTest = v.strictObject({
  language: v.picklist(['de', 'en']),
  variant: v.picklist(['first', 'follow']),
  /** The planned letter (the event form, saved or not). */
  planned: Text(LETTER.LARGE_MAX_CHARS),
  context: Text(CENTRAL_BOTS.CONTEXT_MAX_CHARS),
  playerLetter: v.pipe(v.string(), v.minLength(1), v.maxLength(LETTER.LARGE_MAX_CHARS)),
  /** v0.8.3: when the tested event is due (the bot's previous letter before it is the history). */
  dueAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  /** v0.8.3: the event being edited (never its own previous letter). */
  eventId: v.optional(Id),
});

export const ExportRequest = v.strictObject({
  /** Only these events (single actions); missing = the whole bot. */
  eventIds: v.optional(v.pipe(v.array(Id), v.maxLength(1000))),
});

// ── Export format (SPEC Anhang S) ──

const IsoTime = v.pipe(v.string(), v.isoTimestamp());

const ExportEvent = v.strictObject({
  id: Id,
  dueAt: IsoTime,
  status: v.picklist(['planned', 'running', 'archived', 'skipped']),
  move: v.nullable(Place),
  letter: v.nullable(EventLetter),
  gift: v.nullable(EventGift),
  context: Text(CENTRAL_BOTS.CONTEXT_MAX_CHARS),
  archive: v.nullable(
    v.strictObject({
      startedAt: v.nullable(IsoTime),
      archivedAt: v.nullable(IsoTime),
      recipients: v.pipe(v.number(), v.integer(), v.minValue(0)),
      sent: v.pipe(v.number(), v.integer(), v.minValue(0)),
      delivered: v.pipe(v.number(), v.integer(), v.minValue(0)),
      read: v.pipe(v.number(), v.integer(), v.minValue(0)),
      replies: v.pipe(v.number(), v.integer(), v.minValue(0)),
    }),
  ),
});

const ExportBot = v.strictObject({
  id: Id,
  name: Text(CENTRAL_BOTS.NAME_MAX_CHARS * 4),
  state: v.picklist(['draft', 'active', 'paused']),
  character: Text(CENTRAL_BOTS.CHARACTER_MAX_CHARS),
  home: v.nullable(Place),
  owl: v.strictObject({
    mode: v.picklist(['own', 'loan']),
    species: v.nullable(SpeciesId),
    name: v.nullable(Text(40)),
    sex: v.picklist(['f', 'm']),
    motivation: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(CENTRAL_BOTS.MOTIVATION_MIN),
      v.maxValue(CENTRAL_BOTS.MOTIVATION_MAX),
    ),
    restHours: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(0),
      v.maxValue(CENTRAL_BOTS.REST_HOURS_MAX),
    ),
    playerOwls: v.boolean(),
  }),
  /** false: only some events of the bot (its settings are not applied to an existing bot). */
  complete: v.boolean(),
  events: v.pipe(v.array(ExportEvent), v.maxLength(10_000)),
});

export const ExportFile = v.strictObject({
  format: v.literal(CENTRAL_BOTS.EXPORT_FORMAT),
  version: v.literal(CENTRAL_BOTS.EXPORT_VERSION),
  exportedAt: IsoTime,
  bots: v.pipe(v.array(ExportBot), v.maxLength(1000)),
  media: v.pipe(
    v.array(
      v.strictObject({
        id: Id,
        bot: Id,
        file: v.pipe(v.string(), v.regex(/^media\/[A-Za-z0-9_-]{22}\.webp$/)),
        sha256: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
        width: v.pipe(v.number(), v.integer(), v.minValue(1)),
        height: v.pipe(v.number(), v.integer(), v.minValue(1)),
      }),
    ),
    v.maxLength(CENTRAL_BOTS.IMPORT_MAX_FILES),
  ),
});

export type ExportFileType = v.InferOutput<typeof ExportFile>;
export type EventInputType = v.InferOutput<typeof EventInput>;
export type BotSettingsType = v.InferOutput<typeof BotSettings>;
