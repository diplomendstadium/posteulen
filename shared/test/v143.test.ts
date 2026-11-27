/**
 * v1.4.3: QR code of the second factor, its texts and constants (SPEC 5.11), and the texts of
 * „Server der Instanz“ (SPEC 13 item 13).
 */
import { describe, expect, it } from 'vitest';
import { RESCUE, TWO_FACTOR } from '../src/constants.ts';
import { qrPath } from '../src/qr.ts';
import { de } from '../src/texts/de.ts';
import { en } from '../src/texts/en.ts';

describe('QR code for authenticator apps (SPEC 5.11)', () => {
  const uri =
    'otpauth://totp/PostEulen%3AAnna?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=PostEulen&algorithm=SHA1&digits=6&period=30';

  it('draws one path of dark modules with a quiet zone of four modules', () => {
    const qr = qrPath(uri);
    // A small version (here 7 or 8 with level M), plus 2 × 4 modules of quiet zone.
    expect(qr.size).toBeGreaterThanOrEqual(41 + 8);
    expect(qr.size).toBeLessThanOrEqual(49 + 8);
    expect((qr.size - 8 - 17) % 4).toBe(0);
    expect(qr.path).toMatch(/^(M\d+ \d+h1v1h-1z)+$/);
    // The finder pattern in the corner starts right after the quiet zone.
    expect(qr.path.startsWith('M4 4h1v1h-1z')).toBe(true);
    expect(qr.path).not.toContain('M0 0h');
    // The same text always gives the same picture.
    expect(qrPath(uri)).toEqual(qr);
    expect(qrPath(`${uri}x`).path).not.toBe(qr.path);
  });
});

describe('constants of v1.4.3', () => {
  it('second factor and rescue centre', () => {
    expect(TWO_FACTOR).toMatchObject({
      DIGITS: 6,
      PERIOD_SECONDS: 30,
      WINDOW_STEPS: 1,
      BACKUP_CODES: 10,
      TICKET_TRIES: 5,
    });
    expect(RESCUE.WILD_SLOTS).toBe(2);
  });
});

describe('texts of v1.4.3 in both languages', () => {
  it('the second factor warns that without app and backup code the account stays locked', () => {
    expect(de.twoFactor.warning).toMatch(/für immer verschlossen/);
    expect(en.twoFactor.warning).toMatch(/locked for good/);
    expect(de.twoFactor.warningPanel).toContain('{command}');
    expect(en.twoFactor.warningPanel).toContain('{command}');
    expect(Object.keys(en.twoFactor).sort()).toEqual(Object.keys(de.twoFactor).sort());
  });

  it('„Server der Instanz“ and the note on Tor-only instances', () => {
    expect(de.admin.serverTitle).toBe('Server der Instanz');
    expect(en.admin.serverTitle).toBe('Server of the instance');
    expect(de.admin.blockTorOnly).toContain('nur bei Clearnet-Installationen aktiv');
    expect(en.admin.blockTorOnly).toContain('only active on clearnet installations');
  });
});
