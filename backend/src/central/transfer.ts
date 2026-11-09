/**
 * v0.8: export and import of bots (SPEC Anhang S): a ZIP file with `bots.json` (versioned format,
 * stable IDs) and the pictures as `media/<id>.webp`. Only bot configuration, planned and past
 * events and pictures – never letters of players. An import adds, never overwrites: settings of an
 * existing bot stay, existing event IDs are skipped, events in the past are never sent again.
 * Conflicts of names and IDs are shown before anything is imported.
 */
import crypto from 'node:crypto';
import * as v from 'valibot';
import { CENTRAL_BOTS } from '@posteulen/shared/constants.ts';
import { normalizeName } from '@posteulen/shared/names.ts';
import { ExportFile, type ExportFileType } from '@posteulen/shared/schemas/bots.ts';
import type { Context } from '../context.ts';
import { HttpError } from '../http/errors.ts';
import { randomId } from '../security/ids.ts';
import { centralBot, mediaOf, type CentralBotRow, type EventRow } from './model.ts';
import { checkNewBotName, insertEvent } from './admin.ts';
import { readZip, writeZip, ZipError, type ZipEntry } from './zip.ts';

const JSON_FILE = 'bots.json';

function iso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

function exportEvent(event: EventRow): ExportFileType['bots'][number]['events'][number] {
  return {
    id: event.id,
    dueAt: new Date(event.due_at).toISOString(),
    status: event.state,
    move:
      event.move_lat !== null && event.move_lon !== null
        ? { lat: event.move_lat / 100, lon: event.move_lon / 100 }
        : null,
    letter:
      event.has_letter === 1
        ? {
            parchment: event.parchment,
            owlMode: event.owl_mode,
            texts: {
              de: { first: event.text_first_de, follow: event.text_follow_de },
              en: { first: event.text_first_en, follow: event.text_follow_en },
            },
            media: mediaOf(event),
          }
        : null,
    gift:
      event.gift_gold !== null
        ? { gold: event.gift_gold }
        : event.gift_species !== null
          ? { species: event.gift_species }
          : null,
    context: event.context,
    archive:
      event.state === 'planned'
        ? null
        : {
            startedAt: iso(event.started_at),
            archivedAt: iso(event.archived_at),
            recipients: event.recipients,
            sent: event.sent,
            delivered: event.delivered,
            read: event.read,
            replies: event.replies,
          },
  };
}

/**
 * A complete export (all bots), one bot, or only some of its events. Returns the ZIP file.
 */
export function exportBots(
  ctx: Context,
  options: { botId?: string; eventIds?: readonly string[] } = {},
): Buffer {
  const bots = options.botId
    ? ctx.db.all<CentralBotRow>('SELECT * FROM central_bots WHERE id = ?', options.botId)
    : ctx.db.all<CentralBotRow>('SELECT * FROM central_bots ORDER BY name_key');
  const file: ExportFileType = {
    format: CENTRAL_BOTS.EXPORT_FORMAT,
    version: CENTRAL_BOTS.EXPORT_VERSION,
    exportedAt: new Date(ctx.now()).toISOString(),
    bots: [],
    media: [],
  };
  const entries: ZipEntry[] = [];
  for (const bot of bots) {
    const all = ctx.db.all<EventRow>(
      'SELECT * FROM central_bot_events WHERE bot_id = ? ORDER BY due_at, id',
      bot.id,
    );
    const events = options.eventIds
      ? all.filter((event) => options.eventIds?.includes(event.id))
      : all;
    file.bots.push({
      id: bot.id,
      name: bot.name,
      state: bot.state,
      character: bot.character,
      home:
        bot.home_lat !== null && bot.home_lon !== null
          ? { lat: bot.home_lat / 100, lon: bot.home_lon / 100 }
          : null,
      owl: {
        mode: bot.owl_mode,
        species: bot.owl_species,
        name: bot.owl_name,
        sex: bot.owl_sex,
        motivation: bot.motivation,
        restHours: bot.rest_hours,
        playerOwls: bot.player_owls === 1,
      },
      complete: options.eventIds === undefined,
      events: events.map(exportEvent),
    });
    const used = new Set(events.flatMap((event) => mediaOf(event)));
    const media = ctx.db.all<{
      id: string;
      sha256: string;
      data: Uint8Array;
      width: number;
      height: number;
    }>(
      'SELECT id, sha256, data, width, height FROM central_bot_media WHERE bot_id = ? ORDER BY id',
      bot.id,
    );
    for (const item of media) {
      // A partial export carries only the pictures of its events; a complete one all of them.
      if (options.eventIds && !used.has(item.id)) continue;
      const name = `media/${item.id}.webp`;
      file.media.push({
        id: item.id,
        bot: bot.id,
        file: name,
        sha256: item.sha256,
        width: item.width,
        height: item.height,
      });
      entries.push({ name, data: item.data });
    }
  }
  return writeZip([
    { name: JSON_FILE, data: Buffer.from(`${JSON.stringify(file, null, 2)}\n`, 'utf8') },
    ...entries,
  ]);
}

