// Input (slice 0.4-05, spec 0.4 criterion 8), as on the approved sheet (owner, 2026-11-20,
// "Inputs and forms · 0.4-05"): named by its label, keyboard focus shows the ring on the box,
// disabled leaves the tab order, read-only keeps the text but takes no typing, an error is read
// with the field, Latin content takes dir="auto"; axe is clean, light and dark.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  expectAxeClean,
  expectFocusRing,
  renderDir,
  typeArabic,
} from '../../test/support/index.ts';
import { Field } from '../field/field.tsx';
import { Input } from './input.tsx';

const described = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

describe.each(['rtl', 'ltr'] as const)('Input in %s', (dir) => {
  it('is named by its label and keeps typed Arabic text', async () => {
    const onValueChange = vi.fn();
    const screen = await renderDir(<Input label="اسم المريض" onValueChange={onValueChange} />, {
      dir,
    });
    const input = screen.getByRole('textbox', { name: 'اسم المريض' }).element() as HTMLInputElement;
    await typeArabic(input, 'سارة');
    expect(onValueChange).toHaveBeenLastCalledWith('سارة');
  });

  it('shows the focus ring on keyboard focus', async () => {
    const screen = await renderDir(<Input label="اسم المريض" />, { dir });
    await userEvent.tab();
    const input = screen.getByRole('textbox').element();
    expect(document.activeElement).toBe(input);
    await expectFocusRing(input);
  });

  it('disabled: out of the tab order and not editable', async () => {
    const screen = await renderDir(
      <>
        <Input label="اسم المريض" defaultValue="سارة" disabled />
        <button type="button">التالي</button>
      </>,
      { dir },
    );
    const input = screen.getByRole('textbox').element() as HTMLInputElement;
    expect(input.disabled).toBe(true);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button').element());
  });

  it('read-only: focusable, keeps its text, takes no typing', async () => {
    const screen = await renderDir(<Input label="رقم الملف" defaultValue="1042" readOnly />, {
      dir,
    });
    const input = screen.getByRole('textbox', { name: 'رقم الملف' }).element() as HTMLInputElement;
    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard('9');
    expect(input.value).toBe('1042');
    expect(input.readOnly).toBe(true);
  });

  it('an error marks it invalid and is read with it, after the hint', async () => {
    const screen = await renderDir(
      <Input label="اسم المريض" hint="كما في الهوية" error="اكتب اسم المريض" required />,
      { dir },
    );
    const input = screen.getByRole('textbox').element();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(described(input)).toContain('كما في الهوية');
    expect(described(input)).toContain('اكتب اسم المريض');
    expect((input as HTMLInputElement).required).toBe(true);
  });

  it('without an error it is not invalid', async () => {
    const screen = await renderDir(<Input label="اسم المريض" hint="كما في الهوية" />, { dir });
    const input = screen.getByRole('textbox').element();
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('dir="auto" for Latin content (phone, email, medicine)', async () => {
    const screen = await renderDir(
      <Input label="البريد" type="email" dir="auto" defaultValue="sara.ahmad@example.com" />,
      { dir },
    );
    expect(screen.getByRole('textbox').element().getAttribute('dir')).toBe('auto');
  });

  it('works inside a Field, which names it and reads its hint and error', async () => {
    const screen = await renderDir(
      <Field label="الهاتف" hint="يصله التأكيد" error="10 أرقام تبدأ بـ 09">
        <Input dir="auto" />
      </Field>,
      { dir },
    );
    const input = screen.getByRole('textbox', { name: 'الهاتف' }).element();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(described(input)).toContain('يصله التأكيد');
    expect(described(input)).toContain('10 أرقام تبدأ بـ 09');
  });

  it('works outside a Field with its own accessible name', async () => {
    const screen = await renderDir(<Input aria-label="بحث" startIcon="magnifying-glass" />, {
      dir,
    });
    expect(screen.getByRole('textbox', { name: 'بحث' }).element()).toBeTruthy();
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <div className="flex flex-col gap-4">
          <Input label="اسم المريض" placeholder="مثال: سارة الأحمد" />
          <Input label="اسم المريض" defaultValue="سارة" error="اكتب الاسم كاملاً" required />
          <Input label="اسم المريض" defaultValue="سارة" disabled />
          <Input label="رقم الملف" defaultValue="1042" readOnly />
          <Input label="بحث" startIcon="magnifying-glass" hint="يكفي جزء من الاسم" />
        </div>,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
