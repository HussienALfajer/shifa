// Spinner (slice 0.4-07), as the owner approved the sheet on 2026-11-22 (OD-64): Shifa's loading
// indicator, the four jasmine petals of the logo lighting in turn. Alone it is a status named
// «جارٍ التحميل»; inside a control that says it is busy (aria-busy) it is hidden. It waits 400 ms
// before it shows, so quick loads do not flash, and once shown stays at least 400 ms. Still under
// reduced motion.
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir } from '../../test/support/index.ts';
import { Button } from '../button/button.tsx';
import { Spinner } from './spinner.tsx';

const DIRS = ['rtl', 'ltr'] as const;

/** The one element matching `selector`; fails the test when there is none. */
function one(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (el === null) throw new Error(`no ${selector}`);
  return el;
}
const poll = (fn: () => unknown, message: string, timeout = 1500) =>
  expect.poll(fn, { timeout, message });
const status = () => document.querySelector('[role="status"]');

describe.each(DIRS)('Spinner in %s', (dir) => {
  it('alone: a status named «جارٍ التحميل», shown after the delay', async () => {
    const screen = await renderDir(<Spinner />, { dir });
    // Not before the delay: nothing on screen and nothing announced.
    expect(status()).toBeNull();
    await poll(() => status() !== null, 'shown after 400 ms').toBe(true);
    expect(screen.getByRole('status', { name: 'جارٍ التحميل' }).element()).toBeTruthy();
    expect(status()?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    await screen.unmount();
  });

  it('takes the caller’s label and a delay of 0', async () => {
    const screen = await renderDir(<Spinner label="جارٍ تحميل الفواتير" delay={0} />, { dir });
    await poll(() => status() !== null, 'shown at once').toBe(true);
    expect(screen.getByRole('status', { name: 'جارٍ تحميل الفواتير' }).element()).toBeTruthy();
    await screen.unmount();
  });

  it('is not shown when the wait ends before the delay', async () => {
    function Quick() {
      const [busy, setBusy] = useState(true);
      return (
        <>
          <Spinner active={busy} />
          <button
            type="button"
            onClick={() => {
              setBusy(false);
            }}
          >
            تم
          </button>
        </>
      );
    }
    const screen = await renderDir(<Quick />, { dir });
    await userEvent.click(screen.getByRole('button', { name: 'تم' }));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(status()).toBeNull();
    await screen.unmount();
  });

  it('once shown, stays at least 400 ms after the wait ends', async () => {
    function Slow() {
      const [busy, setBusy] = useState(true);
      return (
        <>
          <Spinner active={busy} />
          <button
            type="button"
            onClick={() => {
              setBusy(false);
            }}
          >
            تم
          </button>
        </>
      );
    }
    const screen = await renderDir(<Slow />, { dir });
    await poll(() => status() !== null, 'shown').toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'تم' }));
    expect(status(), 'still shown right after the wait ends').not.toBeNull();
    await poll(() => status(), 'gone after the minimum').toBeNull();
    await screen.unmount();
  });

  it('inside a busy Button: hidden, the button says it is busy', async () => {
    const screen = await renderDir(<Button loading>حفظ الزيارة</Button>, { dir });
    const button = screen.getByRole('button', { name: 'حفظ الزيارة' }).element();
    expect(button.getAttribute('aria-busy')).toBe('true');
    const svg = button.querySelector('[data-slot="spinner"] svg');
    expect(svg, 'the petals inside the button').not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(button.querySelector('[role="status"]')).toBeNull();
    await screen.unmount();
  });

  it('draws four petals that light in turn, still under reduced motion', async () => {
    const screen = await renderDir(<Spinner delay={0} />, { dir });
    await poll(() => status() !== null, 'shown').toBe(true);
    const petals = [...document.querySelectorAll('[data-slot="petal"]')];
    expect(petals).toHaveLength(4);
    expect(getComputedStyle(petals[0] as HTMLElement).animationName).not.toBe('none');
    await screen.unmount();

    const still = await renderDir(
      <div data-motion="reduce">
        <Spinner delay={0} />
      </div>,
      { dir },
    );
    await poll(() => status() !== null, 'shown').toBe(true);
    const quiet = [...document.querySelectorAll('[data-slot="petal"]')];
    expect(quiet.map((p) => getComputedStyle(p).animationName)).toEqual([
      'none',
      'none',
      'none',
      'none',
    ]);
    // Still, the petals keep their stepped opacities so the mark reads as the spinner.
    const opacities = quiet.map((p) => Number(getComputedStyle(p).opacity));
    expect(new Set(opacities).size).toBe(4);
    await still.unmount();
  });

  it('takes its colour from the text around it, in the three sizes', async () => {
    const screen = await renderDir(
      <div className="text-brand-primary">
        <Spinner delay={0} size="sm" />
        <Spinner delay={0} size="md" />
        <Spinner delay={0} size="lg" />
      </div>,
      { dir },
    );
    await poll(() => document.querySelectorAll('[role="status"]').length, 'three').toBe(3);
    const svgs = [...document.querySelectorAll('[role="status"] svg')];
    const widths = svgs.map((s) => s.getBoundingClientRect().width);
    expect(widths).toEqual([20, 24, 40]);
    const holder = one('.text-brand-primary');
    expect(getComputedStyle(svgs[0] as HTMLElement).color).toBe(getComputedStyle(holder).color);
    await screen.unmount();
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<Spinner delay={0} />, { dir, theme });
      await poll(() => status() !== null, 'shown').toBe(true);
      await expectAxeClean(document.body);
      await screen.unmount();
    }
  });
});
