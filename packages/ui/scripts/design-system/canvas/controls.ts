// The tweaks of a playground (playground.ts): what a control is, its name on the board, and the
// helpers the playgrounds are written with.
import type { Props } from './types.ts';

export type Option = string | number | { value: string | number; label: string };

/** One tweak: the prop it sets, its editor, its first value; '' in a text or enum means none. */
export interface Control {
  prop: string;
  editor: 'text' | 'boolean' | 'enum' | 'int';
  default: string | number | boolean;
  options?: Option[];
}

export interface Playground {
  base: Props;
  controls: Control[];
}

/** Keys the board itself uses, or React gives a meaning to: never a playground tweak's name. */
const RESERVED = new Set(['theme', 'density', 'direction', 'view', 'children', 'key', 'ref']);

/** The tweak's name: the prop's, but `children` (React's) is shown as `label`. */
export function tweakKey(c: Control, all: Control[]): string {
  const key = c.prop === 'children' ? 'label' : c.prop;
  if ((RESERVED.has(key) && key !== 'label') || all.some((o) => o !== c && o.prop === key)) {
    throw new Error(`playground tweak ${c.prop} clashes as ${key}`);
  }
  return key;
}

export const text = (prop: string, value: string): Control => ({
  prop,
  editor: 'text',
  default: value,
});
export const flag = (prop: string, value = false): Control => ({
  prop,
  editor: 'boolean',
  default: value,
});
export const pick = (prop: string, options: Option[], value?: string | number): Control => {
  const first = options[0];
  const fallback = typeof first === 'object' ? first.value : (first ?? '');
  return { prop, editor: 'enum', default: value ?? fallback, options };
};
export const int = (prop: string, value: number): Control => ({
  prop,
  editor: 'int',
  default: value,
});

export const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'];
export const NONE = { value: '', label: '—' };
export const SOME_ICONS = [
  NONE,
  'calendar-plus',
  'printer',
  'check',
  'pencil',
  'trash',
  'phone',
  'magnifying-glass',
  'tooth',
];

/** Label, hint and error of a field; error '' is none. */
export const field = (label: string, hint = ''): Control[] => [
  text('label', label),
  text('hint', hint),
  text('error', ''),
];
