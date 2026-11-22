// Segmented control stories, as on the approved sheet (owner, 2026-11-22). Every story renders in
// the eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { SegmentedControl } from './segmented-control.tsx';

const meta = {
  title: 'Components/SegmentedControl',
  component: SegmentedControl,
  parameters: {
    docs: {
      description: {
        component:
          'One choice of two to five that switches a view at once. The chosen option is a white raised segment with heavier text. One Tab stop; the arrows move and choose together and follow the reading direction (Left is next in Arabic), Home and End reach the ends, a disabled option is skipped. For a value sent with a form, use RadioGroup.',
      },
    },
  },
  args: { 'aria-label': 'عرض التقويم', items: [] },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

function Views({ first = 'اليوم' }: { first?: string }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <SegmentedControl
        aria-label="عرض التقويم"
        defaultValue="day"
        items={[
          { value: 'day', label: first },
          { value: 'week', label: 'الأسبوع' },
          { value: 'month', label: 'الشهر' },
        ]}
      />
      <SegmentedControl
        aria-label="حالة الزيارة"
        defaultValue="waiting"
        items={[
          { value: 'all', label: 'الكل', count: 18 },
          { value: 'waiting', label: 'بالانتظار', count: 5 },
          { value: 'room', label: 'في الغرفة', count: 1 },
          { value: 'done', label: 'انتهت', count: 12 },
        ]}
      />
      <SegmentedControl
        aria-label="طريقة العرض"
        defaultValue="list"
        items={[
          { value: 'list', label: 'قائمة', icon: 'list' },
          { value: 'cards', label: 'بطاقات', icon: 'users' },
          { value: 'map', label: 'خريطة', disabled: true },
        ]}
      />
    </div>
  );
}

/** Three, four with counts, icons with a disabled option. */
export const Default: Story = { render: () => <Views /> };

/** The whole control disabled. */
export const Disabled: Story = {
  render: () => (
    <SegmentedControl
      aria-label="عرض التقويم"
      defaultValue="day"
      disabled
      items={[
        { value: 'day', label: 'اليوم' },
        { value: 'week', label: 'الأسبوع' },
        { value: 'month', label: 'الشهر' },
      ]}
    />
  ),
};

const states = storyStates((label) => <Views first={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
