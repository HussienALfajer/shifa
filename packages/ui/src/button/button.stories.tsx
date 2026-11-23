// Button stories, as on the approved sheet (owner, 2026-11-20). Every story renders in the eight
// combinations of direction × theme × density (.storybook/matrix.tsx) and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Button } from './button.tsx';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'حفظ الزيارة', variant: 'primary', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
  parameters: {
    docs: {
      description: {
        component:
          'One primary button per view. Secondary for the other actions, ghost for light actions inside cards and tables, danger (brick, never red) for actions that delete or cancel. Disabled leaves the tab order; loading keeps focus and its label, shows a spinner first and ignores presses.\n\n**Accessibility.** A native `button` of type button, named by its label. Enter and Space activate it; a disabled button is natively disabled and leaves the tab order. A loading button stays focusable and is announced with `aria-busy` and `aria-disabled`; a press still running after a second is announced as `pendingAnnouncement` («جارٍ التنفيذ»). An icon-only button needs an `aria-label`; wrap Latin parts of an Arabic label in `<bdi>`.',
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

const VARIANTS = [
  ['primary', 'حفظ الزيارة'],
  ['secondary', 'طباعة'],
  ['ghost', 'تعديل'],
  ['danger', 'إلغاء الموعد'],
] as const;

/** The four variants at rest, disabled and loading (hover, focus and press are in the tests). */
export const VariantsAndStates: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {VARIANTS.map(([variant, label]) => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          <Button variant={variant}>{label}</Button>
          <Button variant={variant} disabled>
            {label}
          </Button>
          <Button variant={variant} loading>
            {label}
          </Button>
        </div>
      ))}
    </div>
  ),
};

/** Three sizes, with a label, with an icon at the start, and icon only. */
export const SizesAndIcons: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-3">
          <Button size={size} variant="primary">
            حجز
          </Button>
          <Button size={size} variant="primary" startIcon="calendar-plus">
            حجز موعد
          </Button>
          <Button size={size} variant="primary" startIcon="calendar-plus" aria-label="موعد جديد" />
          <Button size={size} startIcon="printer">
            طباعة
          </Button>
          <Button size={size} startIcon="printer" aria-label="طباعة" />
        </div>
      ))}
    </div>
  ),
};

/** Directional icons mirror: "Next" points to the end of the line, "Back" to its start. */
export const Directions: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" startIcon="calendar-plus">
        حجز موعد
      </Button>
      <Button startIcon="arrow-back">رجوع</Button>
      <Button endIcon="arrow-forward">التالي</Button>
    </div>
  ),
};

/** Dialog actions end with the primary button at the end of the line. */
export const DialogActions: Story = {
  render: () => (
    <div className="flex justify-end gap-3 rounded-surface bg-bg-surface-raised p-4">
      <Button>إلغاء</Button>
      <Button variant="primary">حفظ</Button>
    </div>
  ),
};

const states = storyStates((label) => (
  <Button variant="primary" loading={label === 'حفظ'} className="w-full">
    {label}
  </Button>
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = {
  ...states['MixedDirection'],
  render: () => (
    <Button>
      تصدير <bdi dir="ltr">PDF</bdi>
    </Button>
  ),
};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};

/** Keyboard: Tab reaches the button, Enter and Space press it; a loading button ignores both. */
export const Keyboard: Story = {
  parameters: { matrix: false },
  args: { onClick: fn() },
  render: (args) => (
    <div className="flex gap-3">
      <Button {...args}>حفظ الزيارة</Button>
      <Button loading onClick={args.onClick}>
        جارٍ الحفظ
      </Button>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'حفظ الزيارة' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'جارٍ الحفظ' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};
