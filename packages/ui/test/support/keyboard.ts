// Keyboard and typing helpers for the RTL gate (spec 0.4 criterion 7).
import { expect } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import type { Direction } from '../../src/index.ts';
import { toWesternDigits } from '../../src/lib/digits.ts';

/** The arrow key that moves forward along a horizontal list in `dir`, and the one back. */
export function arrows(dir: Direction): { forward: string; backward: string } {
  return dir === 'rtl'
    ? { forward: 'ArrowLeft', backward: 'ArrowRight' }
    : { forward: 'ArrowRight', backward: 'ArrowLeft' };
}

/**
 * Proves the horizontal arrow keys follow the reading direction: from the first item the forward
 * arrow (ArrowLeft in RTL) reaches the second, and the backward arrow comes back.
 */
export async function expectArrow({
  dir,
  items,
}: {
  dir: Direction;
  items: readonly Element[];
}): Promise<void> {
  const [first, second] = items;
  if (!(first instanceof HTMLElement) || !(second instanceof HTMLElement)) {
    throw new Error('expectArrow needs at least two focusable items');
  }
  const { forward, backward } = arrows(dir);
  first.focus();
  await userEvent.keyboard(`{${forward}}`);
  await expect
    .poll(() => document.activeElement, {
      timeout: 500,
      message: `${forward} moves forward in ${dir}`,
    })
    .toBe(second);
  await userEvent.keyboard(`{${backward}}`);
  await expect
    .poll(() => document.activeElement, {
      timeout: 500,
      message: `${backward} moves back in ${dir}`,
    })
    .toBe(first);
}

/**
 * Presses one key for each character of `text` as a real keyboard does, with `keydown` and
 * `keyup` carrying the character as `key` (slice 0.4-04). `userEvent.keyboard` sends a letter
 * outside the US layout (Arabic) as inserted text with no key events, so typeahead in a menu or
 * a list never sees it; Chromium's input protocol sends the key itself.
 */
export async function pressKeys(text: string): Promise<void> {
  const session = cdp();
  for (const ch of text) {
    await session.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: ch,
      text: ch,
      unmodifiedText: ch,
    });
    await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
  }
}

/** Types `text` (Arabic letters included) into `input` and proves the field kept it. */
export async function typeArabic(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
  await userEvent.clear(input);
  await userEvent.type(input, text);
  await expect
    .poll(() => input.value, { timeout: 500, message: 'the field keeps the typed Arabic text' })
    .toBe(text);
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const WESTERN = '0123456789';

/**
 * Proves a digit field accepts Arabic-Indic and Western digits and stores Western ones (OD-20):
 * types each set into `input` and reads what the field stored through `stored`.
 */
export async function expectDigitsAccepted({
  input,
  stored,
}: {
  input: HTMLInputElement;
  stored: () => string;
}): Promise<void> {
  for (const typed of [ARABIC_INDIC, WESTERN]) {
    await userEvent.clear(input);
    await userEvent.type(input, typed);
    await expect
      .poll(stored, { timeout: 500, message: `"${typed}" is stored as Western digits` })
      .toBe(toWesternDigits(typed));
  }
}
