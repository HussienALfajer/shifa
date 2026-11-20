// Checkbox stories, as on the approved sheet (owner, 2026-11-20). Every story renders in the eight
// combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Checkbox } from './checkbox.tsx';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  args: { children: 'مريض جديد' },
  parameters: {
    docs: {
      description: {
        component:
          'A 20 px mark at the logical start and its text, the line a 44 px target (32 compact). Checked: green with a tick; some: a dash. Space and a press on the text toggle.',
      },
    },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Unchecked, checked, some, an error, disabled, disabled and checked, a description. */
export const States: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 sm:grid-cols-2">
      <Checkbox {...args} />
      <Checkbox {...args} defaultChecked />
      <Checkbox defaultChecked="indeterminate">تحديد الكل</Checkbox>
      <Checkbox error="الموافقة مطلوبة للحجز">أوافق على شروط الحجز</Checkbox>
      <Checkbox {...args} disabled />
      <Checkbox {...args} disabled defaultChecked />
      <Checkbox defaultChecked description="تظهر علامة تحذير في ملفه وفي كل وصفة">
        مريض لديه حساسية دوائية
      </Checkbox>
    </div>
  ),
};

const states = storyStates((label) => <Checkbox defaultChecked>{label}</Checkbox>);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