export interface ImportPlan {
  readonly bots: {
    readonly id: string;
    readonly name: string;
    /** new: created as a draft; merge: events are added, settings stay; conflict: skipped. */
    readonly action: 'new' | 'merge' | 'conflict';
    readonly conflict?: 'name_taken' | 'name_invalid' | 'id_elsewhere';
    readonly targetId: string;
    readonly events: {
      readonly id: string;
      readonly dueAt: string;
      /** planned: will run; past: imported into the archive, never sent; skip: ID exists. */
      readonly action: 'planned' | 'past' | 'skip';
    }[];
  }[];
  readonly media: number;
}

function parseFile(zip: Uint8Array): { file: ExportFileType; files: Map<string, Buffer> } {
  let files: Map<string, Buffer>;
  try {
    files = readZip(zip, {
      maxEntries: CENTRAL_BOTS.IMPORT_MAX_FILES,
      maxTotalBytes: CENTRAL_BOTS.IMPORT_MAX_BYTES * 2,
    });
  } catch (error) {
    if (error instanceof ZipError) throw new HttpError(400, 'import_invalid');
    throw error;
  }
  const json = files.get(JSON_FILE);
  if (!json) throw new HttpError(400, 'import_invalid');
  let data: unknown;
  try {
    data = JSON.parse(json.toString('utf8'));
  } catch {
    throw new HttpError(400, 'import_invalid');
  }
  const parsed = v.safeParse(ExportFile, data);
  if (!parsed.success) throw new HttpError(400, 'import_invalid');
  for (const media of parsed.output.media) {
    const content = files.get(media.file);
    if (!content || crypto.createHash('sha256').update(content).digest('hex') !== media.sha256)
      throw new HttpError(400, 'import_invalid');
  }
  return { file: parsed.output, files };
}

/** What an import would do – shown before importing (SPEC Anhang S). */
export function planImport(ctx: Context, zip: Uint8Array, targetBotId?: string): ImportPlan {
  return makePlan(ctx, parseFile(zip).file, targetBotId);
}

function makePlan(ctx: Context, file: ExportFileType, targetBotId?: string): ImportPlan {
  const now = ctx.now();
  const target = targetBotId ? centralBot(ctx, targetBotId) : undefined;
  if (targetBotId && !target) throw new HttpError(404, 'not_found');
  const seenEvents = new Set<string>();
  const bots = file.bots.map((bot) => {
    let action: ImportPlan['bots'][number]['action'];
    let conflict: ImportPlan['bots'][number]['conflict'];
    let targetId = bot.id;
    if (target) {
      action = 'merge';
      targetId = target.id;
    } else if (centralBot(ctx, bot.id)) {
      action = 'merge';
    } else {
      try {
        checkNewBotName(ctx, bot.name);
        action = 'new';
      } catch (error) {
        action = 'conflict';
        conflict =
          error instanceof HttpError && error.code === 'name_unavailable'
            ? 'name_taken'
            : 'name_invalid';
      }
      if (
        action === 'new' &&
        file.bots.some(
          (other) => other !== bot && normalizeName(other.name) === normalizeName(bot.name),
        )
      ) {
        action = 'conflict';
        conflict = 'name_taken';
      }
    }
    const events = bot.events.map((event) => {
      const exists =
        seenEvents.has(event.id) ||
        ctx.db.get('SELECT 1 FROM central_bot_events WHERE id = ?', event.id) !== undefined;
      seenEvents.add(event.id);
      const past = event.status !== 'planned' || Date.parse(event.dueAt) <= now;
      return {
        id: event.id,
        dueAt: event.dueAt,
        action:
          exists || action === 'conflict'
            ? ('skip' as const)
            : past
              ? ('past' as const)
              : ('planned' as const),
      };
    });
    return {
      id: bot.id,
      name: bot.name,
      action,
      ...(conflict ? { conflict } : {}),
      targetId,
      events,
    };
  });
  return { bots, media: file.media.length };
}

