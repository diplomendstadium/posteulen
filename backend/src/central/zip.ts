/**
 * v0.8: a small ZIP writer and reader for bot exports (SPEC Anhang S) – no extra dependency:
 * Deflate and CRC-32 come from node:zlib. Reading is strict: only "stored" and "deflate", no
 * encryption, no ZIP64, no absolute paths or "..", limited number and size of entries.
 */
import zlib from 'node:zlib';

export interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
/** Fixed time stamp 1980-01-01 00:00 – exports are reproducible. */
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

export function writeZip(entries: readonly ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const raw = Buffer.from(entry.data);
    const deflated = zlib.deflateRawSync(raw, { level: 9 });
    const useDeflate = deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const crc = zlib.crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

export class ZipError extends Error {}

export function readZip(
  input: Uint8Array,
  limits: { maxEntries: number; maxTotalBytes: number },
): Map<string, Buffer> {
  const zip = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  let endAt = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === END) {
      endAt = i;
      break;
    }
  }
  if (endAt < 0) throw new ZipError('not a zip file');
  const count = zip.readUInt16LE(endAt + 10);
  const centralOffset = zip.readUInt32LE(endAt + 16);
  if (count > limits.maxEntries) throw new ZipError('too many files');
  const files = new Map<string, Buffer>();
  let total = 0;
  let at = centralOffset;
  for (let n = 0; n < count; n++) {
    if (at + 46 > zip.length || zip.readUInt32LE(at) !== CENTRAL) throw new ZipError('broken');
    const flags = zip.readUInt16LE(at + 8);
    const method = zip.readUInt16LE(at + 10);
    const crc = zip.readUInt32LE(at + 16);
    const compressed = zip.readUInt32LE(at + 20);
    const size = zip.readUInt32LE(at + 24);
    const nameLength = zip.readUInt16LE(at + 28);
    const extra = zip.readUInt16LE(at + 30);
    const comment = zip.readUInt16LE(at + 32);
    const localAt = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    at += 46 + nameLength + extra + comment;
    if (flags & 0x1) throw new ZipError('encrypted');
    if (name.endsWith('/')) continue;
    if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..'))
      throw new ZipError('bad file name');
    total += size;
    if (total > limits.maxTotalBytes) throw new ZipError('too large');
    if (localAt + 30 > zip.length || zip.readUInt32LE(localAt) !== LOCAL)
      throw new ZipError('broken');
    const start = localAt + 30 + zip.readUInt16LE(localAt + 26) + zip.readUInt16LE(localAt + 28);
    const body = zip.subarray(start, start + compressed);
    if (body.length !== compressed) throw new ZipError('broken');
    let data: Buffer;
    if (method === 0) data = Buffer.from(body);
    else if (method === 8) {
      try {
        data = zlib.inflateRawSync(body, { maxOutputLength: Math.max(1, size) });
      } catch {
        throw new ZipError('broken');
      }
    } else throw new ZipError('unsupported compression');
    if (data.length !== size || zlib.crc32(data) !== crc) throw new ZipError('checksum');
    files.set(name, data);
  }
  return files;
}
