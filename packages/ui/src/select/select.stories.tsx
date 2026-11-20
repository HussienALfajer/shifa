// Select stories, as on the approved sheet (owner, 2026-11-20). The field states render in the
// eight combinations; the open list is one story, opened by its play function. Names come from
// the synthetic generator in @shifa/testing.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { DOCTORS } from '../../test/fixtures.ts';
import { Select, type SelectItem } from './select.tsx';

const [first, second, third, away] = DOCTORS;
const ITEMS: SelectItem[] = [
  ...[first, second, third].flatMap((d) =>
    d === undefined ? [] : [{ value: d.id, label: d.name }],
  ),
  ...(away === undefined
    ? []
    : [{ value: away.id, label: away.name, disabled: true, hint: 'في إجازة' }]),
];

const meta = {
  title: 'Components/Select',
  component: Select,
  args: { label: 'الطبيب', items: ITEMS, placeholder: 'اختر الطبيب' },
  parameters: {
    docs: {
      description: {
        component:
          'Choose one of a short, known list. The list opens below the field at its logical start, at least as wide; the chosen option has a check. Typing a letter (Arabic too) moves to the option whose name starts with it; a title such as «د.» is skipped. An unavailable option says why in `hint`. For a long or searched list, use Combobox.',
      },
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty, chosen, invalid and disabled. */
export const States: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Select {...args} />
      <Select {...args} label="الطبيب المعالج" defaultValue={first?.id ?? null} />
      <Select {...args} label="نوع الزيارة" error="اختر نوع الزيارة قبل الحفظ" />
      <Select
        {...args}
        label="الفرع"
        defaultValue={second?.id ?? null}
        disabled
        hint="يحدده المدير"
      />
    </div>
  ),
};

/** Open, the chosen doctor checked, the unavailable one with its reason. */
export const Open: Story = {
  parameters: { matrix: false },
  render: (args) => <Select {...args} defaultValue={first?.id ?? null} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('combobox', { name: 'الطبيب' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(async () => {
      await expect(within(canvasElement.ownerDocument.body).getByRole('listbox')).toBeVisible();
    });
  },
};

const states = storyStates((label) => (
  <Select label={label} items={ITEMS} placeholder="اختر الطبيب" />
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
