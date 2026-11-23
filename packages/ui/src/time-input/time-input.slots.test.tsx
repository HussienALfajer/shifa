// Time Input slot grid (slice 0.4-13 criterion 19, OD-70 B, OD-73), in both directions: the clock
// is a button «اختيار الوقت»; Enter, Space or Alt+Down from a segment open a popup of slots;
// focus opens on the chosen time or the next one after now; arrows follow the reading direction,
// Up and Down a row; one press chooses, fills the segments and closes; Escape closes and returns
// focus to the button; only groups with slots; times left to right; «أقرب وقت» chooses the next
// slot; axe clean.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { arrows, expectAxeClean, renderDir } from '../../test/support/index.ts';
import { TimeInput } from './time-input.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const LABEL = 'وقت الموعد';
const T = {
  rtl: {
    button: 'اختيار الوقت',
    morning: 'صباحاً',
    afternoon: 'بعد الظهر',
    nearest: 'أقرب وقت',
    hour: 'الساعة',
    minute: 'الدقائق',
  },
  ltr: {
    button: 'Choose a time',
    morning: 'Morning',
    afternoon: 'Afternoon',
    nearest: 'Nearest time',
    hour: 'Hour',
    minute: 'Minute',
  },
} as const;

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });
const activeText = () => document.activeElement?.textContent.trim();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 23, 10, 20));
});
afterEach(() => {
  vi.useRealTimers();
});

async function setup(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof TimeInput>[0]> = {}) {
  const onValueChange = vi.fn<(value: string | null) => void>();
  const screen = await renderDir(
    <div className="p-8">
      <TimeInput label={LABEL} min="09:00" max="17:00" onValueChange={onValueChange} {...props} />
    </div>,
    { dir },
  );
  const button = screen.getByRole('button', { name: T[dir].button }).element() as HTMLElement;
  const hour = screen.getByRole('spinbutton', { name: T[dir].hour }).element() as HTMLInputElement;
  const minute = screen
    .getByRole('spinbutton', { name: T[dir].minute })
    .element() as HTMLInputElement;
  return { screen, button, hour, minute, onValueChange };
}

const dialogOpen = (screen: Awaited<ReturnType<typeof renderDir>>) =>
  screen.getByRole('dialog', { name: T.rtl.button }).elements().length +
  screen.getByRole('dialog', { name: T.ltr.button }).elements().length;

