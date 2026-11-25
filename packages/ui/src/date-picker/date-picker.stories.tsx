// Date Picker stories, as on the approved sheets (owner, 2026-11-20 and 2026-11-23), OD-61 and
// OD-69 A, OD-68 B, OD-72. The field states render in the eight combinations; the open calendar,
// the month and year panel and a typed impossible date are stories opened by their play
// functions.
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
          'A date, typed in three segments day / month / year (left to right in both directions, Arabic-Indic digits accepted, a pasted 14/03/1987, 14-3-1987, 14.3.1987 or 1987-03-14 fills all three) or picked from the calendar. Gregorian, the week starting on Saturday, Levantine month names in Arabic (OD-61). The heading opens a month and year panel: a birth date decades back is two presses away. Days and months outside `min`/`max` are disabled. A typed date is checked in Arabic («أكمل التاريخ: السنة ناقصة», «شباط 1987 فيه 28 يوماً», «اكتب السنة بأربعة أرقام: 1987», the `min`/`max` texts, or `maxMessage`); a two-digit year is never guessed. A complete date is confirmed under the field («السبت 14 آذار 1987», with the age when `showAge`). The value is an ISO date («2026-11-24»).\n\n**Accessibility.** A `group` named by `label`, holding three `spinbutton`s named «اليوم», «الشهر», «السنة» (Day, Month, Year in English) with their placeholders; digits fill a segment and move on, `/ - .` or a space move on, Backspace in an empty segment goes back, ArrowLeft and ArrowRight go to the segment on that side in both directions, ArrowUp and ArrowDown step. Then a calendar `button` named «فتح التقويم» (`openLabel` to change it); the calendar is a `role="grid"` named «اختيار التاريخ» («Choose a date»), its arrows following the reading direction, Up and Down a week, Page Up and Page Down a month; Enter chooses and Escape closes, both returning focus to the calendar button. The heading is a button with `aria-expanded`: its panel holds a `listbox` of years («السنة»: Up/Down a year, Page Up/Down ten, Home/End, typed digits jump to a year, Enter goes on) and a `grid` of months («الشهر»: arrows by reading direction, Up/Down three months, Enter chooses); Escape steps back from months to years to days and keeps the popup open. Disabled days and months are `aria-disabled`, still read. The error is read with the group through `aria-describedby`, after the confirmation line or the hint; an `error` from the form wins over the typed date\'s own.',
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

/** A birth date: no date after today (a fixed day here, so the picture does not change). */
export const BirthDate: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DatePicker
        label="تاريخ الميلاد"
        defaultValue={null}
        max="2026-11-23"
        maxMessage="تاريخ الميلاد لا يكون بعد اليوم"
        showAge
      />
      <DatePicker label="تاريخ الميلاد" defaultValue="1987-03-14" max="2026-11-23" />
    </div>
  ),
};

/** The look of each typed-date error, as the field shows it after leaving it. */
export const TypedErrors: Story = {
  render: () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DatePicker label="تاريخ الميلاد" defaultValue={null} error="شباط 1987 فيه 28 يوماً" />
      <DatePicker label="تاريخ الميلاد" defaultValue={null} error="أكمل التاريخ: السنة ناقصة" />
      <DatePicker
        label="تاريخ المتابعة"
        defaultValue="2026-11-12"
        error="اختر تاريخاً من 23/11/2026 فصاعداً"
      />
      <DatePicker label="تاريخ الميلاد" defaultValue={null} error="اكتب السنة بأربعة أرقام: 1987" />
    </div>
  ),
};

/** An appointment: no day before today (a fixed day here). */
export const Appointment: Story = {
  args: { label: 'تاريخ الموعد', defaultValue: '2026-11-24', min: '2026-11-23' },
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

/** The heading opens the month and year panel. */
export const MonthYearPanel: Story = {
  args: { label: 'تاريخ الميلاد', defaultValue: '1987-03-14', min: undefined },
  parameters: { matrix: false },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'فتح التقويم' }));
    await userEvent.click(await body.findByRole('button', { name: 'آذار 1987' }));
    await waitFor(async () => {
      await expect(body.getByRole('listbox', { name: 'السنة' })).toBeVisible();
    });
  },
};

/** A typed impossible date is named at once and keeps the typed day. */
export const TypedImpossible: Story = {
  args: { label: 'تاريخ الميلاد', defaultValue: null, min: undefined },
  parameters: { matrix: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('spinbutton', { name: 'اليوم' }));
    await userEvent.keyboard('31021987');
    await waitFor(async () => {
      await expect(canvas.getByText('شباط 1987 فيه 28 يوماً')).toBeVisible();
    });
  },
};

/** The calendar open at rest by `defaultOpen` (OD-119), on the chosen day's month. */
export const OpenAtRest: Story = {
  parameters: { matrix: false },
  args: { defaultOpen: true },
};

const states = storyStates((label) => <DatePicker label={label} defaultValue="2026-11-24" />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
