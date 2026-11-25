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
  /** An enum that picks data: the prop gets `data[option]` (rows, items, a value or none). */
  data?: Record<string, unknown>;
  /** The component reads this prop only when it mounts: a change mounts it afresh. */
  remount?: boolean;
}

/** A ready set of props, one press away in the playground's panel. */
export interface Scenario {
  label: string;
  set: Record<string, string | number | boolean>;
}

export interface Playground {
  base: Props;
  controls: Control[];
  /**
   * Handlers the copy gets, as JS expressions of the board's logic class, to behave as in the
   * app (a press that waits for its request, so the busy state shows).
   */
  handlers?: Record<string, string>;
  scenarios?: Scenario[];
  /** The copy mounts afresh on every change (it shows its content once, when it mounts). */
  remountAll?: boolean;
}

/** A handler that waits `ms` like a request, so the component shows its busy state. */
export const WAIT = (ms = 1500) => `() => new Promise((done) => setTimeout(done, ${String(ms)}))`;

/** Keys the board itself uses, or React gives a meaning to: never a playground tweak's name. */
const RESERVED = new Set([
  'theme',
  'density',
  'direction',
  'view',
  'children',
  'key',
  'ref',
  'instanceKey',
]);

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
/** A choice of data for `prop`: each option is a key of `data`, the first the default. */
export const choose = (
  prop: string,
  data: Record<string, unknown>,
  labels: Record<string, string> = {},
): Control => {
  const keys = Object.keys(data);
  return {
    prop,
    editor: 'enum',
    default: keys[0] ?? '',
    options: keys.map((k) => ({ value: k, label: labels[k] ?? k })),
    data,
  };
};
/** A control whose prop the component reads only when it mounts. */
export const once = (c: Control): Control => ({ ...c, remount: true });

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
