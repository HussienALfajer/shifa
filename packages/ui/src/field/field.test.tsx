// Field (slice 0.4-05, spec 0.4 criterion 8), as on the approved sheet: the label above names the
// control; a required field has a danger-coloured asterisk that screen readers skip (they hear
// "required" from the control); the hint and then the error, with its warning icon, are read
// with the control; disabled reaches the control; it holds any control of the batch; axe is
// clean, light and dark.
import { describe, expect, it } from 'vitest';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { Input } from '../input/input.tsx';
import { OtpInput } from '../otp-input/otp-input.tsx';
import { Textarea } from '../textarea/textarea.tsx';
import { TimeInput } from '../time-input/time-input.tsx';
import { Field } from './field.tsx';

const described = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

describe.each(['rtl', 'ltr'] as const)('Field in %s', (dir) => {
  it('names its control and reads the hint, then the error', async () => {
    const screen = await renderDir(
      <Field label="رقم الهاتف" hint="يصله التأكيد" error="10 أرقام تبدأ بـ 09" required>
        <Input dir="auto" />
      </Field>,
      { dir },
    );
    const input = screen.getByRole('textbox', { name: 'رقم الهاتف' }).element();
    const text = described(input);
    expect(text.indexOf('يصله التأكيد')).toBeLessThan(text.indexOf('10 أرقام تبدأ بـ 09'));
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect((input as HTMLInputElement).required).toBe(true);
  });

  it('shows the required asterisk in the danger colour, hidden from screen readers', async () => {
    const screen = await renderDir(
      <Field label="اسم المريض" required>
        <Input />
      </Field>,
      { dir },
    );
    const star = screen.getByText('*').element();
    expect(star.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(getComputedStyle(star).color).toBe(tokenColor('--shifa-color-status-danger-fg', star));
    // The accessible name is the label without the asterisk.
    expect(screen.getByRole('textbox', { name: 'اسم المريض' }).element()).toBeTruthy();
  });

  it('shows the error with a warning icon in the danger colour, under the hint', async () => {
    const screen = await renderDir(
      <Field label="اسم المريض" hint="كما في الهوية" error="اكتب اسم المريض">
        <Input />
      </Field>,
      { dir },
    );
    const error = screen.getByText('اكتب اسم المريض').element();
    const row = error.closest('[data-slot="field-error"]') ?? error.parentElement;
    if (row === null) throw new Error('missing: the error row');
    expect(row.querySelector('svg')).not.toBeNull();
    expect(getComputedStyle(row).color).toBe(tokenColor('--shifa-color-status-danger-fg', row));
    const hint = screen.getByText('كما في الهوية').element().getBoundingClientRect();
    expect(row.getBoundingClientRect().top).toBeGreaterThanOrEqual(hint.bottom - 1);
  });

  it('passes disabled to its control', async () => {
    const screen = await renderDir(
      <Field label="اسم المريض" disabled>
        <Input defaultValue="سارة" />
      </Field>,
      { dir },
    );
    expect((screen.getByRole('textbox').element() as HTMLInputElement).disabled).toBe(true);
  });

  it('holds a textarea, an OTP input and a time input', async () => {
    const screen = await renderDir(
      <div className="flex flex-col gap-4">
        <Field label="ملاحظات" hint="للطبيب فقط">
          <Textarea />
        </Field>
        <Field label="رمز التحقق" error="الرمز غير صحيح">
          <OtpInput />
        </Field>
        <Field label="وقت الموعد" error="خارج الدوام">
          <TimeInput />
        </Field>
      </div>,
      { dir },
    );
    expect(described(screen.getByRole('textbox', { name: 'ملاحظات' }).element())).toContain(
      'للطبيب فقط',
    );
    const otp = screen.getByRole('textbox', { name: 'رمز التحقق' }).element();
    expect(otp.getAttribute('aria-invalid')).toBe('true');
    expect(described(otp)).toContain('الرمز غير صحيح');
    const time = screen.getByRole('group', { name: 'وقت الموعد' }).element();
    expect(described(time)).toContain('خارج الدوام');
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <div className="flex flex-col gap-4">
          <Field label="رقم الهاتف" hint="يصله التأكيد" error="10 أرقام تبدأ بـ 09" required>
            <Input dir="auto" defaultValue="0944 12" />
          </Field>
          <Field label="اسم المريض" disabled>
            <Input defaultValue="سارة" />
          </Field>
        </div>,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
