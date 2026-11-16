// Deterministic dental phantoms with seeded Gaussian noise, so compression ratios look like real
// scans rather than flat synthetic images. CBCT: a head ellipse with a skull shell and a dental
// arch of dense teeth (Hounsfield-like signed values). Panoramic: the unrolled arch.

/** xorshift32: fast, seedable, deterministic across platforms. */
function xorshift(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
}

/** 65,536 standard normal samples (Box-Muller), indexed by the fast generator. */
const tables = new Map<number, Float32Array>();
function normalTable(seed: number): Float32Array {
  const cached = tables.get(seed);
  if (cached) return cached;
  const next = xorshift(seed);
  const table = new Float32Array(65_536);
  for (let i = 0; i < table.length; i += 2) {
    const u = (next() + 1) / 4_294_967_297;
    const v = (next() + 1) / 4_294_967_297;
    const r = Math.sqrt(-2 * Math.log(u));
    table[i] = r * Math.cos(2 * Math.PI * v);
    table[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
  tables.set(seed, table);
  return table;
}

const AIR = -1000;
const SOFT = 40;
const BONE = 1200;
const ENAMEL = 2500;
const TEETH = 14;

/** One axial slice (`z` of `frames`) as signed 16-bit voxels. */
export function cbctSlice(
  rows: number,
  columns: number,
  z: number,
  frames: number,
  seed: number,
): Int16Array {
  const out = new Int16Array(rows * columns);
  const noise = normalTable(seed);
  const next = xorshift((seed * 2_654_435_761 + z * 40_503) >>> 0);
  const zn = (2 * z) / Math.max(1, frames - 1) - 1;
  // The head narrows towards the top and bottom of the volume.
  const scale = Math.sqrt(Math.max(0, 1 - zn * zn * 0.6));
  const inTeethBand = zn > -0.25 && zn < 0.2;
  const teeth: [number, number][] = [];
  for (let t = 0; t < TEETH; t += 1) {
    const a = Math.PI * (0.1 + (0.8 * t) / (TEETH - 1));
    teeth.push([0.45 * Math.cos(a), 0.15 - 0.45 * Math.sin(a)]);
  }
  for (let r = 0; r < rows; r += 1) {
    const y = (2 * r) / rows - 1;
    for (let c = 0; c < columns; c += 1) {
      const x = (2 * c) / columns - 1;
      const e = (x / (0.85 * scale + 1e-6)) ** 2 + (y / (0.95 * scale + 1e-6)) ** 2;
      let value = AIR;
      if (e <= 1) {
        value = e > 0.82 ? BONE : SOFT;
        if (inTeethBand) {
          for (const [tx, ty] of teeth) {
            if ((x - tx) ** 2 + (y - ty) ** 2 < 0.0025) {
              value = ENAMEL;
              break;
            }
          }
        }
      }
      const sigma = value === AIR ? 8 : 25;
      out[r * columns + c] = Math.round(value + sigma * (noise[next() & 0xffff] ?? 0));
    }
  }
  return out;
}

/** The panoramic: an unrolled arch with bright teeth, as unsigned 16-bit pixels. */
export function panoImage(rows: number, columns: number, seed: number): Uint16Array {
  const out = new Uint16Array(rows * columns);
  const noise = normalTable(seed);
  const next = xorshift(seed ^ 0x5a5a5a5a);
  for (let r = 0; r < rows; r += 1) {
    const y = r / rows;
    for (let c = 0; c < columns; c += 1) {
      const x = c / columns;
      const archCentre = 0.5 + 0.12 * Math.cos(Math.PI * (2 * x - 1));
      const inArch = Math.abs(y - archCentre) < 0.18;
      const tooth =
        inArch && Math.abs(((x * 16) % 1) - 0.5) < 0.32 && Math.abs(y - archCentre) < 0.14;
      const base = tooth ? 30_000 : inArch ? 18_000 : 6_000;
      out[r * columns + c] = Math.max(
        0,
        Math.min(65_535, Math.round(base + 600 * (noise[next() & 0xffff] ?? 0))),
      );
    }
  }
  return out;
}