/** Imports as planned (one transaction). New bots always start as drafts. */
export function applyImport(ctx: Context, zip: Uint8Array, targetBotId?: string): ImportPlan {
  const { file, files } = parseFile(zip);
  const now = ctx.now();
  return ctx.db.transaction(() => {
    const plan = makePlan(ctx, file, targetBotId);
    for (const [index, entry] of plan.bots.entries()) {
      const bot = file.bots[index];
      if (!bot || entry.action === 'conflict') continue;
      if (entry.action === 'new') {
        const name = checkNewBotName(ctx, bot.name);
        ctx.db.run(
          `INSERT INTO central_bots (id, name, name_key, state, character, home_lat, home_lon, owl_mode,
                                     owl_species, owl_name, owl_sex, motivation, rest_hours, player_owls,
                                     created_at, updated_at)
           VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          bot.id,
          name.display,
          name.key,
          bot.character,
          bot.home ? Math.round(bot.home.lat * 100) : null,
          bot.home ? Math.round(bot.home.lon * 100) : null,
          bot.owl.mode,
          bot.owl.species,
          bot.owl.name,
          bot.owl.sex,
          bot.owl.motivation,
          bot.owl.restHours,
          bot.owl.playerOwls ? 1 : 0,
          now,
          now,
        );
      }
      // Pictures: once per bot (same content → same picture); IDs of the file are mapped.
      const mapped = new Map<string, string>();
      for (const media of file.media.filter((item) => item.bot === bot.id)) {
        const data = files.get(media.file);
        if (!data) continue;
        const existing = ctx.db.get<{ id: string }>(
          'SELECT id FROM central_bot_media WHERE bot_id = ? AND sha256 = ?',
          entry.targetId,
          media.sha256,
        );
        let id = existing?.id;
        if (!id) {
          id = ctx.db.get('SELECT 1 FROM central_bot_media WHERE id = ?', media.id)
            ? randomId()
            : media.id;
          ctx.db.run(
            `INSERT INTO central_bot_media (id, bot_id, sha256, data, width, height, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            id,
            entry.targetId,
            media.sha256,
            data,
            media.width,
            media.height,
            now,
          );
        }
        mapped.set(media.id, id);
      }
      for (const [eventIndex, planned] of entry.events.entries()) {
        const event = bot.events[eventIndex];
        if (!event || planned.action === 'skip') continue;
        const letter = event.letter
          ? { ...event.letter, media: event.letter.media.map((id) => mapped.get(id) ?? id) }
          : null;
        const id = insertEvent(
          ctx,
          entry.targetId,
          {
            dueAt: Date.parse(event.dueAt),
            move: event.move,
            letter,
            gift: event.gift,
            context: event.context,
          },
          now,
          // Past events go to the archive and are never sent again.
          {
            id: event.id,
            state:
              planned.action === 'planned' ? 'planned' : event.archive ? 'archived' : 'skipped',
          },
        );
        if (planned.action === 'past' && event.archive) {
          ctx.db.run(
            `UPDATE central_bot_events SET started_at = ?, archived_at = ?, recipients = ?, sent = ?,
                    delivered = ?, read = ?, replies = ? WHERE id = ?`,
            event.archive.startedAt ? Date.parse(event.archive.startedAt) : null,
            event.archive.archivedAt ? Date.parse(event.archive.archivedAt) : now,
            event.archive.recipients,
            event.archive.sent,
            event.archive.delivered,
            event.archive.read,
            event.archive.replies,
            id,
          );
        } else if (planned.action === 'past') {
          ctx.db.run('UPDATE central_bot_events SET archived_at = ? WHERE id = ?', now, id);
        }
      }
    }
    return plan;
  });
}
