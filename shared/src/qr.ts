/**
 * v1.4.3: QR code of an `otpauth://` address for authenticator apps (SPEC 5.11), drawn by the
 * browsers as one SVG path – no image from elsewhere, no inline HTML (CSP, Trusted Types).
 * The modules come from `uqr` (MIT).
 */
import { encode } from 'uqr';

export interface QrPath {
  /** Width and height in modules, including the quiet zone. */
  readonly size: number;
  /** One rectangle per dark module. */
  readonly path: string;
}

export function qrPath(text: string): QrPath {
  const { data, size } = encode(text, { ecc: 'M', border: 4 });
  let path = '';
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return { size, path };
}
