// Test-side decoder for the ESC/POS raster stream: parses every `GS v 0` band back into one
// 1-bit image and records what else the stream holds, so the encoder cannot hide a cut.
import type { Bitmap } from '../src/thermal.ts';

export interface Decoded {
  bitmap: Bitmap;
  bandHeights: number[];
  /** Offsets of any `GS V` (cut) command. */
  cuts: number[];
  /** Bytes that are not part of a raster band or the init/feed commands. */
  stray: number;
}

export function decodeRaster(bytes: Uint8Array): Decoded {
  const rows: Uint8Array[] = [];
  const bandHeights: number[] = [];
  const cuts: number[] = [];
  let width = 0;
  let stray = 0;
  let i = 0;
  const at = (k: number) => bytes[k] ?? 0;
  while (i < bytes.length) {
    if (at(i) === 0x1b && at(i + 1) === 0x40) {
      i += 2; // ESC @ (init)
    } else if (at(i) === 0x1b && at(i + 1) === 0x64) {
      i += 3; // ESC d n (feed n lines)
    } else if (at(i) === 0x1d && at(i + 1) === 0x56) {
      cuts.push(i);
      i += at(i + 2) >= 65 ? 4 : 3;
    } else if (at(i) === 0x1d && at(i + 1) === 0x76 && at(i + 2) === 0x30) {
      const bytesPerRow = at(i + 4) + at(i + 5) * 256;
      const height = at(i + 6) + at(i + 7) * 256;
      width = bytesPerRow * 8;
      bandHeights.push(height);
      let p = i + 8;
      for (let y = 0; y < height; y += 1) {
        const row = new Uint8Array(width);
        for (let x = 0; x < width; x += 1) {
          row[x] = (at(p + (x >> 3)) >> (7 - (x & 7))) & 1;
        }
        rows.push(row);
        p += bytesPerRow;
      }
      i = p;
    } else {
      stray += 1;
      i += 1;
    }
  }
  const data = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => {
    data.set(row, y * width);
  });
  return { bitmap: { width, height: rows.length, data }, bandHeights, cuts, stray };
}
