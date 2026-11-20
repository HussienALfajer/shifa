// Reviewer findings of slice 0.4-05, each with a test that fails on the code before its fix:
// B1 an invalid Select or a nested field takes focus on submit; B2 a Checkbox in a required Field
// is required; N1 a standalone control keeps its class; N2 a Checkbox description shows inside a
// Field; N3 a FormField without a label hands its hint and required mark to the control; N5 a
// pasted Arabic-Indic time fills Time Input; N6 an OTP field under a form empties on reset.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { z } from 'zod';
import { DOCTORS } from '../../test/fixtures.ts';
import { renderDir } from '../../test/support/index.ts';
import { Checkbox } from '../checkbox/checkbox.tsx';
import { Field } from '../field/field.tsx';
import { Input } from '../input/input.tsx';
import { OtpInput } from '../otp-input/otp-input.tsx';
import { Radio, RadioGroup } from '../radio/radio.tsx';
import { Select } from '../select/select.tsx';
import { TimeInput } from '../time-input/time-input.tsx';
import { Form, FormField, FormSubmit, type ShifaForm, useShifaForm } from './form.tsx';

const translate = (key: string) => (key === 'validation.required' ? 'هذا الحقل مطلوب' : key);
const doctors = DOCTORS.map((d) => ({ value: d.id, label: d.name }));

const described = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

describe.each(['rtl', 'ltr'] as const)('review fixes in %s', (dir) => {
  it('B1: focuses an invalid Select first', async () => {
    const schema = z.object({
      doctor: z.string({ message: 'validation.required' }).min(1, 'validation.required'),
      name: z.string().min(1, 'validation.required'),
    });
    function Booking() {
      const form = useShifaForm(schema, { defaultValues: { name: '' } });
      return (
        <Form form={form} onSubmit={vi.fn()} translate={translate}>
          <FormField name="doctor">
            {({ value, onValueChange, ...field }) => (
              <Select
                {...field}
                label="الطبيب"
                items={doctors}
                value={(value as string | undefined) ?? null}
                onValueChange={onValueChange}
              />
            )}
          </FormField>
          <FormField name="name" label="الاسم">
            {(field) => <Input {...field} />}
          </FormField>
          <FormSubmit>احجز</FormSubmit>
        </Form>
      );
    }
    const screen = await renderDir(<Booking />, { dir });
    await userEvent.click(screen.getByRole('button', { name: 'احجز' }));
    await expect
      .poll(() =>
        document.activeElement?.closest('[data-form-field]')?.getAttribute('data-form-field'),
      )
      .toBe('doctor');
  });

  it('B1: focuses an invalid nested field and counts nested errors', async () => {
    const schema = z.object({
      address: z.object({
        city: z.string().min(1, 'validation.required'),
        street: z.string().min(1, 'validation.required'),
      }),
    });
    let count = -1;
    function Address() {
      const form = useShifaForm(schema, { defaultValues: { address: { city: '', street: '' } } });
      return (
        <Form
          form={form}
          onSubmit={vi.fn()}
          translate={translate}
          errorSummary={(n) => {
            count = n;
            return String(n);
          }}
        >
          <FormField name="address.city" label="المدينة">
            {(field) => <Input {...field} />}
          </FormField>
          <FormField name="address.street" label="الشارع">
            {(field) => <Input {...field} />}
          </FormField>
          <FormSubmit>حفظ</FormSubmit>
        </Form>
      );
    }
    const screen = await renderDir(<Address />, { dir });
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    await expect
      .poll(() => document.activeElement)
      .toBe(screen.getByRole('textbox', { name: 'المدينة' }).element());
    expect(count).toBe(2);
  });

  it('B2: a Checkbox in a required Field is required', async () => {
    const screen = await renderDir(
      <Field label="الموافقة" required>
        <Checkbox>أوافق على الشروط</Checkbox>
      </Field>,
      { dir },
    );
    const box = screen.getByRole('checkbox').element();
    expect(box.getAttribute('aria-required')).toBe('true');
  });

  it('N1: a standalone control keeps its class', async () => {
    const screen = await renderDir(<Input aria-label="بحث" className="probe-width" />, { dir });
    expect(screen.container.querySelector('.probe-width')).not.toBeNull();
  });

  it('N2: a Checkbox description shows and is read inside a Field', async () => {
    const screen = await renderDir(
      <Field label="الحالة">
        <Checkbox description="تظهر علامة تحذير">حساسية دوائية</Checkbox>
      </Field>,
      { dir },
    );
    await expect.element(screen.getByText('تظهر علامة تحذير')).toBeVisible();
    expect(described(screen.getByRole('checkbox').element())).toContain('تظهر علامة تحذير');
  });

  it('N3: a FormField without a label hands its hint and required mark to the control', async () => {
    const schema = z.object({ sex: z.enum(['female', 'male']) });
    function Sex() {
      const form = useShifaForm(schema);
      return (
        <Form form={form} onSubmit={vi.fn()} translate={translate}>
          <FormField name="sex" required hint="كما في الهوية">
            {({ value, onValueChange, ...field }) => (
              <RadioGroup
                {...field}
                label="الجنس"
                value={(value as string | undefined) ?? null}
                onValueChange={onValueChange}
              >
                <Radio value="female">أنثى</Radio>
                <Radio value="male">ذكر</Radio>
              </RadioGroup>
            )}
          </FormField>
        </Form>
      );
    }
    const screen = await renderDir(<Sex />, { dir });
    const group = screen.getByRole('radiogroup').element();
    expect(described(group)).toContain('كما في الهوية');
    await expect.element(screen.getByText('*')).toBeVisible();
  });

  it('N5: a pasted Arabic-Indic time fills Time Input', async () => {
    const onValueChange = vi.fn<(value: string | null) => void>();
    const screen = await renderDir(<TimeInput label="وقت" onValueChange={onValueChange} />, {
      dir,
    });
    const hour = screen.getByRole('spinbutton', { name: /الساعة|Hour/ }).element();
    (hour as HTMLElement).focus();
    const data = new DataTransfer();
    data.setData('text/plain', '١٤:٣٠');
    hour.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
    await expect.poll(() => onValueChange.mock.lastCall?.[0]).toBe('14:30');
  });

  it('N6: an OTP field under a form empties when the form resets it', async () => {
    const schema = z.object({ code: z.string().optional() });
    let api: ShifaForm<z.input<typeof schema>, z.output<typeof schema>> | undefined;
    function Code() {
      const form = useShifaForm(schema);
      api = form;
      return (
        <Form form={form} onSubmit={vi.fn()} translate={translate}>
          <FormField name="code" label="رمز التحقق">
            {(field) => <OtpInput {...field} />}
          </FormField>
        </Form>
      );
    }
    const screen = await renderDir(<Code />, { dir });
    const input = screen.getByRole('textbox', { name: 'رمز التحقق' }).element() as HTMLInputElement;
    input.focus();
    await userEvent.keyboard('482');
    await expect.poll(() => input.value).toBe('482');
    api?.reset();
    await expect.poll(() => input.value).toBe('');
  });
});
