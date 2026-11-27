// Helpers of the clinic page tab tests (slice A-02-08): open a tab by its name, type into a
// textarea, find a dialog or a row, as a person reaches them.
import { act } from 'react';
import { click, flush } from './render.tsx';

export const text = () => document.body.textContent;

export async function openTab(name: string): Promise<void> {
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    if (tab.textContent.trim() === name) {
      await click(tab);
      await flush(40);
      return;
    }
  }
  throw new Error(`no tab ${name}`);
}

/** The open dialog (a Dialog, an AlertDialog or the Drawer). */
export function dialog(): HTMLElement {
  const d = document.body.querySelector<HTMLElement>('[role="alertdialog"], [role="dialog"]');
  if (!d) throw new Error('no dialog');
  return d;
}

export const noDialog = () =>
  document.body.querySelector('[role="alertdialog"], [role="dialog"]') === null;

/** The control labelled `name` (an input or a textarea). */
export function control(root: HTMLElement, name: string): HTMLInputElement | HTMLTextAreaElement {
  for (const label of root.querySelectorAll('label')) {
    if (label.textContent.replace('*', '').trim() !== name) continue;
    const el = label.htmlFor ? root.querySelector(`[id="${label.htmlFor}"]`) : null;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el;
  }
  throw new Error(`no control labelled ${name}`);
}

/** Types as a person does, so React sees the change (inputs and textareas). */
export async function typeIn(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  const descriptor = Object.getOwnPropertyDescriptor(proto.prototype, 'value');
  await act(async () => {
    descriptor?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
  });
}

/** The row (list row or grid row) that holds `needle`. */
export function rowOf(needle: string): HTMLElement | null {
  for (const row of document.querySelectorAll<HTMLElement>('[role="row"], [data-row]')) {
    if (row.textContent.includes(needle)) return row;
  }
  return null;
}

/** Clicks the choice (radio, segment) whose label reads `name`. */
export async function choose(root: HTMLElement, name: string): Promise<void> {
  for (const label of root.querySelectorAll('label, [role="radio"]')) {
    if (label.textContent.trim() === name) {
      await click(label);
      await flush(20);
      return;
    }
  }
  throw new Error(`no choice ${name}`);
}
