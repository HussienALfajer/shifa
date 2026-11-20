// RTL gate (spec 0.4 criterion 7, slice 0.4-04): Number Input in Arabic RTL and English LTR. It
// accepts Arabic-Indic and Western digits and keeps Western ones (OD-20); Up and Down step by
// one and Page Up and Page Down by ten; the stepper at the maximum is disabled; «إنقاص» sits at
// the logical start and «زيادة» at the end; a large amount shows comma grouping (OD-61) and a
// unit at the end; an error is read with the field; axe is clean. Popup side and typeahead do not
// apply (n/a).
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, expectDigitsAccepted, renderDir } from '../../test/support/index.ts';
import { NumberInput } from './number-input.tsx';

const DIRS = ['rtl', 'ltr'] as const;

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

async function setup(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof NumberInput>[0]> = {}) {
  const onValueChange = vi.fn();
  const screen = await renderDir(
    <NumberInput label="عدد الجلسات" defaultValue={3} onValueChange={onValueChange} {...props} />,
    { dir },
  );
  const input = screen
    .getByRole('spinbutton', { name: 'عدد الجلسات' })
    .element() as HTMLInputElement;
  return { screen, input, onValueChange };
}

describe.each(DIRS)('Number Input gate in %s', (dir) => {
  it('accepts Arabic-Indic and Western digits and keeps Western ones', async () => {
    const { input } = await setup(dir, { defaultValue: null });
    await expectDigitsAccepted({ input, stored: () => input.value });
  });

  it('reports the typed Arabic-Indic number as a number', async () => {
    const { input, onValueChange } = await setup(dir, { defaultValue: null });
    await userEvent.clear(input);
    await userEvent.type(input, '١٢');
    await userEvent.tab();
    await poll(() => onValueChange.mock.lastCall?.[0], 'value 12').toBe(12);
    expect(input.value).toBe('12');
  });

  it('Up and Down step by one; Page Up and Page Down by ten', async () => {
    const { input, onValueChange } = await setup(dir, { min: 0, max: 100 });
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    await poll(() => input.value, 'up').toBe('4');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await poll(() => input.value, 'down twice').toBe('2');
    await userEvent.keyboard('{PageUp}');
    await poll(() => input.value, 'page up').toBe('12');
    await userEvent.keyboard('{PageDown}');
    await poll(() => input.value, 'page down').toBe('2');
    expect(onValueChange).toHaveBeenLastCalledWith(2);
  });

  it('the steppers change the value; the one past the limit is disabled', async () => {
    const { screen, input } = await setup(dir, { defaultValue: 19, max: 20 });
    const increase = screen.getByRole('button', { name: 'زيادة' });
    await userEvent.click(increase);
    await poll(() => input.value, 'up to the maximum').toBe('20');
    await expect.element(increase).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'إنقاص' }));
    await poll(() => input.value, 'down').toBe('19');
  });

  it('puts «إنقاص» at the logical start and «زيادة» at the logical end', async () => {
    const { screen, input } = await setup(dir);
    const dec = screen.getByRole('button', { name: 'إنقاص' }).element().getBoundingClientRect();
    const inc = screen.getByRole('button', { name: 'زيادة' }).element().getBoundingClientRect();
    const box = input.getBoundingClientRect();
    if (dir === 'rtl') {
      expect(dec.left).toBeGreaterThanOrEqual(box.right - 1);
      expect(inc.right).toBeLessThanOrEqual(box.left + 1);
    } else {
      expect(dec.right).toBeLessThanOrEqual(box.left + 1);
      expect(inc.left).toBeGreaterThanOrEqual(box.right - 1);
    }
    // Each stepper is a 44 px touch target in the comfortable density.
    expect(dec.width).toBeGreaterThanOrEqual(44);
  });

  it('a large amount shows Western digits with comma grouping and its unit at the end', async () => {
    const screen = await renderDir(
      <NumberInput label="أجر المعاينة" defaultValue={125000} unit="ل.س" steppers={false} />,
      { dir },
    );
    const input = screen
      .getByRole('spinbutton', { name: /أجر المعاينة/ })
      .element() as HTMLInputElement;
    expect(input.value).toBe('125,000');
    expect(screen.getByRole('button').query()).toBeNull();
    const unit = screen.getByText('ل.س').element().getBoundingClientRect();
    const box = input.getBoundingClientRect();
    if (dir === 'rtl') expect(unit.right).toBeLessThanOrEqual(box.left + 1);
    else expect(unit.left).toBeGreaterThanOrEqual(box.right - 1);
  });

  it('an error marks the field and is read with it', async () => {
    const { input } = await setup(dir, { error: 'العدد بين 1 و20' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ')).toContain(
      'العدد بين 1 و20',
    );
  });

  it('disabled: no typing, no stepping', async () => {
    const { screen, input } = await setup(dir, { disabled: true });
    expect(input.disabled).toBe(true);
    await expect.element(screen.getByRole('button', { name: 'زيادة' })).toBeDisabled();
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <div className="flex flex-col gap-4">
          <NumberInput label="عدد الجلسات" defaultValue={3} />
          <NumberInput label="العمر" defaultValue={140} error="العمر بين 0 و120" />
          <NumberInput label="أجر المعاينة" defaultValue={125000} unit="ل.س" steppers={false} />
        </div>,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
