// Date Picker open at rest (OD-119): `defaultOpen` shows the calendar at mount on the value's
// month, the chosen day selected; `defaultView="months"` shows the month and year panel instead;
// it still closes with Escape (focus back on the calendar button) and with a press outside.
// Closed by default, as before.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderDir } from '../../test/support/index.ts';
import { DatePicker } from './date-picker.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const OPEN = 'فتح التقويم';

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

async function setup(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof DatePicker>[0]> = {}) {
  const screen = await renderDir(
    <div className="flex flex-col items-center gap-4 p-16">
      <button type="button">outside</button>
      <DatePicker label="تاريخ الموعد" defaultValue="2026-11-24" {...props} />
    </div>,
    { dir },
  );
  const button = screen.getByRole('button', { name: OPEN }).element() as HTMLElement;
  return { screen, button };
}

describe.each(DIRS)('Date Picker open at rest in %s', (dir) => {
  it('is closed by default', async () => {
    const { screen } = await setup(dir);
    expect(screen.getByRole('grid').query()).toBeNull();
  });

  it('defaultOpen shows the calendar on the value’s month, the chosen day selected', async () => {
    const { screen } = await setup(dir, { defaultOpen: true });
    const grid = screen.getByRole('grid');
    await expect.element(grid).toBeVisible();
    const chosen = grid.element().querySelector('[data-selected]');
    expect(chosen?.textContent.trim()).toBe('24');
  });

  it('defaultView="months" shows the month and year panel', async () => {
    const { screen } = await setup(dir, { defaultOpen: true, defaultView: 'months' });
    await expect.element(screen.getByRole('listbox')).toBeVisible();
    expect(screen.getByRole('grid', { name: /الشهر|Month/u }).query()).not.toBeNull();
  });

  it('still closes with Escape, focus back on the calendar button', async () => {
    const onOpenChange = vi.fn();
    const { screen, button } = await setup(dir, { defaultOpen: true, onOpenChange });
    const grid = screen.getByRole('grid');
    await expect.element(grid).toBeVisible();
    grid.element().querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('grid')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await poll(() => document.activeElement, 'focus on the button').toBe(button);
  });

  it('still closes with a press outside', async () => {
    const { screen } = await setup(dir, { defaultOpen: true });
    await expect.element(screen.getByRole('grid')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    await expect.element(screen.getByRole('grid')).not.toBeInTheDocument();
  });
});
