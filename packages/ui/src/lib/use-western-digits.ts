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
      // A composing keyboard (some phone and tablet keyboards) sends events that cannot be
      // cancelled; those digits are converted after they land (onInput below).
      if (!event.cancelable || event.isComposing) return;
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
    // After an insertion that could not be cancelled: replace the Arabic-Indic digits in place,
    // keep the caret, and tell React and UI SDK with a new input event.
    const onInput = (event: Event) => {
      if ((event as InputEvent).isComposing) return;
      const western = westernNumberText(input.value);
      if (western === input.value) return;
      const caret = input.selectionStart;
      // setRangeText goes around React's value tracker, so React sees the change on the event.
      input.setRangeText(western, 0, input.value.length, 'end');
      if (caret !== null) input.setSelectionRange(caret, caret);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    // Capture on the input itself runs before UI SDK's own listeners there.
    input.addEventListener('beforeinput', onBeforeInput, { capture: true });
    input.addEventListener('input', onInput, { capture: true });
    input.addEventListener('compositionend', onInput);
    return () => {
      input.removeEventListener('beforeinput', onBeforeInput, { capture: true });
      input.removeEventListener('input', onInput, { capture: true });
      input.removeEventListener('compositionend', onInput);
    };
  }, []);
}
