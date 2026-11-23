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
          'A date, typed (dd/mm/yyyy, Arabic-Indic digits accepted) or picked. Gregorian, the week starting on Saturday, Levantine month names in Arabic (OD-61). Days before `min` are disabled. The value is an ISO date («2026-11-24»).\n\n**Accessibility.** A text field named by `label`, then a calendar `button` named «فتح التقويم» in both languages (`openLabel` to change it); the calendar is a `role="grid"` named «اختيار التاريخ», with named previous and next month buttons. Tab reaches the field and the button; in the grid the arrow keys follow the reading direction (the forward arrow is Left in Arabic, Right in English), Up and Down move a week, Page Up and Page Down a month. Enter chooses the focused day and Escape closes the calendar keeping the date; both return focus to the calendar button. Days before `min` are announced as disabled (`aria-disabled`); an error sets `aria-invalid` and is read with the field through `aria-describedby`, after the hint.',
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
