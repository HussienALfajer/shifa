// Form stories, as on the approved sheet's last frame (owner, 2026-11-20): a registration form
// that checks a Zod schema whose messages are i18n keys. The play story submits it empty and
// shows the errors, the summary and the focus on the first invalid field.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { z } from 'zod';
import { storyStates } from '../../.storybook/story-states.tsx';
import { PATIENT_GIVEN } from '../../test/fixtures.ts';
import { Checkbox } from '../checkbox/checkbox.tsx';
import { Input } from '../input/input.tsx';
import { PasswordInput } from '../password-input/password-input.tsx';
import { Radio, RadioGroup } from '../radio/radio.tsx';
import { Switch } from '../switch/switch.tsx';
import { Textarea } from '../textarea/textarea.tsx';
import { TimeInput } from '../time-input/time-input.tsx';
import { Form, FormField, FormSubmit, useShifaForm } from './form.tsx';

/** Stand-ins for the app's translations (the app passes i18next's `t`). */
const MESSAGES: Record<string, string> = {
  'validation.required': 'هذا الحقل مطلوب',
  'validation.phone': '10 أرقام تبدأ بـ 09',
  'validation.consent': 'الموافقة مطلوبة للتسجيل',
  'validation.password': '8 أحرف على الأقل',
};
const translate = (key: string) => MESSAGES[key] ?? key;

const registration = z.object({
  name: z.string().min(1, 'validation.required'),
  phone: z.string().regex(/^09\d{8}$/, 'validation.phone'),
  sex: z.enum(['female', 'male'], { message: 'validation.required' }),
  time: z.string().nullable(),
  notes: z.string(),
  reminders: z.boolean(),
  consent: z.boolean().refine((agreed) => agreed, { message: 'validation.consent' }),
});

function Registration() {
  const form = useShifaForm(registration, {
    defaultValues: {
      name: '',
      phone: '',
      time: '16:00',
      notes: '',
      reminders: true,
      consent: false,
    },
  });
  return (
    <Form
      form={form}
      translate={translate}
      onSubmit={() => new Promise((resolve) => setTimeout(resolve, 1000))}
      errorSummary={(count) => `حقول تحتاج إلى تصحيح: ${String(count)}`}
      className="max-w-2xl"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              required
              orientation="horizontal"
              value={(value as string | undefined) ?? null}
              onValueChange={onValueChange}
            >
              <Radio value="female">أنثى</Radio>
              <Radio value="male">ذكر</Radio>
            </RadioGroup>
          )}
        </FormField>
        <FormField name="time" label="الوقت المفضّل للمواعيد">
          {(field) => <TimeInput {...field} />}
        </FormField>
      </div>
      <FormField name="notes" label="ملاحظات" hint="تظهر للطبيب فقط">
        {(field) => <Textarea {...field} maxLength={500} />}
      </FormField>
      <FormField name="reminders">
        {({ value, onValueChange, ...field }) => (
          <Switch {...field} checked={value === true} onCheckedChange={onValueChange}>
            تذكير بالمواعيد عبر واتساب
          </Switch>
        )}
      </FormField>
      <FormField name="consent">
        {({ value, onValueChange, ...field }) => (
          <Checkbox {...field} checked={value === true} onCheckedChange={onValueChange} required>
            أوافق على حفظ بياناتي في ملف العيادة
          </Checkbox>
        )}
      </FormField>
      <div className="flex justify-end">
        <FormSubmit>سجّل</FormSubmit>
      </div>
    </Form>
  );
}

const signIn = z.object({
  phone: z.string().regex(/^09\d{8}$/, 'validation.phone'),
  password: z.string().min(8, 'validation.password'),
});

function SignIn() {
  const form = useShifaForm(signIn, { defaultValues: { phone: '', password: '' } });
  return (
    <Form
      form={form}
      translate={translate}
      onSubmit={() => new Promise((resolve) => setTimeout(resolve, 1000))}
      className="max-w-sm"
    >
      <FormField name="phone" label="رقم الهاتف">
        {(field) => <Input {...field} dir="auto" inputMode="tel" />}
      </FormField>
      <FormField name="password" label="كلمة المرور">
        {(field) => <PasswordInput {...field} />}
      </FormField>
      <FormSubmit>دخول</FormSubmit>
    </Form>
  );
}

const meta = {
  title: 'Components/Form',
  component: Registration,
  parameters: {
    docs: {
      description: {
        component:
          'React Hook Form with a Zod resolver: `useShifaForm(schema)`, `<Form translate>`, `<FormField name>`, `<FormSubmit>`. Zod messages are i18n keys; nothing is sent while a field is invalid; an async submit keeps the button busy.\n\n**Accessibility.** A native `form` (the browser’s own validation off, so every message is ours and translated). Enter in a field or Enter and Space on `FormSubmit` (a native submit `button`) submit it; a busy submit keeps focus and ignores a second press. After a failed submit the first invalid field, in page order, takes focus (a radio group’s checked or first option, a Select’s trigger); each invalid control is `aria-invalid` and its message is read through `aria-describedby`; `errorSummary` adds a `role="alert"` line that a screen reader announces at once. A `FormField` with a `label` names its control by it; without one, a checkbox, switch or radio group is named by its own text.',
      },
    },
  },
} satisfies Meta<typeof Registration>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The registration form, as it opens. */
export const Default: Story = {};

/** The sign-in form. */
export const SignInForm: Story = { render: () => <SignIn /> };

/** Submitted with two fields empty: errors, the summary, focus on the first invalid field. */
export const SubmittedWithErrors: Story = {
  parameters: { matrix: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox', { name: 'الاسم الكامل' }), PATIENT_GIVEN);
    await userEvent.click(canvas.getByRole('button', { name: 'سجّل' }));
    const phone = canvas.getByRole('textbox', { name: 'رقم الهاتف' });
    await waitFor(() => expect(phone).toHaveAttribute('aria-invalid', 'true'));
    await waitFor(() => expect(phone).toHaveFocus());
    await expect(canvas.getByRole('alert')).toBeVisible();
  },
};

const note = z.object({ note: z.string() });

/** The text states: the label of a field and of the submit button. */
function TextState({ label }: { label: string }) {
  const form = useShifaForm(note, { defaultValues: { note: '' } });
  return (
    <Form form={form} translate={translate} onSubmit={() => undefined}>
      <FormField name="note" label={label}>
        {(field) => <Input {...field} />}
      </FormField>
      <div className="flex justify-end">
        <FormSubmit>{label}</FormSubmit>
      </div>
    </Form>
  );
}

const states = storyStates((label) => <TextState label={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
