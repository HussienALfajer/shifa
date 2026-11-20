// Radio (slice 0.4-05, spec 0.4 criterion 8), as on the approved sheet: a named group with one
// tab stop (the checked option, else the first); in a horizontal group the arrow keys follow the
// reading direction (Left is the next option in Arabic) and check as they move; a disabled
// option is skipped; the group's error is read with it; axe is clean, light and dark.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  arrows,
  expectArrow,
  expectAxeClean,
  expectFocusRing,
  renderDir,
} from '../../test/support/index.ts';
import { Radio, RadioGroup } from './radio.tsx';

const described = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

/** `value`, or a failed test when it is missing. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing: ${what}`);
  return value;
}

function Visit(props: Partial<Parameters<typeof RadioGroup>[0]>) {
  return (
    <RadioGroup label="نوع الزيارة" {...props}>
      <Radio value="exam">كشف</Radio>
      <Radio value="review">مراجعة</Radio>
      <Radio value="home" disabled>
        زيارة منزلية
      </Radio>
      <Radio value="emergency">إسعاف</Radio>
    </RadioGroup>
  );
}

describe.each(['rtl', 'ltr'] as const)('Radio in %s', (dir) => {
  it('is a named group with one tab stop, on the checked option', async () => {
    const screen = await renderDir(
      <>
        <Visit defaultValue="review" />
        <button type="button">التالي</button>
      </>,
      { dir },
    );
    expect(screen.getByRole('radiogroup', { name: 'نوع الزيارة' }).element()).toBeTruthy();
    await userEvent.tab();
    const review = screen.getByRole('radio', { name: 'مراجعة' }).element();
    expect(document.activeElement).toBe(review);
    await expectFocusRing(review);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button').element());
  });

  it('with nothing checked, Tab lands on the first option', async () => {
    const screen = await renderDir(<Visit />, { dir });
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'كشف' }).element());
  });

  it('in a horizontal group the arrows follow the reading direction and check', async () => {
    const onValueChange = vi.fn<(value: string) => void>();
    const screen = await renderDir(
      <RadioGroup label="الجنس" orientation="horizontal" onValueChange={onValueChange}>
        <Radio value="female">أنثى</Radio>
        <Radio value="male">ذكر</Radio>
      </RadioGroup>,
      { dir },
    );
    const items = screen.getByRole('radio').elements();
    await expectArrow({ dir, items });
    expect(onValueChange.mock.calls.map((c) => c[0])).toEqual(['male', 'female']);
    // The second option sits toward the reading end: left of the first in Arabic.
    const [a, b] = items.map((el) => el.getBoundingClientRect());
    const [first, second] = [must(a, 'first option'), must(b, 'second option')];
    if (dir === 'rtl') expect(second.right).toBeLessThanOrEqual(first.left);
    else expect(second.left).toBeGreaterThanOrEqual(first.right);
  });

  it('skips a disabled option and wraps from the last to the first', async () => {
    const screen = await renderDir(<Visit defaultValue="review" />, { dir });
    const review = screen.getByRole('radio', { name: 'مراجعة' }).element() as HTMLElement;
    review.focus();
    await userEvent.keyboard('{ArrowDown}');
    const emergency = screen.getByRole('radio', { name: 'إسعاف' });
    await expect.poll(() => document.activeElement).toBe(emergency.element());
    await expect.element(emergency).toBeChecked();
    await userEvent.keyboard(`{${arrows(dir).forward}}`);
    await expect
      .poll(() => document.activeElement)
      .toBe(screen.getByRole('radio', { name: 'كشف' }).element());
  });

  it('reads the group error and marks the group invalid', async () => {
    const screen = await renderDir(<Visit error="اختر نوع الزيارة" required />, { dir });
    const group = screen.getByRole('radiogroup').element();
    expect(group.getAttribute('aria-invalid')).toBe('true');
    expect(described(group)).toContain('اختر نوع الزيارة');
  });

  it('a disabled group takes no focus', async () => {
    const screen = await renderDir(
      <>
        <Visit disabled defaultValue="exam" />
        <button type="button">التالي</button>
      </>,
      { dir },
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button').element());
  });

  it('submits the checked value under its name', async () => {
    const screen = await renderDir(
      <form>
        <Visit name="visit" defaultValue="exam" />
      </form>,
      { dir },
    );
    const form = must(screen.container.querySelector('form'), 'form');
    expect(new FormData(form).get('visit')).toBe('exam');
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <div className="flex flex-col gap-4">
          <Visit defaultValue="exam" hint="الكشف أول زيارة" />
          <Visit error="اختر نوع الزيارة" />
          <RadioGroup label="الجنس" orientation="horizontal" defaultValue="female">
            <Radio value="female">أنثى</Radio>
            <Radio value="male" description="للبالغين">
              ذكر
            </Radio>
          </RadioGroup>
        </div>,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
