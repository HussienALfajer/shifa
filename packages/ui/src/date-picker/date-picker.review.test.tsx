// Review fixes for slice 0.4-13 (reviewer, 2026-11-23), both directions: B1 a typed date outside
// min/max is never the value; B2 a form reset empties the segments; B3 `required` is on each
// spinbutton and axe stays clean; N2 Alt+Down from a segment opens the calendar; N3 Escape on the
// heading closes the panel and keeps the popup; N4 Up from an impossible day goes to 01; N7 a
// separator typed right after a segment filled itself is skipped when editing a full date.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { z } from 'zod';
import { expectAxeClean, renderDir } from '../../test/support/index.ts';
import { Form, FormField, type ShifaForm, useShifaForm } from '../form/form.tsx';
import { DatePicker } from './date-picker.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const LABEL = 'تاريخ الميلاد';
const NAMES = {
  rtl: { day: 'اليوم', month: 'الشهر', year: 'السنة' },
  ltr: { day: 'Day', month: 'Month', year: 'Year' },
} as const;
type Unit = 'day' | 'month' | 'year';

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

async function setup(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof DatePicker>[0]> = {}) {
  const onValueChange = vi.fn<(value: string | null) => void>();
  const screen = await renderDir(
    <div className="flex flex-col gap-4 p-16">
      <DatePicker label={LABEL} onValueChange={onValueChange} {...props} />
      <button type="button">بعده</button>
    </div>,
    { dir },
  );
  const get = (unit: Unit) =>
    screen.getByRole('spinbutton', { name: NAMES[dir][unit] }).element() as HTMLInputElement;
  return { screen, day: get('day'), month: get('month'), year: get('year'), onValueChange };
}

describe.each(DIRS)('Date Picker review fixes in %s', (dir) => {
  it('B1: a typed date after max or before min is never the value', async () => {
    const late = await setup(dir, { max: '2026-11-23' });
    late.day.focus();
    await userEvent.keyboard('02012027');
    await userEvent.click(late.screen.getByRole('button', { name: 'بعده' }));
    expect(late.onValueChange.mock.calls.flat()).not.toContain('2027-01-02');
    await late.screen.unmount();
    const early = await setup(dir, { min: '2026-11-23' });
    early.day.focus();
    await userEvent.keyboard('22112026');
    expect(early.onValueChange.mock.calls.flat()).not.toContain('2026-11-22');
    // A date in range is still the value.
    early.day.focus();
    await userEvent.keyboard('24112026');
    await poll(() => early.onValueChange.mock.lastCall?.[0], 'in range').toBe('2026-11-24');
  });

  it('B2: a form reset empties the segments', async () => {
    const schema = z.object({ birth: z.string().nullable().optional() });
    let api: ShifaForm<z.input<typeof schema>, z.output<typeof schema>> | undefined;
    function Birth() {
      const form = useShifaForm(schema);
      api = form;
      return (
        <Form form={form} onSubmit={vi.fn()} translate={(key) => key}>
          <FormField name="birth">{(field) => <DatePicker label={LABEL} {...field} />}</FormField>
        </Form>
      );
    }
    const screen = await renderDir(<Birth />, { dir });
    const day = screen
      .getByRole('spinbutton', { name: NAMES[dir].day })
      .element() as HTMLInputElement;
    const year = screen
      .getByRole('spinbutton', { name: NAMES[dir].year })
      .element() as HTMLInputElement;
    day.focus();
    await userEvent.keyboard('14031987');
    await poll(() => year.value, 'typed').toBe('1987');
    api?.reset();
    await poll(() => [day.value, year.value], 'emptied').toEqual(['', '']);
  });

  it('B3: required marks each segment, and axe stays clean', async () => {
    const s = await setup(dir, { required: true });
    for (const el of [s.day, s.month, s.year]) {
      expect(el.getAttribute('aria-required')).toBe('true');
    }
    const group = s.screen.getByRole('group', { name: LABEL }).element();
    expect(group.hasAttribute('aria-required')).toBe(false);
    await expectAxeClean(s.screen.container);
  });

  it('N2: Alt+Down from a segment opens the calendar', async () => {
    const s = await setup(dir, { defaultValue: '2026-11-24' });
    s.month.focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await expect.element(s.screen.getByRole('grid')).toBeVisible();
  });

  it('N3: Escape on the heading closes the panel and keeps the popup', async () => {
    const s = await setup(dir, { defaultValue: '2026-11-24' });
    await userEvent.click(s.screen.getByRole('button', { name: 'فتح التقويم' }));
    const heading = s.screen.getByRole('button', {
      name: dir === 'rtl' ? 'تشرين الثاني 2026' : 'November 2026',
    });
    await userEvent.click(heading);
    await expect.element(s.screen.getByRole('listbox')).toBeVisible();
    heading.element().focus();
    await userEvent.keyboard('{Escape}');
    await expect.element(s.screen.getByRole('listbox')).not.toBeInTheDocument();
    await expect.element(s.screen.getByRole('dialog')).toBeVisible();
  });

  it('N4: Up from an impossible day goes to the first day', async () => {
    const s = await setup(dir);
    s.day.focus();
    await userEvent.keyboard('31021987');
    s.day.focus();
    await userEvent.keyboard('{ArrowUp}');
    await poll(() => s.day.value, 'wrapped to 01').toBe('01');
  });

  it('N7: a separator right after a segment filled itself is skipped', async () => {
    const s = await setup(dir, { defaultValue: '1987-03-14' });
    s.day.focus();
    await userEvent.keyboard('25/04/1990');
    await poll(() => s.onValueChange.mock.lastCall?.[0], 'all three replaced').toBe('1990-04-25');
  });
});
