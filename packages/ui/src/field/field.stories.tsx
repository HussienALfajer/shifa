// Field stories, as on the approved sheet (owner, 2026-11-20). Every story renders in the eight
// combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Input } from '../input/input.tsx';
import { OtpInput } from '../otp-input/otp-input.tsx';
import { TimeInput } from '../time-input/time-input.tsx';
import { Field } from './field.tsx';

const meta = {
  title: 'Components/Field',
  component: Field,
  args: { label: 'رقم الهاتف', children: null },
  parameters: {
    docs: {
      description: {
        component:
          'The label above the control, a danger asterisk when required, a muted hint, and an error with its warning icon, so an error is never told by colour alone.\n\n**Accessibility.** The label names the control inside it (its accessible name, without the asterisk); no keyboard interaction of its own (Tab goes to the control). The hint and then the error are read with the control through `aria-describedby`; an error sets `aria-invalid` and `required` makes the control required, so a screen reader announces “required” while the asterisk is hidden (`aria-hidden`). `label` is required; `disabled` passes on to the control.',
      },
    },
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The anatomy of the sheet, and a Field around other controls. */
export const States: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label="رقم الهاتف"
        required
        hint="يصله تأكيد الموعد عبر واتساب"
        error="رقم الهاتف ناقص: 10 أرقام تبدأ بـ 09"
      >
        <Input dir="auto" defaultValue="0944 12" />
      </Field>
      <Field label="رقم الملف" disabled>
        <Input defaultValue="1042" />
      </Field>
      <Field label="وقت الموعد" hint="دوام العيادة 09:00 – 17:00">
        <TimeInput defaultValue="14:30" />
      </Field>
      <Field label="رمز التحقق" error="الرمز غير صحيح">
        <OtpInput defaultValue="482075" />
      </Field>
    </div>
  ),
};

const states = storyStates((label) => (
  <Field label={label} hint={label}>
    <Input />
  </Field>
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
