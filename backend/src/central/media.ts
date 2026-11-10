/**
 * v0.8: pictures of bot letters (SPEC 10.11). Uploads of JPEG, PNG or WebP up to 5 MB (v0.8.3; before 2 MB) are decoded
 * on the server, turned upright, scaled to at most 1600 px, re-encoded as WebP and stored without
 * any metadata (EXIF, GPS, colour profiles). Every picture is stored once per bot (SHA-256 of the
 * result) and only referenced by events and letters; players never see file names.
 */
import crypto from 'node:crypto';
import sharp from 'sharp';
import { CENTRAL_BOTS } from '@posteulen/shared/constants.ts';
import type { Context } from '../context.ts';
import { HttpError } from '../http/errors.ts';
import { randomId } from '../security/ids.ts';

const ALLOWED = new Set(['jpeg', 'png', 'webp']);

export interface NormalizedImage {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

export async function normalizeImage(input: Uint8Array): Promise<NormalizedImage> {
  if (input.length === 0 || input.length > CENTRAL_BOTS.MEDIA_MAX_UPLOAD_BYTES)
    throw new HttpError(400, 'media_too_large');
  const options = {
    limitInputPixels: CENTRAL_BOTS.MEDIA_MAX_INPUT_PIXELS,
    failOn: 'error' as const,
  };
  let format: string | undefined;
  try {
    format = (await sharp(input, options).metadata()).format;
  } catch {
    throw new HttpError(400, 'media_invalid');
  }
  if (!format || !ALLOWED.has(format)) throw new HttpError(400, 'media_invalid');
  try {
    // Without withMetadata() sharp writes no EXIF, XMP or ICC data.
    const { data, info } = await sharp(input, options)
      .rotate()
      .resize({
        width: CENTRAL_BOTS.MEDIA_MAX_EDGE_PX,
        height: CENTRAL_BOTS.MEDIA_MAX_EDGE_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return {
      data,
      width: info.width,
      height: info.height,
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
    };
  } catch {
    throw new HttpError(400, 'media_invalid');
  }
}

/** Stores a normalised picture for a bot – once (same picture → same ID). */
export function storeMedia(
  ctx: Context,
  botId: string,
  image: NormalizedImage,
  now: number,
  id: string = randomId(),
): string {
  const existing = ctx.db.get<{ id: string }>(
    'SELECT id FROM central_bot_media WHERE bot_id = ? AND sha256 = ?',
    botId,
    image.sha256,
  );
  if (existing) return existing.id;
  ctx.db.run(
    `INSERT INTO central_bot_media (id, bot_id, sha256, data, width, height, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    botId,
    image.sha256,
    image.data,
    image.width,
    image.height,
    now,
  );
  return id;
}

/**
 * Pictures nobody uses any more (no event, no letter) go – uploads that were never saved after a
 * day, others at once (SPEC 10.11). Returns how many were removed.
 */
export function pruneMedia(ctx: Context, now: number, botId?: string): number {
  return ctx.db.run(
    `DELETE FROM central_bot_media
      WHERE (? IS NULL OR bot_id = ?) AND created_at < ?
        AND NOT EXISTS (SELECT 1 FROM central_bot_events e
                         WHERE e.bot_id = central_bot_media.bot_id
                           AND instr(e.media, '"' || central_bot_media.id || '"') > 0)
        AND NOT EXISTS (SELECT 1 FROM letters l
                         WHERE l.sender_id = central_bot_media.bot_id AND l.media IS NOT NULL
                           AND instr(l.media, '"' || central_bot_media.id || '"') > 0)`,
    botId ?? null,
    botId ?? null,
    now - 24 * 60 * 60 * 1000,
  ).changes;
}
