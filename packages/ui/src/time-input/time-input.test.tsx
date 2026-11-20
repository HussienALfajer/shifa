// Time Input (slice 0.4-05, spec 0.4 criterion 8; OD-62): a group named by its label with an
// hour and a minute segment, plus a ص/م segment on the 12-hour clock (a clinic setting; 24-hour
// by default). Segments keep the order of a written time, left to right, in both directions; the
// arrows Left and Right move to the segment on that side; Up and Down change the focused
// segment; Arabic-Indic and Western digits are accepted; the value is always "HH:mm"; the error
// is read with it; axe is clean, light and dark.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, expectFocusRing, renderDir } from '../../test/support/index.ts';
import { TimeInput } from './time-input.tsx';

const described = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

async function setup(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof TimeInput>[0]> = {}) {
  const onValueChange = vi.fn<(value: string | null) => void>();
  const screen = await renderDir(
    <TimeInput label="وقت الموعد" onValueChange={onValueChange} {...props} />,
    { dir },
  );
  const group = screen.getByRole('group', { name: 'وقت الموعد' }).element();
  const hour = screen.getByRole('spinbutton', { name: /الساعة|Hour/ }).element() as HTMLElement;
  const minute = screen
    .getByRole('spinbutton', { name: /الدقائق|Minute/ })
    .element() as HTMLElement;
  return { screen, group, hour, minute, onValueChange };
}

describe.each(['rtl', 'ltr'] as const)('Time Input in %s', (dir) => {
  it('types a 24-hour time and reports "HH:mm"', async () => {
    const { hour, onValueChange } = await setup(dir);
    hour.focus();
    await userEvent.keyboard('1430');
    await expect.poll(() => onValueChange.mock.lastCall?.[0], { timeout: 1000 }).toBe('14:30');
  });

  it('accepts Arabic-Indic digits and shows Western ones', async () => {
    const { hour, minute, onValueChange } = await setup(dir);
    hour.focus();
    await userEvent.keyboard('٠٩٤٥');
    await expect.poll(() => onValueChange.mock.lastCall?.[0], { timeout: 1000 }).toBe('09:45');
    // A segment is an input: its text is its value (owner approved this fix, 2026-11-20).
    expect((hour as HTMLInputElement).value).toMatch(/09/);
    expect((minute as HTMLInputElement).value).toMatch(/45/);
  });

  it('keeps hour before minute from left to right in both directions', async () => {
    const { hour, minute } = await setup(dir, { defaultValue: '14:30' });
    expect(hour.getBoundingClientRect().right).toBeLessThanOrEqual(
      minute.getBoundingClientRect().left,
    );
  });

  it('Right goes to the segment on the right, Left back, in both directions', async () => {
    const { hour, minute } = await setup(dir, { defaultValue: '14:30' });
    hour.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(() => document.activeElement).toBe(minute);
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => document.activeElement).toBe(hour);
  });

  it('Up and Down change the focused segment', async () => {
    const { minute, onValueChange } = await setup(dir, { defaultValue: '14:30' });
    minute.focus();
    await userEvent.keyboard('{ArrowUp}');
    await expect.poll(() => onValueChange.mock.lastCall?.[0], { timeout: 1000 }).toBe('14:31');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect.poll(() => onValueChange.mock.lastCall?.[0], { timeout: 1000 }).toBe('14:29');
  });

  it('the 12-hour clock shows a period segment and keeps the value in 24 hours', async () => {
    const { screen, hour } = await setup(dir, { defaultValue: '14:30', hourCycle: 12 });
    expect((hour as HTMLInputElement).value).toMatch(/02|2/);
    const period = screen.getByRole('spinbutton', { name: /ص\/م|AM\/PM/ }).element();
    expect((period as HTMLInputElement).value).toMatch(dir === 'rtl' ? /م/ : /PM/);
    const hidden = screen.container.querySelector<HTMLInputElement>('input[type="hidden"]');
    expect(hidden?.value).toBe('14:30');
  });

  it('shows the focus ring on the box when a segment has keyboard focus', async () => {
    const { hour } = await setup(dir);
    await userEvent.tab();
    expect(document.activeElement).toBe(hour);
    await expectFocusRing(hour);
  });

  it('an error marks it invalid and is read with the group; disabled takes no focus', async () => {
    const first = await setup(dir, { error: 'اختر وقتاً بين 09:00 و17:00' });
    expect(first.group.getAttribute('aria-invalid')).toBe('true');
    expect(described(first.group)).toContain('اختر وقتاً بين 09:00 و17:00');
    // Locators and Tab cover the whole page: the first field goes before the second is drawn,
    // so one Tab passes the disabled field (owner approved this fix, 2026-11-20).
    await first.screen.unmount();
    const screen = await renderDir(
      <>
        <TimeInput label="وقت سابق" defaultValue="14:30" disabled />
        <button type="button">التالي</button>
      </>,
      { dir },
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'التالي' }).element());
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <div className="flex flex-col gap-4">
          <TimeInput label="وقت الموعد" hint="دوام العيادة 09:00 – 17:00" />
          <TimeInput label="وقت المراجعة" defaultValue="19:15" error="خارج الدوام" />
          <TimeInput label="وقت سابق" defaultValue="14:30" disabled />
          <TimeInput label="وقت الوصول" defaultValue="14:30" hourCycle={12} />
        </div>,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
