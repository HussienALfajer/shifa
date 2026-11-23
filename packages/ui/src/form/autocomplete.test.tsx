// Staff fields store nothing in the browser (slice 0.4-12, criterion 7, OD-67): Input, Textarea
// and FormField default to autocomplete="off", so a shared clinic computer never offers one
// patient's details while another is typed. A field opts in with an explicit token (name, tel,
// bday…), used only on the patient's own booking forms. PasswordInput and OtpInput keep their
// tokens.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { renderDir } from '../../test/support/index.ts';
import { Checkbox } from '../checkbox/checkbox.tsx';
import { Input } from '../input/input.tsx';
import { PasswordInput } from '../password-input/password-input.tsx';
import { Textarea } from '../textarea/textarea.tsx';
import { Form, FormField, useShifaForm } from './form.tsx';

const autocompleteOf = (selector: string) =>
  document.querySelector(selector)?.getAttribute('autocomplete');

describe('autocomplete defaults (OD-67)', () => {
  it('Input is off by default and takes an explicit token', async () => {
    let screen = await renderDir(<Input label="الاسم" />);
    expect(autocompleteOf('input')).toBe('off');
    await screen.unmount();
    screen = await renderDir(<Input label="الهاتف" type="tel" autoComplete="tel" />);
    expect(autocompleteOf('input')).toBe('tel');
    await screen.unmount();
  });

  it('Textarea is off by default and takes an explicit token', async () => {
    let screen = await renderDir(<Textarea label="ملاحظات" />);
    expect(autocompleteOf('textarea')).toBe('off');
    await screen.unmount();
    screen = await renderDir(<Textarea label="العنوان" autoComplete="street-address" />);
    expect(autocompleteOf('textarea')).toBe('street-address');
    await screen.unmount();
  });

  it('PasswordInput says current-password by default, new-password when asked', async () => {
    let screen = await renderDir(<PasswordInput label="كلمة المرور" />);
    expect(autocompleteOf('input')).toBe('current-password');
    await screen.unmount();
    screen = await renderDir(<PasswordInput label="كلمة المرور" autoComplete="new-password" />);
    expect(autocompleteOf('input')).toBe('new-password');
    await screen.unmount();
  });
});

const schema = z.object({ name: z.string(), birth: z.string(), consent: z.boolean() });

function Fields() {
  const form = useShifaForm(schema, {
    defaultValues: { name: '', birth: '', consent: false },
  });
  return (
    <Form form={form} onSubmit={() => undefined} translate={(key) => key}>
      <FormField name="name" label="الاسم">
        {(field) => <Input {...field} />}
      </FormField>
      <FormField name="birth" label="تاريخ الميلاد" autoComplete="bday">
        {(field) => <Input {...field} />}
      </FormField>
      <FormField name="consent">
        {(field) => (
          <Checkbox
            checked={Boolean(field.value)}
            onCheckedChange={field.onValueChange}
            name={field.name}
          >
            أوافق
          </Checkbox>
        )}
      </FormField>
    </Form>
  );
}

describe('FormField (OD-67)', () => {
  it('hands its control autocomplete="off", or the token it is given', async () => {
    const screen = await renderDir(<Fields />);
    expect(autocompleteOf('input[name="name"]')).toBe('off');
    expect(autocompleteOf('input[name="birth"]')).toBe('bday');
    await screen.unmount();
  });
});
