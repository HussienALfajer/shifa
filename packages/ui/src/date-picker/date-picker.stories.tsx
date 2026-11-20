// Date Picker stories, as on the approved sheet (owner, 2026-11-20) and OD-61. The field states
// render in the eight combinations; the open calendar is one story, opened by its play function.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { DatePicker } from './date-picker.tsx';

const meta = {
  title: 'Components/Date Picker',
  component: DatePicker,
  args: { label: 'تاريخ الموعد', defaultValue: '2026-11-24', min: '2026-11-20' },
  parameters: {
    docs: {
      description: {
        component:
          'A date, typed (dd/mm/yyyy, Arabic-Indic digits accepted) or picked. Gregorian, the week starting on Saturday, Levantine month names in Arabic (OD-61). Arrows in the calendar follow the reading direction, Up and Down move a week, Page Up and Page Down a month; days before `min` are disabled. The value is an ISO date («2026-11-24»).',
      },
    },
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Chosen, empty, an error and disabled. */
export const States: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DatePicker {...args} />
      <DatePicker label="تاريخ الميلاد" defaultValue={null} hint="يمكن الكتابة مباشرة" />
      <DatePicker
        label="تاريخ المتابعة"
        defaultValue="2026-11-12"
        error="اختر تاريخاً من اليوم فصاعداً"
      />
      <DatePicker label="تاريخ التسجيل" defaultValue="2025-02-03" disabled />
    </div>
  ),
};

/** The calendar open on the chosen day. */
export const Open: Story = {
  parameters: { matrix: false },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'فتح التقويم' }));
    await waitFor(async () => {
      await expect(within(canvasElement.ownerDocument.body).getByRole('grid')).toBeVisible();
    });
  },
};

const states = storyStates((label) => <DatePicker label={label} defaultValue="2026-11-24" />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
