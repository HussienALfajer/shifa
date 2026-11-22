// Tooltip (slice 0.4-06) in Arabic RTL and English LTR, as the owner approved the sheet on
// 2026-11-22 with OD-63: a dark ink bubble above its trigger (below when asked or when there is
// no room), opened at once by keyboard focus and after a delay by hover, never by a touch tap;
// Escape closes it and leaves focus where it was. It describes a text trigger (aria-describedby)
// and names an icon button with the same words as its label, so nothing is read twice.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  expectAxeClean,
  expectPopupSide,
  renderDir,
  tokenColor,
} from '../../test/support/index.ts';
import { Button } from '../button/button.tsx';
import { IconButton } from '../icon-button/icon-button.tsx';
import { Tooltip } from './tooltip.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const HINT = 'إرسال تذكير عبر واتساب';

function Reminder({ side }: { side?: 'top' | 'bottom' }) {
  return (
    <div className="p-16">
      <Tooltip content={HINT} {...(side === undefined ? {} : { side })}>
        <Button>إرسال تذكير</Button>
      </Tooltip>
    </div>
  );
}

const poll = (fn: () => unknown, message: string, timeout = 1000) =>
  expect.poll(fn, { timeout, message });

const tooltipOf = () => document.querySelector<HTMLElement>('[role="tooltip"]');
const isOpen = () => tooltipOf()?.hasAttribute('data-open') === true;

describe.each(DIRS)('Tooltip in %s', (dir) => {
  it('opens at once on keyboard focus and describes its trigger', async () => {
    const screen = await renderDir(<Reminder />, { dir });
    const trigger = screen.getByRole('button', { name: 'إرسال تذكير' }).element() as HTMLElement;
    await userEvent.tab();
    expect(document.activeElement).toBe(trigger);
    await poll(isOpen, 'open on focus', 300).toBe(true);
    const tip = tooltipOf();
    expect(tip?.textContent).toBe(HINT);
    expect(trigger.getAttribute('aria-describedby')).toBe(tip?.id);
    await screen.unmount();
  });

  it('opens on hover only after a delay, and closes when the pointer leaves', async () => {
    const screen = await renderDir(<Reminder />, { dir });
    const trigger = screen.getByRole('button', { name: 'إرسال تذكير' });
    await userEvent.hover(trigger);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(isOpen()).toBe(false);
    await poll(isOpen, 'open after the hover delay', 1500).toBe(true);
    await userEvent.unhover(trigger);
    await poll(isOpen, 'closed after the pointer leaves').toBe(false);
    await screen.unmount();
  });

  it('Escape closes it and focus stays on the trigger', async () => {
    const screen = await renderDir(<Reminder />, { dir });
    const trigger = screen.getByRole('button', { name: 'إرسال تذكير' }).element();
    await userEvent.tab();
    await poll(isOpen, 'open on focus').toBe(true);
    await userEvent.keyboard('{Escape}');
    await poll(isOpen, 'closed by Escape').toBe(false);
    expect(document.activeElement).toBe(trigger);
    await screen.unmount();
  });

  it('does not open on a touch tap', async () => {
    const screen = await renderDir(<Reminder />, { dir });
    const trigger = screen.getByRole('button', { name: 'إرسال تذكير' }).element() as HTMLElement;
    const touch = { pointerType: 'touch', bubbles: true, isPrimary: true, pointerId: 7 };
    trigger.dispatchEvent(new PointerEvent('pointerover', touch));
    trigger.dispatchEvent(new PointerEvent('pointerenter', touch));
    trigger.dispatchEvent(new PointerEvent('pointerdown', touch));
    trigger.dispatchEvent(new PointerEvent('pointerup', touch));
    trigger.click();
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(isOpen()).toBe(false);
    await screen.unmount();
  });

  it('sits above the trigger, centred; below with side="bottom"', async () => {
    for (const side of ['top', 'bottom'] as const) {
      const screen = await renderDir(<Reminder side={side} />, { dir });
      const trigger = screen.getByRole('button', { name: 'إرسال تذكير' }).element();
      await userEvent.tab();
      await poll(isOpen, 'open').toBe(true);
      const tip = tooltipOf();
      if (tip === null) throw new Error('no tooltip');
      expectPopupSide({ dir, trigger, popup: tip, side, align: 'center' });
      await screen.unmount();
    }
  });

  it('is drawn in the tooltip colours and wraps long text at its width', async () => {
    const long = 'نسخ رابط صفحة الحجز إلى الحافظة لإرساله إلى المريض عبر واتساب أو رسالة نصية';
    const screen = await renderDir(
      <div className="p-16">
        <Tooltip content={long}>
          <Button>نسخ الرابط</Button>
        </Tooltip>
      </div>,
      { dir },
    );
    await userEvent.tab();
    await poll(isOpen, 'open').toBe(true);
    const tip = tooltipOf();
    if (tip === null) throw new Error('no tooltip');
    const style = getComputedStyle(tip);
    expect(style.backgroundColor).toBe(tokenColor('--shifa-tooltip-bg', tip));
    expect(style.color).toBe(tokenColor('--shifa-tooltip-fg', tip));
    expect(tip.getBoundingClientRect().width).toBeLessThanOrEqual(240 + 1);
    expect(tip.getBoundingClientRect().height).toBeGreaterThan(30);
    await screen.unmount();
  });

  it('on an icon button, says its label once: the name, not a second description', async () => {
    const screen = await renderDir(
      <div className="p-16">
        <IconButton icon="printer" label="طباعة الوصفة" tooltip />
      </div>,
      { dir },
    );
    const button = screen.getByRole('button', { name: 'طباعة الوصفة' }).element();
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    await userEvent.tab();
    await poll(isOpen, 'open on focus').toBe(true);
    expect(tooltipOf()?.textContent).toBe('طباعة الوصفة');
    await screen.unmount();
  });

  it('does not animate under reduced motion', async () => {
    const screen = await renderDir(
      <div data-motion="reduce">
        <Reminder />
      </div>,
      { dir },
    );
    await userEvent.tab();
    await poll(isOpen, 'open').toBe(true);
    const tip = tooltipOf();
    if (tip === null) throw new Error('no tooltip');
    expect(getComputedStyle(tip).transitionDuration).toBe('0s');
    await screen.unmount();
  });

  it('is clean under axe while open, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<Reminder />, { dir, theme });
      await userEvent.tab();
      await poll(isOpen, 'open').toBe(true);
      await expectAxeClean(document.body);
      await screen.unmount();
    }
  });
});
