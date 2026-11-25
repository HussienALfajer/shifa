// Time Input open at rest (OD-119): `defaultOpen` shows the slot list at mount, in 24 and 12
// hours, the chosen time pressed; it still closes with Escape (focus back on the clock button)
// and with a press outside; `open` and `onOpenChange` control it. Closed by default, as before.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderDir } from '../../test/support/index.ts';
import { TimeInput } from './time-input.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const BUTTON = { rtl: 'اختيار الوقت', ltr: 'Choose a time' } as const;

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 23, 10, 20));
});
afterEach(() => {
  vi.useRealTimers();
});

async function setup(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof TimeInput>[0]> = {}) {
  const screen = await renderDir(
    <div className="flex flex-col items-center gap-4 p-8">
      <button type="button">outside</button>
      <TimeInput label="وقت الموعد" min="09:00" max="17:00" defaultValue="10:30" {...props} />
    </div>,
    { dir },
  );
  const button = screen.getByRole('button', { name: BUTTON[dir] }).element() as HTMLElement;
  const dialog = () => screen.getByRole('dialog', { name: BUTTON[dir] });
  return { screen, button, dialog };
}

describe.each(DIRS)('Time Input open at rest in %s', (dir) => {
  it('is closed by default', async () => {
    const { dialog } = await setup(dir);
    expect(dialog().query()).toBeNull();
  });

  it.each([24, 12] as const)('defaultOpen shows the slots at mount, %i hours', async (cycle) => {
    const { dialog } = await setup(dir, { defaultOpen: true, hourCycle: cycle });
    await expect.element(dialog()).toBeVisible();
    const pressed = dialog().element().querySelector('[aria-pressed="true"]');
    expect(pressed?.textContent).toContain('10:30');
  });

  it('still closes with Escape, focus back on the clock button', async () => {
    const onOpenChange = vi.fn();
    const { button, dialog } = await setup(dir, { defaultOpen: true, onOpenChange });
    await expect.element(dialog()).toBeVisible();
    dialog().element().querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    await userEvent.keyboard('{Escape}');
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await poll(() => document.activeElement, 'focus on the button').toBe(button);
  });

  it('still closes with a press outside', async () => {
    const { screen, dialog } = await setup(dir, { defaultOpen: true });
    await expect.element(dialog()).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    await expect.element(dialog()).not.toBeInTheDocument();
  });

  it('open controls it', async () => {
    const { dialog } = await setup(dir, { open: true });
    await expect.element(dialog()).toBeVisible();
  });
});
