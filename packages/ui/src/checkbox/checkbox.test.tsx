// Checkbox (slice 0.4-05, spec 0.4 criterion 8), as on the approved sheet: the 20 px mark at the
// logical start, the text after it, the whole line a 44 px target; Space and a press on the text
// toggle; indeterminate is "mixed"; the ring is on the mark; disabled leaves the tab order; an
// error is read with it; axe is clean, light and dark.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, expectFocusRing, renderDir } from '../../test/support/index.ts';
import { Checkbox } from './checkbox.tsx';

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

describe.each(['rtl', 'ltr'] as const)('Checkbox in %s', (dir) => {
  it('is named by its text; Space and a press on the text toggle it', async () => {
    const onCheckedChange = vi.fn<(checked: boolean) => void>();
    const screen = await renderDir(
      <Checkbox onCheckedChange={onCheckedChange}>مريض جديد</Checkbox>,
      { dir },
    );
    const box = screen.getByRole('checkbox', { name: 'مريض جديد' });
    await expect.element(box).not.toBeChecked();
    await userEvent.tab();
    expect(document.activeElement).toBe(box.element());
    await expectFocusRing(box.element());
    await userEvent.keyboard(' ');
    await expect.element(box).toBeChecked();
    await userEvent.click(screen.getByText('مريض جديد'));
    await expect.element(box).not.toBeChecked();
    expect(onCheckedChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it('puts the mark at the logical start and makes the line a 44 px target', async () => {
    const screen = await renderDir(<Checkbox>مريض جديد</Checkbox>, { dir });
    const mark = screen.getByRole('checkbox').element().getBoundingClientRect();
    const text = screen.getByText('مريض جديد').element().getBoundingClientRect();
    if (dir === 'rtl') expect(mark.left).toBeGreaterThanOrEqual(text.right);
    else expect(mark.right).toBeLessThanOrEqual(text.left);
    const line = screen.getByText('مريض جديد').element().closest('label')?.getBoundingClientRect();
    expect(line?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  it('indeterminate is "mixed" and a press makes it checked', async () => {
    const screen = await renderDir(<Checkbox defaultChecked="indeterminate">تحديد الكل</Checkbox>, {
      dir,
    });
    const box = screen.getByRole('checkbox', { name: 'تحديد الكل' });
    await expect.element(box).toHaveAttribute('aria-checked', 'mixed');
    await userEvent.click(box);
    await expect.element(box).toHaveAttribute('aria-checked', 'true');
  });

  it('reads its description and error with it', async () => {
    const screen = await renderDir(
      <Checkbox description="تظهر علامة تحذير في ملفه" error="الموافقة مطلوبة للحجز" required>
        أوافق على شروط الحجز
      </Checkbox>,
      { dir },
    );
    const box = screen.getByRole('checkbox', { name: 'أوافق على شروط الحجز' }).element();
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(described(box)).toContain('تظهر علامة تحذير في ملفه');
    expect(described(box)).toContain('الموافقة مطلوبة للحجز');
  });

  it('disabled: out of the tab order and not toggled', async () => {
    const screen = await renderDir(
      <>
        <Checkbox disabled defaultChecked>
          مريض جديد
        </Checkbox>
        <button type="button">التالي</button>
      </>,
      { dir },
    );
    const box = screen.getByRole('checkbox');
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button').element());
    await userEvent.click(screen.getByText('مريض جديد'), { force: true });
    await expect.element(box).toBeChecked();
    await expect.element(box).toBeDisabled();
  });

  it('submits its value under its name when checked', async () => {
    const screen = await renderDir(
      <form>
        <Checkbox name="newPatient" value="yes" defaultChecked>
          مريض جديد
        </Checkbox>
      </form>,
      { dir },
    );
    const form = must(screen.container.querySelector('form'), 'form');
    expect(new FormData(form).get('newPatient')).toBe('yes');
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <div className="flex flex-col">
          <Checkbox>مريض جديد</Checkbox>
          <Checkbox defaultChecked>مريض جديد</Checkbox>
          <Checkbox defaultChecked="indeterminate">تحديد الكل</Checkbox>
          <Checkbox error="الموافقة مطلوبة">أوافق على الشروط</Checkbox>
          <Checkbox disabled defaultChecked>
            مريض قديم
          </Checkbox>
          <Checkbox description="تظهر علامة تحذير في ملفه">مريض لديه حساسية دوائية</Checkbox>
        </div>,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
