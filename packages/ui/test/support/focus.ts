// The focus ring of a control (slice 0.4-05): the 2 px outline in the focus colour, drawn on the
// element that marks itself `data-focus-ring` (the box around an input, the mark of a checkbox),
// or on the focused element itself when nothing around it does.
import { expect } from 'vitest';
import { tokenColor } from './tokens.ts';

/** The element that draws the ring for `focused`. */
export function ringOf(focused: Element): Element {
  return focused.closest('[data-focus-ring]') ?? focused;
}

/** Proves the ring is shown on `focused` after keyboard focus, in the focus colour. */
export async function expectFocusRing(focused: Element): Promise<void> {
  const ring = ringOf(focused);
  const want = tokenColor('--shifa-color-border-focus', ring);
  await expect
    .poll(
      () => {
        const style = getComputedStyle(ring);
        return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`;
      },
      { timeout: 500, message: 'a 2 px solid outline in the focus colour' },
    )
    .toBe(`solid 2px ${want}`);
}
