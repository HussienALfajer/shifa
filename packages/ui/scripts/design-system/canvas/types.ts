// What a sheet of the "Shifa Components" canvas shows (ADR-0048). Props are the bundle's
// (`index.d.ts`); data is synthetic, taken from the system's own previews where they have it.

export type Density = 'comfortable' | 'compact';
export type Theme = 'light' | 'dark';
export type Props = Record<string, unknown>;

/** One copy of a component on a sheet. */
export interface Item {
  /** The component, when not the sheet's own (a Button inside the Spinner sheet). */
  c?: string;
  p: Props;
  /** The caption under the copy; none when null. */
  cap?: string | null;
  /** A copy fixed in this state with the component's own rules (`support/states.css`). */
  pseudo?: 'hover' | 'pressed' | 'focus' | null;
  /**
   * Which elements the fixed state reaches (states.ts): `outer`, the outermost element with a
   * rule for it (a field box, not the buttons inside it); a number, that one of sibling items
   * (a stepper of two); `{ role, nth }`, the Nth item of a `[role]` container and what is in it
   * (the second tab of a tablist). Every element inside the frame otherwise.
   */
  scope?: 'outer' | number | { role: 'tablist' | 'radiogroup' | 'group' | 'toolbar'; nth: number };
  /** A fixed width in px. */
  w?: number;
  /** The copy's own direction, whatever the board's. */
  dir?: 'ltr' | 'rtl';
}

export interface Matrix {
  cols: string[];
  rows: { head: string; cells: Item[] }[];
}

export type Block =
  | { label: string; items: Item[]; cols?: number }
  | { label: string; matrix: Matrix };

/**
 * The overlay open, chosen in Tweaks (`view`) instead of the sheet: a modal covers its whole
 * board. Theme, density and direction are the board's own tweaks.
 */
export interface OpenView {
  /** The tweak's value, e.g. `OpenError`. */
  suffix: string;
  /** The tweak's label (Arabic). */
  label: string;
  /** The board is at least this tall while it is open. */
  h: number;
  p: Props;
  /** What the view shows (English, the board's caption). */
  cap: string;
}

export interface SheetSpec {
  name: string;
  group: string;
  /** Copies stretch to their cell (fields); otherwise they keep their own width. */
  fill?: boolean;
  /** One panel a row instead of two. */
  layout?: 'stack';
  /** false: no compact values, so only the comfortable panels are drawn. */
  density?: false;
  /** No sheet, only the open views (Toast). */
  openOnly?: boolean;
  desc: string;
  play: string;
  blocks: (density: Density) => Block[];
  open?: OpenView[];
}

export const st = (
  p: Props,
  cap?: string | null,
  pseudo?: Item['pseudo'],
  extra: Partial<Item> = {},
): Item => ({ p, ...(cap === undefined ? {} : { cap }), ...(pseudo ? { pseudo } : {}), ...extra });

/** Hover, pressed and keyboard focus copies of one item. */
export const interact = (p: Props, extra: Partial<Item> = {}): Item[] => [
  st(p, 'hover', 'hover', extra),
  st(p, 'pressed', 'pressed', extra),
  st(p, 'keyboard focus', 'focus', extra),
];

/** A field's hover and keyboard focus copies. */
export const fieldFocus = (p: Props, extra: Partial<Item> = {}): Item[] => [
  st(p, 'hover', 'hover', extra),
  st(p, 'keyboard focus', 'focus', extra),
];

/** A field's hover and keyboard focus on its box only, not on the buttons inside it. */
export const boxFocus = (p: Props, extra: Partial<Item> = {}): Item[] =>
  fieldFocus(p, { ...extra, scope: 'outer' });

export const compact = (d: Density) => d === 'compact';
