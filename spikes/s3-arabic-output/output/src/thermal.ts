// Thermal raster (criterion 6): PNG → 1-bit bitmap (threshold or Floyd–Steinberg) → ESC/POS
// `GS v 0` raster bands. One stream per receipt, bands of at most 255 rows, no cut inside.
import { PNG } from 'pngjs';

export interface Bitmap {
  width: number;
  height: number;
  /** One byte per pixel: 1 = black (printed dot), 0 = white. */
  data: Uint8Array;
}

export const DITHER_MODES = ['threshold', 'dither'] as const;
export type DitherMode = (typeof DITHER_MODES)[number];

/** Rows per `GS v 0` band: yL/yH could hold more, but many printers buffer ≤ 255 rows. */
export const MAX_BAND_ROWS = 255;
const THRESHOLD = 128;

/** Luminance of each pixel (alpha over white), 0 = black … 255 = white. */
function luminance(png: PNG): Float32Array {
  const out = new Float32Array(png.width * png.height);
  for (let i = 0; i < out.length; i += 1) {
    const r = png.data[i * 4] ?? 255;
    const g = png.data[i * 4 + 1] ?? 255;
    const b = png.data[i * 4 + 2] ?? 255;
    const a = (png.data[i * 4 + 3] ?? 255) / 255;
    out[i] = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
  }
  return out;
}

export function pngToBitmap(bytes: Uint8Array, mode: DitherMode): Bitmap {
  const png = PNG.sync.read(Buffer.from(bytes));
  const { width, height } = png;
  const lum = luminance(png);
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const old = lum[i] ?? 255;
      const black = old < THRESHOLD;
      data[i] = black ? 1 : 0;
      if (mode === 'dither') {
        const err = old - (black ? 0 : 255);
        const spread = (dx: number, dy: number, w: number) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny < height) {
            const j = ny * width + nx;
            lum[j] = (lum[j] ?? 0) + (err * w) / 16;
          }
        };
        spread(1, 0, 7);
        spread(-1, 1, 3);
        spread(0, 1, 5);
        spread(1, 1, 1);
      }
    }
  }
  return { width, height, data };
}

/** ESC @, then `GS v 0 m xL xH yL yH d…` per band (MSB-first rows), then a 3-line feed. */
export function encodeRaster(bitmap: Bitmap): Uint8Array {
  if (bitmap.width % 8 !== 0) throw new Error('raster width must be a multiple of 8 dots');
  const bytesPerRow = bitmap.width / 8;
  const parts: number[] = [0x1b, 0x40];
  for (let top = 0; top < bitmap.height; top += MAX_BAND_ROWS) {
    const rows = Math.min(MAX_BAND_ROWS, bitmap.height - top);
    parts.push(
      0x1d,
      0x76,
      0x30,
      0x00,
      bytesPerRow & 0xff,
      bytesPerRow >> 8,
      rows & 0xff,
      rows >> 8,
    );
    for (let y = top; y < top + rows; y += 1) {
      for (let bx = 0; bx < bytesPerRow; bx += 1) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit += 1) {
          byte = (byte << 1) | (bitmap.data[y * bitmap.width + bx * 8 + bit] ?? 0);
        }
        parts.push(byte);
      }
    }
  }
  parts.push(0x1b, 0x64, 3);
  return Uint8Array.from(parts);
}

/** A 1-bit bitmap as a black-and-white PNG (for goldens and the owner's eye check). */
export function bitmapToPng(bitmap: Bitmap): Uint8Array {
  const png = new PNG({ width: bitmap.width, height: bitmap.height });
  for (let i = 0; i < bitmap.data.length; i += 1) {
    const v = bitmap.data[i] === 1 ? 0 : 255;
    png.data[i * 4] = v;
    png.data[i * 4 + 1] = v;
    png.data[i * 4 + 2] = v;
    png.data[i * 4 + 3] = 255;
  }
  return new Uint8Array(PNG.sync.write(png));
}
