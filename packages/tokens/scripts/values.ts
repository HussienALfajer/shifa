// How one resolved DTCG value is written in CSS and in Dart. Registered as Style Dictionary
// value transforms by build.ts. The source is validated first (src/schema.ts), so a value of the
// wrong shape here is a bug, not bad input.
import { channels, type SrgbColor } from '../src/index.ts';

interface Unit {
  value: number;
  unit: string;
}

interface ShadowLayer {
  color: SrgbColor;
  offsetX: Unit;
  offsetY: Unit;
  blur: Unit;
  spread: Unit;
}

const REM_PX = 16;

const shadowLayers = (value: unknown) => (Array.isArray(value) ? value : [value]) as ShadowLayer[];

function cssColor(color: SrgbColor): string {
  if (color.alpha === undefined || color.alpha === 1) return color.hex.toLowerCase();
  return `rgb(${channels(color.hex).join(' ')} / ${String(color.alpha)})`;
}

const cssUnit = ({ value, unit }: Unit) => String(value) + unit;

/** Generic families (`serif`, `system-ui`) stay bare; names are quoted. */
const cssFamily = (name: string) => (/^[a-z-]+$/.test(name) ? name : `'${name}'`);

export function cssValue(type: string, value: unknown): string {
  switch (type) {
    case 'color':
      return cssColor(value as SrgbColor);
    case 'dimension':
    case 'duration':
      return cssUnit(value as Unit);
    case 'number':
    case 'fontWeight':
      return String(value);
    case 'fontFamily':
      return (value as string[]).map(cssFamily).join(', ');
    case 'cubicBezier':
      return `cubic-bezier(${(value as number[]).join(', ')})`;
    case 'shadow':
      return shadowLayers(value)
        .map((s) => [...[s.offsetX, s.offsetY, s.blur, s.spread].map(cssUnit), cssColor(s.color)])
        .map((parts) => parts.join(' '))
        .join(', ');
    default:
      throw new Error(`no CSS form for token type ${type}`);
  }
}

/** The Dart type of each token type. Dimensions are logical pixels. */
export const DART_TYPES: Record<string, string> = {
  color: 'Color',
  dimension: 'double',
  duration: 'Duration',
  number: 'double',
  fontWeight: 'int',
  fontFamily: 'List<String>',
  cubicBezier: 'List<double>',
  shadow: 'List<ShifaShadowLayer>',
};

function dartColor(color: SrgbColor): string {
  const alpha = Math.round((color.alpha ?? 1) * 255);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `Color(0x${[alpha, ...channels(color.hex)].map(hex).join('').toUpperCase()})`;
}

const dartPixels = ({ value, unit }: Unit) => String(unit === 'rem' ? value * REM_PX : value);

const dartString = (text: string) => `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

export function dartValue(type: string, value: unknown): string {
  switch (type) {
    case 'color':
      return dartColor(value as SrgbColor);
    case 'dimension':
      return dartPixels(value as Unit);
    case 'duration': {
      const { value: amount, unit } = value as Unit;
      const milliseconds = Math.round(unit === 's' ? amount * 1000 : amount);
      return `Duration(milliseconds: ${String(milliseconds)})`;
    }
    case 'number':
    case 'fontWeight':
      return String(value);
    case 'fontFamily':
      return `[${(value as string[]).map(dartString).join(', ')}]`;
    case 'cubicBezier':
      return `[${(value as number[]).join(', ')}]`;
    case 'shadow': {
      const layers = shadowLayers(value).map(
        (s) =>
          `(color: ${dartColor(s.color)}, dx: ${dartPixels(s.offsetX)}, dy: ${dartPixels(s.offsetY)}, blur: ${dartPixels(s.blur)}, spread: ${dartPixels(s.spread)})`,
      );
      return `[${layers.join(', ')}]`;
    }
    default:
      throw new Error(`no Dart form for token type ${type}`);
  }
}
