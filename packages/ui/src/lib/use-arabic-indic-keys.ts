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
      // A composing keyboard sends events that cannot be cancelled: converted on input below.
      if (!input.cancelable || input.isComposing) return;
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
    // After an insertion that could not be cancelled: the segment's text is made Western before
    // the segment reads it (this capture listener runs first).
    const onInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || (event as InputEvent).isComposing) return;
      const western = westernNumberText(target.value);
      if (western !== target.value) target.value = western;
    };
    // A pasted time («١٤:٣٠») is sent again in Western digits; the segments parse ASCII only.
    const onPaste = (event: Event) => {
      const paste = event as ClipboardEvent;
      const text = paste.clipboardData?.getData('text/plain') ?? '';
      const western = westernNumberText(text);
      if (western === text || !(paste.target instanceof HTMLElement)) return;
      paste.preventDefault();
      paste.stopImmediatePropagation();
      const data = new DataTransfer();
      data.setData('text/plain', western);
      paste.target.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
    };
    container.addEventListener('beforeinput', onBeforeInput, { capture: true });
    container.addEventListener('input', onInput, { capture: true });
    container.addEventListener('compositionend', onInput, { capture: true });
    container.addEventListener('paste', onPaste, { capture: true });
    // React 19 calls the returned cleanup when the element goes.
    return () => {
      container.removeEventListener('beforeinput', onBeforeInput, { capture: true });
      container.removeEventListener('input', onInput, { capture: true });
      container.removeEventListener('compositionend', onInput, { capture: true });
      container.removeEventListener('paste', onPaste, { capture: true });
    };
  }, []);
}
