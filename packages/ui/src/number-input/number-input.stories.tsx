// Number Input stories, as on the approved sheet (owner, 2026-11-20). Every story renders in the
// eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { NumberInput } from './number-input.tsx';

const meta = {
  title: 'Components/Number Input',
  component: NumberInput,
  args: { label: 'عدد الجلسات', defaultValue: 3, min: 1, max: 20 },
  parameters: {
    docs: {
      description: {
        component:
          'A number with steppers: «إنقاص» at the logical start, «زيادة» at the end, each a 44 px target. Western digits, tabular, comma grouping (OD-20, OD-61); typed Arabic-Indic digits are accepted and kept as Western ones. Up and Down step by one, Page Up and Page Down by ten; the stepper at a limit is disabled. Amounts: `steppers={false}` and a `unit`.',
      },
    },
  },
} satisfies Meta<typeof NumberInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default, at the maximum, an error, disabled, and an amount with its unit. */
export const States: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <NumberInput {...args} />
      <NumberInput {...args} defaultValue={20} hint="الحد الأقصى 20" />
      <NumberInput label="العمر" defaultValue={140} min={0} max={120} error="العمر بين 0 و120" />
      <NumberInput {...args} defaultValue={1} disabled />
      <NumberInput label="أجر المعاينة" defaultValue={125000} unit="ل.س" steppers={false} />
    </div>
  ),
};

/** Typing Arabic-Indic digits: «١٢» is kept as 12. */
export const ArabicDigits: Story = {
  parameters: { matrix: false },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('spinbutton', { name: 'عدد الجلسات' });
    await userEvent.clear(input);
    await userEvent.type(input, '١٢');
    await expect(input).toHaveValue('12');
  },
};

const states = storyStates((label) => <NumberInput label={label} defaultValue={3} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
