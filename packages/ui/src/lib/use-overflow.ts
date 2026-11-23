// Whether an element's text is cut (slice 0.4-12, OD-66): true when its content is wider than its
// box (`scrollWidth > clientWidth`), as with a one-line label under `text-overflow: ellipsis`.
// Measured again when the box changes size (a ResizeObserver) and when the text changes (a
// MutationObserver). The data table's header and the toolbar's button show their full text in a
// tooltip while it is true.
import { useCallback, useLayoutEffect, useState } from 'react';

/** A ref callback for the element to watch, and whether its text is cut. */
export function useOverflow(): [(node: HTMLElement | null) => void, boolean] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useCallback((next: HTMLElement | null) => {
    setNode(next);
  }, []);

  useLayoutEffect(() => {
    if (node === null) return undefined;
    const measure = () => {
      setOverflowing(node.scrollWidth > node.clientWidth);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    const text = new MutationObserver(measure);
    text.observe(node, { characterData: true, childList: true, subtree: true });
    return () => {
      resize.disconnect();
      text.disconnect();
    };
  }, [node]);

  return [ref, overflowing];
}
