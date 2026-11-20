// OD-20 for segmented fields (slice 0.4-05): UI SDK's Time Input segments are inputs whose own
// `beforeinput` listener inserts the typed text and accepts ASCII digits only. This ref callback,
// on a container, catches a `beforeinput` carrying Arabic-Indic digits in the capture phase
// (before the segment sees it), cancels it, and sends the same edit again with Western digits,
// which the segment then handles as a typed key.
import { useCallback } from 'react';
import { westernNumberText } from './use-western-digits.ts';

/** A ref callback for a container of inputs: Arabic-Indic digits reach them as Western ones. */
export function useArabicIndicKeys(): (container: HTMLElement | null) => (() => void) | undefined {
  return useCallback((container: HTMLElement | null) => {
    if (container === null) return undefined;
    const onBeforeInput = (event: Event) => {
      const input = event as InputEvent;
      const data = input.data;
      if (data === null || !(input.target instanceof HTMLElement)) return;
      const western = westernNumberText(data);
      if (western === data) return;
      input.preventDefault();
      input.stopImmediatePropagation();
      input.target.dispatchEvent(
        new InputEvent('beforeinput', {
          inputType: input.inputType,
          data: western,
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
    };
    container.addEventListener('beforeinput', onBeforeInput, { capture: true });
    // React 19 calls the returned cleanup when the element goes.
    return () => {
      container.removeEventListener('beforeinput', onBeforeInput, { capture: true });
    };
  }, []);
}
