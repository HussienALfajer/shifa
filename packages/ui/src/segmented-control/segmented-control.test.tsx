// Segmented control (slice 0.4-06) in Arabic RTL and English LTR, as the owner approved the sheet
// on 2026-11-22: one choice of two to five that switches a view at once. A named radio group with
// one Tab stop on the chosen option; the arrows of the reading direction move and choose together
// (Left is next in Arabic), Home and End reach the ends, a disabled option is skipped. The chosen
// option is raised and heavier, not only another colour.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  arrows,
  expectArrow,
  expectAxeClean,
  expectFocusRing,
  renderDir,
} from '../../test/support/index.ts';
import { SegmentedControl, type SegmentedControlItem } from './segmented-control.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const VIEWS: SegmentedControlItem[] = [
  { value: 'day', label: 'اليوم' },
  { value: 'week', label: 'الأسبوع' },
  { value: 'map', label: 'خريطة', disabled: true },
  { value: 'month', label: 'الشهر' },
];

function CalendarView({
  onValueChange,
  disabled,
}: {
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <SegmentedControl
      aria-label="عرض التقويم"
      items={VIEWS}
      defaultValue="day"
      {...(onValueChange === undefined ? {} : { onValueChange })}
      {...(disabled === undefined ? {} : { disabled })}
    />
  );
}

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 500, message });

describe.each(DIRS)('Segmented control in %s', (dir) => {
  it('is a named radio group with the chosen option checked', async () => {
    const screen = await renderDir(<CalendarView />, { dir });
    expect(screen.getByRole('radiogroup', { name: 'عرض التقويم' }).element()).toBeTruthy();
    const day = screen.getByRole('radio', { name: 'اليوم' }).element();
    expect(day.getAttribute('aria-checked')).toBe('true');
    expect(
      screen.getByRole('radio', { name: 'الأسبوع' }).element().getAttribute('aria-checked'),
    ).toBe('false');
    await screen.unmount();
  });

  it('has one Tab stop, on the chosen option', async () => {
    const screen = await renderDir(<CalendarView />, { dir });
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'اليوم' }).element());
    await userEvent.tab();
    expect(screen.getByRole('radiogroup').element().contains(document.activeElement)).toBe(false);
    await screen.unmount();
  });

  it('moves with the arrow of the reading direction and chooses as it moves', async () => {
    const onValueChange = vi.fn();
    const screen = await renderDir(<CalendarView onValueChange={onValueChange} />, { dir });
    const day = screen.getByRole('radio', { name: 'اليوم' }).element();
    const week = screen.getByRole('radio', { name: 'الأسبوع' }).element();
    await expectArrow({ dir, items: [day, week] });
    expect(onValueChange).toHaveBeenCalledWith('week');
    await poll(() => day.getAttribute('aria-checked'), 'back on «اليوم»').toBe('true');
    await screen.unmount();
  });

  it('skips a disabled option; Home and End reach the ends', async () => {
    const screen = await renderDir(<CalendarView />, { dir });
    const radio = (name: string) => screen.getByRole('radio', { name }).element();
    const { forward } = arrows(dir);
    (radio('الأسبوع') as HTMLElement).focus();
    await userEvent.keyboard(`{${forward}}`);
    await poll(() => document.activeElement, 'past «خريطة»').toBe(radio('الشهر'));
    expect(radio('الشهر').getAttribute('aria-checked')).toBe('true');
    await userEvent.keyboard('{Home}');
    await poll(() => document.activeElement, 'Home').toBe(radio('اليوم'));
    await userEvent.keyboard('{End}');
    await poll(() => document.activeElement, 'End').toBe(radio('الشهر'));
    await screen.unmount();
  });

  it('marks the chosen option by more than colour, and shows the focus ring', async () => {
    const screen = await renderDir(<CalendarView />, { dir });
    const day = screen.getByRole('radio', { name: 'اليوم' }).element() as HTMLElement;
    const week = screen.getByRole('radio', { name: 'الأسبوع' }).element();
    const chosen = getComputedStyle(day);
    const other = getComputedStyle(week);
    expect(Number(chosen.fontWeight)).toBeGreaterThan(Number(other.fontWeight));
    expect(chosen.boxShadow).not.toBe('none');
    expect(other.boxShadow).toBe('none');
    await userEvent.tab();
    await expectFocusRing(day);
    await screen.unmount();
  });

  it('a disabled control takes no choice', async () => {
    const onValueChange = vi.fn();
    const screen = await renderDir(<CalendarView disabled onValueChange={onValueChange} />, {
      dir,
    });
    await userEvent.click(screen.getByRole('radio', { name: 'الأسبوع' }), { force: true });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole('radio', { name: 'اليوم' }).element().getAttribute('aria-checked'),
    ).toBe('true');
    await screen.unmount();
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<CalendarView />, { dir, theme });
      await expectAxeClean(document.body);
      await screen.unmount();
    }
  });
});
