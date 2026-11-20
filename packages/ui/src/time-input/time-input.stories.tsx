// Time Input stories, as on the approved sheet (owner, 2026-11-20; OD-62). Every story renders in
// the eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { TimeInput } from './time-input.tsx';

const meta = {
  title: 'Components/Time Input',
  component: TimeInput,
  args: { label: 'وقت الموعد' },
  parameters: {
    docs: {
      description: {
        component:
          'An hour and a minute segment (plus ص/م on the 12-hour clock, a clinic setting), left to right in both directions, a clock at the logical end. The value is always "HH:mm"; Arabic-Indic digits are accepted.',
      },
    },
  },
} satisfies Meta<typeof TimeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty, 24-hour with a hint, an error, disabled, 12-hour. */
export const States: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <TimeInput {...args} />
      <TimeInput {...args} defaultValue="14:30" hint="دوام العيادة 09:00 – 17:00" />
      <TimeInput {...args} defaultValue="19:15" error="اختر وقتاً بين 09:00 و17:00" />
      <TimeInput {...args} defaultValue="14:30" disabled />
      <TimeInput {...args} defaultValue="14:30" hourCycle={12} />
    </div>
  ),
};

const states = storyStates((label) => <TimeInput label={label} defaultValue="14:30" />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
