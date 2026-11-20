// Icon Button stories, as on the approved sheet (owner, 2026-11-20). Every story renders in the
// eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from './icon-button.tsx';

const meta = {
  title: 'Components/Icon Button',
  component: IconButton,
  args: { icon: 'pencil', label: 'تعديل' },
  parameters: {
    docs: {
      description: {
        component:
          'A square Button with one icon and no visible text, so `label` (its name) is required. The Button variants; md 44 px and sm 36 px (32 and 28 compact).',
      },
    },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The four variants, enabled and disabled, in both sizes. */
export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(['md', 'sm'] as const).map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-2">
          <IconButton size={size} icon="pencil" label="تعديل" />
          <IconButton size={size} icon="x" label="إغلاق" variant="ghost" />
          <IconButton size={size} icon="plus" label="إضافة موعد" variant="primary" />
          <IconButton size={size} icon="trash" label="حذف المرفق" variant="danger" />
          <IconButton size={size} icon="pencil" label="تعديل الملاحظة" disabled />
          <IconButton size={size} icon="arrow-forward" label="التالي" variant="ghost" />
        </div>
      ))}
    </div>
  ),
};
