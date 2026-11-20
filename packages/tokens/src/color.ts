// DTCG 2025.10 colour values in sRGB: `{ colorSpace, components, alpha?, hex }`. The hex is
// what people read and review; the components are what the format requires. Both must agree.

export interface SrgbColor {
  colorSpace: 'srgb';
  components: [number, number, number];
  alpha?: number;
  hex: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** The three 0–255 channels of a six-digit hex colour. */
export function channels(hex: string): [number, number, number] {
  if (!HEX.test(hex)) throw new Error(`"${hex}" is not a six-digit hex colour (#rrggbb)`);
  const at = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16);
  return [at(1), at(3), at(5)];
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** The DTCG value of a hex colour, with an optional alpha between 0 and 1. */
export function srgb(hex: string, alpha?: number): SrgbColor {
  const [r, g, b] = channels(hex);
  const color: SrgbColor = {
    colorSpace: 'srgb',
    components: [round4(r / 255), round4(g / 255), round4(b / 255)],
    hex: hex.toLowerCase(),
  };
  if (alpha !== undefined) color.alpha = alpha;
  return color;
}

const isChannel = (n: unknown): n is number => typeof n === 'number' && n >= 0 && n <= 1;

/** What is wrong with a literal colour value, or null. */
export function colorProblem(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return 'a colour is an object (DTCG 2025.10)';
  const { colorSpace, components, alpha, hex } = value as Record<string, unknown>;
  if (colorSpace !== 'srgb') return 'colorSpace must be "srgb"';
  if (!Array.isArray(components) || components.length !== 3 || !components.every(isChannel)) {
    return 'components must be three numbers between 0 and 1';
  }
  if (alpha !== undefined && !isChannel(alpha)) return 'alpha must be between 0 and 1';
  if (typeof hex !== 'string' || !HEX.test(hex)) return 'hex must be a six-digit hex colour';
  const fromHex = channels(hex);
  const agrees = components.every((c, i) => Math.round(c * 255) === fromHex[i]);
  return agrees ? null : `hex ${hex} does not match its components`;
}

export function isSrgbColor(value: unknown): value is SrgbColor {
  return colorProblem(value) === null;
}
