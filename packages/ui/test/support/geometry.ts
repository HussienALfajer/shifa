// Where a popup sits next to its trigger, in logical terms (spec 0.4 criterion 7).
import type { Direction } from '../../src/index.ts';

export type Side = 'top' | 'bottom' | 'inline-start' | 'inline-end';
export type Align = 'start' | 'center' | 'end';

const TOLERANCE = 1;

/**
 * Throws unless `popup` is on `side` of `trigger` and aligned to its `align` edge, read in `dir`:
 * in RTL the inline start is the right edge. Alignment is along the side (for top and bottom, the
 * inline edges; for the inline sides, the top and bottom edges).
 */
export function expectPopupSide({
  dir,
  trigger,
  popup,
  side,
  align,
}: {
  dir: Direction;
  trigger: Element;
  popup: Element;
  side: Side;
  align: Align;
}): void {
  const t = trigger.getBoundingClientRect();
  const p = popup.getBoundingClientRect();
  const rtl = dir === 'rtl';
  const startEdge = (r: DOMRect) => (rtl ? r.right : r.left);
  const endEdge = (r: DOMRect) => (rtl ? r.left : r.right);
  const near = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE;
  const fail = (what: string) => {
    throw new Error(`popup ${what} (side ${side}, align ${align}, ${dir})`);
  };

  const onSide = {
    bottom: p.top >= t.bottom - TOLERANCE,
    top: p.bottom <= t.top + TOLERANCE,
    'inline-start': rtl ? p.left >= t.right - TOLERANCE : p.right <= t.left + TOLERANCE,
    'inline-end': rtl ? p.right <= t.left + TOLERANCE : p.left >= t.right - TOLERANCE,
  }[side];
  if (!onSide) fail(`is not on the ${side} side of its trigger`);

  const vertical = side === 'top' || side === 'bottom';
  const aligned = vertical
    ? {
        start: near(startEdge(p), startEdge(t)),
        end: near(endEdge(p), endEdge(t)),
        center: near(p.left + p.width / 2, t.left + t.width / 2),
      }[align]
    : {
        start: near(p.top, t.top),
        end: near(p.bottom, t.bottom),
        center: near(p.top + p.height / 2, t.top + t.height / 2),
      }[align];
  if (!aligned) fail(`is not aligned to the trigger's ${align} edge`);
}
