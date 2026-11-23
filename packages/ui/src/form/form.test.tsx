// Form (slice 0.4-05, spec 0.4 criterion 8): a thin layer over React Hook Form with a Zod
// resolver. A Zod error is an i18n key, translated by the app's `translate`, and shown under the
// right field with aria-invalid and aria-describedby; on submit the first invalid field (in the
// order of the page) takes focus; nothing is submitted while a field is invalid; an async submit
// keeps the button busy and ignores a second press; a corrected field loses its error.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { z } from 'zod';
import { PATIENT_GIVEN, PHONE } from '../../test/fixtures.ts';
import { expectAxeClean, renderDir } from '../../test/support/index.ts';
import { Checkbox } from '../checkbox/checkbox.tsx';
import { Input } from '../input/input.tsx';
import { Radio, RadioGroup } from '../radio/radio.tsx';
import { Form, FormField, FormSubmit, useShifaForm } from './form.tsx';

/** A synthetic number as typed, without spaces (the schema wants 09 and 8 digits). */
const PHONE_DIGITS = PHONE.replaceAll(' ', '');

const MESSAGES: Record<string, string> = {
  'validation.required': 'هذا الحقل مطلوب',
  'validation.phone': '10 أرقام تبدأ بـ 09',
  'validation.consent': 'الموافقة مطلوبة للتسجيل',
  'validation.summary': 'حقول تحتاج إلى تصحيح',
};
const translate = (key: string) => MESSAGES[key] ?? key;

const schema = z.object({
  name: z.string().min(1, 'validation.required'),
  phone: z.string().regex(/^09\d{8}$/, 'validation.phone'),
  sex: z.enum(['female', 'male'], { message: 'validation.required' }),
  consent: z.literal(true, { message: 'validation.consent' }),
});
type Values = z.infer<typeof schema>;

const described = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

function Registration({
  onSubmit,
  defaults = {},
}: {
  onSubmit: (values: Values) => unknown;
  defaults?: Partial<Record<keyof Values, unknown>>;
}) {
  const form = useShifaForm(schema, {
    defaultValues: { name: '', phone: '', consent: false, ...defaults } as Partial<Values>,
  });
  return (
    <Form form={form} onSubmit={onSubmit} translate={translate} aria-label="تسجيل مريض جديد">
      <FormField name="name" label="الاسم الكامل" required>
        {(field) => <Input {...field} />}
      </FormField>
      <FormField name="phone" label="رقم الهاتف" required>
        {(field) => <Input {...field} dir="auto" inputMode="tel" />}
      </FormField>
      <FormField name="sex">
        {({ value, onValueChange, ...field }) => (
          <RadioGroup
            {...field}
            label="الجنس"
            orientation="horizontal"
            value={(value as string | undefined) ?? null}
            onValueChange={onValueChange}
          >
            <Radio value="female">أنثى</Radio>
            <Radio value="male">ذكر</Radio>
          </RadioGroup>
        )}
      </FormField>
      <FormField name="consent">
        {({ value, onValueChange, ...field }) => (
          <Checkbox {...field} checked={value === true} onCheckedChange={onValueChange}>
            أوافق على حفظ بياناتي
          </Checkbox>
        )}
      </FormField>
      <FormSubmit>سجّل</FormSubmit>
    </Form>
  );
}

describe.each(['rtl', 'ltr'] as const)('Form in %s', (dir) => {
  it('blocks the submit and shows each translated error under its field', async () => {
    const onSubmit = vi.fn();
    const screen = await renderDir(
      <Registration onSubmit={onSubmit} defaults={{ name: PATIENT_GIVEN }} />,
      {
        dir,
      },
    );
    await userEvent.click(screen.getByRole('button', { name: 'سجّل' }));
    const phone = screen.getByRole('textbox', { name: 'رقم الهاتف' }).element();
    await expect.poll(() => phone.getAttribute('aria-invalid')).toBe('true');
    expect(described(phone)).toContain('10 أرقام تبدأ بـ 09');
    const name = screen.getByRole('textbox', { name: 'الاسم الكامل' }).element();
    expect(name.getAttribute('aria-invalid')).not.toBe('true');
    expect(described(screen.getByRole('radiogroup', { name: 'الجنس' }).element())).toContain(
      'هذا الحقل مطلوب',
    );
    expect(described(screen.getByRole('checkbox').element())).toContain('الموافقة مطلوبة للتسجيل');
    // Keys never reach the page; only their messages do.
    expect(screen.container.textContent).not.toContain('validation.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('moves focus to the first invalid field on submit', async () => {
    const screen = await renderDir(
      <Registration onSubmit={vi.fn()} defaults={{ name: PATIENT_GIVEN }} />,
      {
        dir,
      },
    );
    await userEvent.click(screen.getByRole('button', { name: 'سجّل' }));
    await expect
      .poll(() => document.activeElement)
      .toBe(screen.getByRole('textbox', { name: 'رقم الهاتف' }).element());
  });

  it('focuses a radio of an invalid group when the group is the first invalid field', async () => {
    const screen = await renderDir(
      <Registration onSubmit={vi.fn()} defaults={{ name: PATIENT_GIVEN, phone: PHONE_DIGITS }} />,
      { dir },
    );
    await userEvent.click(screen.getByRole('button', { name: 'سجّل' }));
    await expect
      .poll(() => document.activeElement)
      .toBe(screen.getByRole('radio', { name: 'أنثى' }).element());
  });

  it('clears a field error once it is corrected, and submits the parsed values', async () => {
    const onSubmit = vi.fn();
    const screen = await renderDir(
      <Registration
        onSubmit={onSubmit}
        defaults={{ name: PATIENT_GIVEN, phone: '0944', sex: 'female', consent: true }}
      />,
      { dir },
    );
    await userEvent.click(screen.getByRole('button', { name: 'سجّل' }));
    const phone = screen.getByRole('textbox', { name: 'رقم الهاتف' }).element() as HTMLInputElement;
    await expect.poll(() => phone.getAttribute('aria-invalid')).toBe('true');
    await userEvent.clear(phone);
    await userEvent.type(phone, PHONE_DIGITS);
    await expect.poll(() => phone.getAttribute('aria-invalid')).not.toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'سجّل' }));
    await expect.poll(() => onSubmit.mock.calls.length).toBe(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      name: PATIENT_GIVEN,
      phone: PHONE_DIGITS,
      sex: 'female',
      consent: true,
    });
  });

  it('an async submit keeps the button busy and ignores a second press', async () => {
    let finish: () => void = () => undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const screen = await renderDir(
      <Registration
        onSubmit={onSubmit}
        defaults={{ name: PATIENT_GIVEN, phone: PHONE_DIGITS, sex: 'male', consent: true }}
      />,
      { dir },
    );
    const button = screen.getByRole('button', { name: 'سجّل' });
    await userEvent.click(button);
    await expect.element(button).toHaveAttribute('aria-disabled', 'true');
    await expect.element(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button, { force: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    finish();
    await expect.element(button).not.toHaveAttribute('aria-busy', 'true');
  });

  it('is clean under axe with its errors shown, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<Registration onSubmit={vi.fn()} />, { dir, theme });
      await userEvent.click(screen.getByRole('button', { name: 'سجّل' }));
      await expect
        .poll(() =>
          screen
            .getByRole('textbox', { name: 'رقم الهاتف' })
            .element()
            .getAttribute('aria-invalid'),
        )
        .toBe('true');
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
