// OD-20 at the keyboard (slice 0.4-04): UI SDK's number and date fields accept Arabic-Indic
// digits only in a locale that also shows them, and Shifa shows Western digits only. This ref
// callback turns typed or pasted Arabic-Indic digits (٠–٩, ۰–۹) and the Arabic decimal and
// group marks (٫ ٬) into their Western form before UI SDK's own input filter sees them.
import { useCallback } from 'react';
import { toWesternDigits } from './digits.ts';

/** `text` with Arabic-Indic digits and the Arabic decimal and group marks in Western form. */
export function westernNumberText(text: string): string {
  return toWesternDigits(text).replace(/٫/g, '.').replace(/٬/g, ',');
}

/** A ref callback for an `<input>`: Arabic-Indic digits are inserted as Western ones. */
export function useWesternDigits(): (input: HTMLInputElement | null) => (() => void) | undefined {
  return useCallback((input: HTMLInputElement | null) => {
    if (input === null) return undefined;
    const onBeforeInput = (event: InputEvent) => {
      const data = event.data ?? event.dataTransfer?.getData('text/plain') ?? null;
      if (data === null) return;
      const western = westernNumberText(data);
      if (western === data) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // insertText keeps the caret, the undo history and the input event UI SDK listens to, and
      // runs the Western text through UI SDK's own input filter again. No other API inserts
      // text as a user edit (setRangeText skips both).
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only user-edit insertion (see above)
      document.execCommand('insertText', false, western);
    };
    // Capture on the input itself runs before UI SDK's own listener there.
    input.addEventListener('beforeinput', onBeforeInput, { capture: true });
    return () => {
      input.removeEventListener('beforeinput', onBeforeInput, { capture: true });
    };
  }, []);
}
