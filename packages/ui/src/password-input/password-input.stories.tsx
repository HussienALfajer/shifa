// Password Input stories, as on the approved sheet (owner, 2026-11-20). Every story renders in the
// eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { PasswordInput } from './password-input.tsx';

const meta = {
  title: 'Components/Password Input',
  component: PasswordInput,
  args: { label: 'كلمة المرور' },
  parameters: {
    docs: {
      description: {
        component:
          'A password in the field box with a 36 px show toggle inside at the logical end. The toggle keeps one name and reports its state with aria-pressed; typing is left to right; a submit hides the password again. Never logged or stored by the component.',
      },
    },
  },
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hidden, an error, disabled. */
export const States: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <PasswordInput {...args} defaultValue="Shifa-2026" />
      <PasswordInput
        label="كلمة المرور الجديدة"
        autoComplete="new-password"
        defaultValue="Shif"
        error="8 أحرف على الأقل"
      />
      <PasswordInput {...args} disabled />
    </div>
  ),
};

/** The toggle shows the password. */
export const Shown: Story = {
  args: { defaultValue: 'Shifa-2026' },
  parameters: { matrix: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'إظهار كلمة المرور' }));
    await expect(canvas.getByRole('button', { name: 'إظهار كلمة المرور' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
};

const states = storyStates((label) => <PasswordInput label={label} defaultValue="Shifa-2026" />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