describe.each(DIRS)('Time Input slot grid in %s', (dir) => {
  it('the clock is a button that opens a popup of slots on a press', async () => {
    const s = await setup(dir, { defaultValue: '10:30' });
    await userEvent.click(s.button);
    await poll(() => dialogOpen(s.screen), 'the popup is open').toBe(1);
    await expect.element(s.screen.getByRole('grid', { name: T[dir].morning })).toBeVisible();
  });

  it('Enter and Space on the button, and Alt+Down from a segment, open it', async () => {
    for (const keys of ['{Enter}', ' ']) {
      const s = await setup(dir);
      s.button.focus();
      await userEvent.keyboard(keys);
      await poll(() => dialogOpen(s.screen), `${keys} opens`).toBe(1);
      await s.screen.unmount();
    }
    const s = await setup(dir);
    s.hour.focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await poll(() => dialogOpen(s.screen), 'Alt+Down opens').toBe(1);
  });

  it('shows only the groups that have slots, times left to right', async () => {
    const s = await setup(dir);
    await userEvent.click(s.button);
    const grids = s.screen.getByRole('grid').elements();
    expect(grids.map((g) => g.getAttribute('aria-label'))).toEqual([
      T[dir].morning,
      T[dir].afternoon,
    ]);
    const slots = s.screen.getByRole('gridcell').elements();
    expect(slots).toHaveLength(32);
    const time = s.screen.getByRole('button', { name: /^10:30/ }).element();
    expect(time.closest('[dir="ltr"]')).not.toBeNull();
  });

  it('focus opens on the chosen time', async () => {
    const s = await setup(dir, { defaultValue: '14:15' });
    await userEvent.click(s.button);
    await poll(activeText, 'on the chosen time').toBe('14:15');
    const cell = document.activeElement?.closest('[role="gridcell"]');
    expect(cell?.getAttribute('aria-selected')).toBe('true');
  });

  it('focus opens on the next slot after now when the field is empty', async () => {
    const s = await setup(dir);
    await userEvent.click(s.button);
    await poll(activeText, 'on 10:30 at 10:20').toBe('10:30');
  });

  it('arrows follow the reading direction; Up and Down move a row', async () => {
    const s = await setup(dir, { defaultValue: '10:30' });
    await userEvent.click(s.button);
    await poll(activeText, 'start').toBe('10:30');
    await userEvent.keyboard(`{${arrows(dir).forward}}`);
    await poll(activeText, 'forward').toBe('10:45');
    await userEvent.keyboard(`{${arrows(dir).backward}}`);
    await poll(activeText, 'backward').toBe('10:30');
    await userEvent.keyboard('{ArrowDown}');
    await poll(activeText, 'a row down').toBe('11:30');
    await userEvent.keyboard('{ArrowUp}');
    await poll(activeText, 'a row up').toBe('10:30');
  });

  it('one press chooses, fills the segments and closes', async () => {
    const s = await setup(dir, { defaultValue: '10:30' });
    await userEvent.click(s.button);
    await userEvent.click(s.screen.getByRole('button', { name: /^11:15/ }));
    expect(s.onValueChange).toHaveBeenLastCalledWith('11:15');
    await poll(() => dialogOpen(s.screen), 'closed').toBe(0);
    await poll(() => [s.hour.value, s.minute.value], 'segments filled').toEqual(['11', '15']);
  });

  it('Enter on a slot chooses it', async () => {
    const s = await setup(dir, { defaultValue: '10:30' });
    await userEvent.click(s.button);
    await poll(activeText, 'start').toBe('10:30');
    await userEvent.keyboard(`{${arrows(dir).forward}}{Enter}`);
    expect(s.onValueChange).toHaveBeenLastCalledWith('10:45');
    await poll(() => dialogOpen(s.screen), 'closed').toBe(0);
  });

  it('Escape closes and returns focus to the button', async () => {
    const s = await setup(dir, { defaultValue: '10:30' });
    await userEvent.click(s.button);
    await poll(activeText, 'open').toBe('10:30');
    await userEvent.keyboard('{Escape}');
    await poll(() => dialogOpen(s.screen), 'closed').toBe(0);
    await poll(() => document.activeElement, 'focus on the button').toBe(s.button);
    expect(s.onValueChange).not.toHaveBeenCalled();
  });

  it('«nearest time» chooses the next slot after now and closes', async () => {
    const s = await setup(dir);
    await userEvent.click(s.button);
    await userEvent.click(s.screen.getByRole('button', { name: T[dir].nearest }));
    expect(s.onValueChange).toHaveBeenLastCalledWith('10:30');
    await poll(() => dialogOpen(s.screen), 'closed').toBe(0);
  });

  it('says the step and the hours in the footer', async () => {
    const s = await setup(dir);
    await userEvent.click(s.button);
    const text = dir === 'rtl' ? 'كل 15 دقيقة · 09:00–17:00' : 'Every 15 minutes · 09:00–17:00';
    await expect.element(s.screen.getByText(text)).toBeVisible();
  });

  it('writes ص/م on the 12-hour clock', async () => {
    const s = await setup(dir, { hourCycle: 12 });
    await userEvent.click(s.button);
    const label = dir === 'rtl' ? '02:30 م' : '02:30 PM';
    await expect
      .element(s.screen.getByRole('button', { name: new RegExp(`^${label}`) }))
      .toBeVisible();
  });

  it('honours a step', async () => {
    const s = await setup(dir, { step: 30 });
    await userEvent.click(s.button);
    expect(s.screen.getByRole('gridcell').elements()).toHaveLength(16);
  });

  it('is clean under axe with the grid open, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <TimeInput label={LABEL} min="09:00" max="17:00" defaultValue="10:30" />,
        { dir, theme },
      );
      await userEvent.click(screen.getByRole('button', { name: T[dir].button }));
      await expect.element(screen.getByRole('grid').first()).toBeVisible();
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
