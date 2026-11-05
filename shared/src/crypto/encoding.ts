/**
 * Canonical, unambiguous binary encoding for signed data and associated data (ARCHITECTURE
 * 2.3, D-14): context string, then every field as u32be(length) ‖ bytes. Strings are NFC UTF-8,
 * numbers are u64be. This is a data format, not a cryptographic primitive.
 */
const encoder = new TextEncoder();

export type Field = string | number | Uint8Array;

function fieldBytes(field: Field): Uint8Array {
  if (typeof field === 'string') return encoder.encode(field.normalize('NFC'));
  if (typeof field === 'number') {
    if (!Number.isSafeInteger(field) || field < 0) throw new RangeError('invalid integer field');
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, BigInt(field));
    return bytes;
  }
  return field;
}

export function encodeFields(context: string, ...fields: Field[]): Uint8Array {
  const parts = [context, ...fields].map(fieldBytes);
  const total = parts.reduce((sum, part) => sum + 4 + part.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let offset = 0;
  for (const part of parts) {
    view.setUint32(offset, part.length);
    out.set(part, offset + 4);
    offset += 4 + part.length;
  }
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1)
    throw new TypeError('invalid base64url');
  const padded =
    text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
