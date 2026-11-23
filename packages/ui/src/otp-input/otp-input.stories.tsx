// OTP Input stories, as on the approved sheet (owner, 2026-11-20; OD-62). Every story renders in
// the eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { OtpInput } from './otp-input.tsx';

const meta = {
  title: 'Components/OTP Input',
  component: OtpInput,
  args: { label: 'رمز التحقق' },
  parameters: {
    docs: {
      description: {
        component:
          'Six 48 × 52 slots, left to right in both directions (numbers never mirror). Arabic-Indic digits are accepted and kept as Western ones; a pasted code fills every slot.\n\n**Accessibility.** One real text input sits behind the slots, so a screen reader announces one textbox with `autocomplete="one-time-code"` and a numeric keyboard, not six fields. Tab reaches it once; digits are typed in, letters are ignored, and Arrow Left and Arrow Right move to the slot on that side of the screen in both directions. It is named by its `label` or a Field, else by «رمز التحقق» (pass `aria-label` for another name). An error sets `aria-invalid` and is read with the field through `aria-describedby`; the drawn caret is hidden.',
      },
    },
  },
} satisfies Meta<typeof OtpInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty, filled, an error, disabled. */
export const States: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <OtpInput {...args} hint="أرسلناه برسالة" />
      <OtpInput {...args} defaultValue="482071" />
      <OtpInput {...args} defaultValue="482075" error="الرمز غير صحيح. بقيت محاولتان" />
      <OtpInput {...args} defaultValue="482071" disabled />
    </div>
  ),
};

/** Typing Arabic-Indic digits: «٤٨٢» is kept as 482. */
export const ArabicDigits: Story = {
  parameters: { matrix: false },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'رمز التحقق' });
    await userEvent.click(input);
    await userEvent.keyboard('٤٨٢');
    await expect(input).toHaveValue('482');
  },
};

const states = storyStates((label) => <OtpInput label={label} defaultValue="4820" />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
