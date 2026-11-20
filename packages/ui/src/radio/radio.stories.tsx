// Radio stories, as on the approved sheet (owner, 2026-11-20). Every story renders in the eight
// combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Radio, RadioGroup } from './radio.tsx';

const meta = {
  title: 'Components/Radio',
  component: RadioGroup,
  args: { label: 'نوع الزيارة', children: null },
  parameters: {
    docs: {
      description: {
        component:
          'One of a few choices: a 20 px ring at the logical start, green ring and dot when checked. One Tab stop; arrows move and check, follow the reading direction in a row (Left is next in Arabic), skip disabled options and wrap.',
      },
    },
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function Visit(props: Partial<Parameters<typeof RadioGroup>[0]>) {
  return (
    <RadioGroup label="نوع الزيارة" {...props}>
      <Radio value="exam">كشف</Radio>
      <Radio value="review">مراجعة</Radio>
      <Radio value="emergency">إسعاف</Radio>
      <Radio value="home" disabled>
        زيارة منزلية (غير متاحة)
      </Radio>
    </RadioGroup>
  );
}

/** Vertical with a disabled option, an error, a row, a description, a disabled group. */
export const States: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Visit defaultValue="exam" hint="الكشف أول زيارة للمريض" />
      <Visit error="اختر نوع الزيارة" required />
      <RadioGroup label="الجنس" orientation="horizontal" defaultValue="female">
        <Radio value="female">أنثى</Radio>
        <Radio value="male">ذكر</Radio>
      </RadioGroup>
      <RadioGroup label="طريقة الدفع" defaultValue="cash">
        <Radio value="cash" description="يُدفع عند الاستقبال">
          نقداً
        </Radio>
        <Radio value="later" description="يُضاف إلى حساب المريض">
          لاحقاً
        </Radio>
      </RadioGroup>
      <Visit defaultValue="review" disabled />
    </div>
  ),
};

const states = storyStates((label) => (
  <RadioGroup label={label} orientation="horizontal" defaultValue="a">
    <Radio value="a">{label}</Radio>
    <Radio value="b">ذكر</Radio>
  </RadioGroup>
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
