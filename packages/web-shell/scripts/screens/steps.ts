// What a person does to reach a state that only comes after acting (an error after sending, an
// open drawer, a dialog's second step): typed into fields and pressed on buttons found by the
// texts the screen shows, as the page tests do. The board then stays live for Play.
import type { CommonKey } from '@shifa/i18n';
import { advanceClock } from './isolate.ts';

export type Step =
  /** Types into the field whose label reads this text key. */
  | { fill: CommonKey; value: string; values?: Record<string, unknown> }
  /** Types into the element the selector finds (a field without a label of its own). */
  | { fillIn: string; value: string }
  /** Presses the button or link whose text (or aria-label) reads this text key. */
  | { press: CommonKey; values?: Record<string, unknown>; nth?: number }
  /** Presses the button or link whose text reads exactly this (a name from the data). */
  | { pressText: string }
  /** Presses the first button or link whose text holds this (a card that names a clinic). */
  | { pressIn: string }
  /** Ticks the checkbox or radio whose label reads this, inside `within` when given. */
  | { check: string; within?: string }
  /** Presses the element the selector finds. */
  | { click: string }
  /** A key on the element the selector finds (default: the focused one). */
  | { key: string; on?: string; shift?: boolean }
  /** Waits until this text key shows, or for a time. */
  | { until: CommonKey; values?: Record<string, unknown> }
  /** Waits until the selector finds an element. */
  | { untilSel: string }
  | { wait: number }
  /** Time passes on this board without the person acting (ms). */
  | { advance: number };

export type Translate = (key: CommonKey, values?: Record<string, unknown>) => string;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function find<T>(look: () => T | null, what: string, signal?: AbortSignal): Promise<T> {
  // Up to 15 s: a failed read shows only after the query's own retries (1 s, 2 s, 4 s).
  for (let i = 0; i < 300; i += 1) {
    // Stopped while waiting: never pick up what the next state put on the board.
    signal?.throwIfAborted();
    const found = look();
    if (found) return found;
    await sleep(50);
  }
  throw new Error(`screens canvas: ${what} not found`);
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function byLabel(root: ParentNode, label: string): HTMLInputElement | HTMLTextAreaElement | null {
  for (const l of root.querySelectorAll('label')) {
    if (clean(l.textContent) !== label && !clean(l.textContent).startsWith(`${label} `)) continue;
    const control = l.htmlFor ? document.getElementById(l.htmlFor) : l.querySelector('input');
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      return control;
    }
  }
  return null;
}

function pressable(root: ParentNode, name: string, nth = 0): HTMLElement | null {
  const all = [
    ...root.querySelectorAll<HTMLElement>(
      'button, a, [role="menuitem"], [role="tab"], [role="radio"], [role="option"]',
    ),
  ];
  const hits = all.filter(
    (el) =>
      !el.closest('[inert]') &&
      // A person presses a button once it is on: wait while it is off (a key still loading).
      !el.matches(':disabled, [aria-disabled="true"]') &&
      (clean(el.textContent) === name || el.getAttribute('aria-label') === name),
  );
  return hits[nth] ?? null;
}

/** Sets a value the way typing does, so React sees the change. */
function type(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
  control.focus();
  const proto = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set?.call(control, value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
}

export async function runSteps(
  root: HTMLElement,
  steps: Step[],
  t: Translate,
  signal?: AbortSignal,
): Promise<void> {
  // Dialogs and drawers open in the top layer, which may sit outside the island's element.
  const scope = root.ownerDocument;
  const seek = <T>(look: () => T | null, what: string) => find(look, what, signal);
  for (const step of steps) {
    // Another state was chosen meanwhile: nothing more is pressed on its behalf.
    signal?.throwIfAborted();
    if ('fill' in step) {
      const label = t(step.fill, step.values);
      type(await seek(() => byLabel(scope, label), `field «${label}»`), step.value);
    } else if ('fillIn' in step) {
      const el = await seek(() => scope.querySelector(step.fillIn), step.fillIn);
      type(el as HTMLInputElement, step.value);
    } else if ('press' in step) {
      const name = t(step.press, step.values);
      (await seek(() => pressable(scope, name, step.nth), `button «${name}»`)).click();
    } else if ('pressText' in step) {
      (await seek(() => pressable(scope, step.pressText), `button «${step.pressText}»`)).click();
    } else if ('pressIn' in step) {
      const holding = () =>
        [
          ...scope.querySelectorAll<HTMLElement>(
            'button, a, [role="menuitem"], [role="menuitemradio"], [role="option"]',
          ),
        ].find((el) => !el.matches(':disabled') && clean(el.textContent).includes(step.pressIn)) ??
        null;
      (await seek(holding, `button holding «${step.pressIn}»`)).click();
    } else if ('check' in step) {
      const label = () =>
        [...scope.querySelectorAll<HTMLElement>(`${step.within ?? ''} label`.trim())].find((el) =>
          clean(el.textContent).startsWith(step.check),
        ) ?? null;
      (await seek(label, `choice «${step.check}»`)).click();
    } else if ('click' in step) {
      (await seek(() => scope.querySelector<HTMLElement>(step.click), step.click)).click();
    } else if ('key' in step) {
      const target = step.on
        ? await seek(() => scope.querySelector(step.on ?? ''), step.on)
        : (scope.activeElement ?? scope.body);
      const init = { key: step.key, bubbles: true, shiftKey: step.shift === true };
      target.dispatchEvent(new KeyboardEvent('keydown', init));
      target.dispatchEvent(new KeyboardEvent('keyup', init));
    } else if ('untilSel' in step) {
      await seek(() => scope.querySelector(step.untilSel), step.untilSel);
    } else if ('until' in step) {
      const want = t(step.until, step.values);
      await seek(
        () => (clean(scope.body.textContent).includes(clean(want)) ? true : null),
        `«${want}»`,
      );
    } else if ('advance' in step) {
      advanceClock(step.advance);
    } else {
      await sleep(step.wait);
    }
    await sleep(120);
  }
}
