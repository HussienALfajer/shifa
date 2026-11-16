// Clears the real-looking dates of the public CBCT case (owner decision, 2026-11-16): the
// case carries no name, ID, birth date or institution, but its study, series, acquisition and
// content dates are real. Each DA value is overwritten in place with the placeholder 19000101
// (same length, so nothing else in the file moves or is re-encoded); DT values get the same
// date and zeros. Explicit VR Little Endian only, and only in the header before Pixel Data.

/** (0008,xxxx) date and date-time elements cleared. */
const DATE_ELEMENTS = [0x0020, 0x0021, 0x0022, 0x0023, 0x002a] as const;
const PLACEHOLDER = '19000101';
const PIXEL_DATA = Buffer.from([0xe0, 0x7f, 0x10, 0x00]);

export function clearDates(source: Uint8Array): Buffer {
  const bytes = Buffer.from(source);
  const pixelAt = bytes.indexOf(PIXEL_DATA);
  const headerEnd = pixelAt === -1 ? bytes.length : pixelAt;
  for (const element of DATE_ELEMENTS) {
    for (const vr of ['DA', 'DT']) {
      const tag = Buffer.from([
        0x08,
        0x00,
        element & 0xff,
        element >> 8,
        vr.charCodeAt(0),
        vr.charCodeAt(1),
      ]);
      const at = bytes.indexOf(tag);
      if (at === -1 || at >= headerEnd) continue;
      const length = bytes.readUInt16LE(at + 6);
      const start = at + 8;
      if (vr === 'DA' && length !== 0 && length !== 8 && length !== 10) {
        throw new Error('unexpected date length');
      }
      for (let i = 0; i < length; i += 1) {
        const original = bytes[start + i];
        // Keep padding (space) and separators; digits become the placeholder date, then zeros.
        if (original !== undefined && original >= 0x30 && original <= 0x39) {
          bytes[start + i] = (i < PLACEHOLDER.length ? PLACEHOLDER : '').charCodeAt(i) || 0x30;
        }
      }
    }
  }
  return bytes;
}
