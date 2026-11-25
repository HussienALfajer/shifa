// Time Input stories, as on the approved sheets (owner, 2026-11-20 and 2026-11-23; OD-62, OD-70 B,
// OD-73). Every story renders in the eight combinations of direction × theme × density and is
// checked by axe; the open slot grid is a story opened by its play function.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
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
          'An hour and a minute segment (plus ص/م on the 12-hour clock, a clinic setting), left to right in both directions, and a clock button at the logical end that opens the clinic\'s slots: times every `step` minutes (15 by default; it must divide 60) from `min` up to, not including, `max`, in four columns under ليلاً، صباحاً، بعد الظهر، مساءً (only the parts of the day that have slots), with «أقرب وقت» for the next slot after now. One press fills the segments and closes; typing stays the main way in. The value is always "HH:mm"; Arabic-Indic digits are accepted.\n\n**Accessibility.** It renders `role="group"` named by its `label`, holding one `spinbutton` per segment, named «الساعة», «الدقائق» and «ص/م» (Hour, Minute, AM/PM in English). Tab reaches the hour; digits fill a segment and move on, ArrowRight and ArrowLeft go to the segment on that side in both directions, ArrowUp and ArrowDown step the focused segment; a disabled field takes no focus. The clock is a `button` named «اختيار الوقت» («Choose a time»); Enter or Space on it, or Alt+ArrowDown from a segment, opens a `dialog` of the same name holding one `grid` per part of the day. Focus opens on the chosen time or the next one after now; arrows follow the reading direction, Up and Down move a row, Home and End go to the group\'s ends, Enter chooses; Escape closes and returns focus to the button. Each slot is read with its part of the day («10:30 صباحاً»); the chosen one is pressed and selected. With an error the group is `aria-invalid` and the message is read through `aria-describedby`. Without a `label` (and outside a Field) pass `aria-label`; it falls back to «الوقت» («Time» in English).',
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

/** A clinic's day, 09:00–17:00, at its 15-minute step. */
export const ClinicHours: Story = {
  args: { label: 'وقت الموعد', defaultValue: '10:30', min: '09:00', max: '17:00' },
};

const openGrid: Story['play'] = async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'اختيار الوقت' }));
  await waitFor(async () => {
    await expect(body.getByRole('grid', { name: 'صباحاً' })).toBeVisible();
  });
};

/** The slot grid open on the chosen time, 24-hour. */
export const SlotGrid: Story = {
  args: { label: 'وقت الموعد', defaultValue: '10:30', min: '09:00', max: '17:00' },
  parameters: { matrix: false },
  play: openGrid,
};

/** The slot grid on the 12-hour clock. */
export const SlotGrid12Hour: Story = {
  args: {
    label: 'وقت الموعد',
    defaultValue: '14:30',
    min: '09:00',
    max: '17:00',
    hourCycle: 12,
  },
  parameters: { matrix: false },
  play: openGrid,
};

/** The slots open at rest by `defaultOpen` (OD-119), 24-hour. */
export const OpenAtRest: Story = {
  args: {
    label: 'وقت الموعد',
    defaultValue: '10:30',
    min: '09:00',
    max: '17:00',
    defaultOpen: true,
  },
  parameters: { matrix: false },
};

/** The slots open at rest, 12-hour. */
export const OpenAtRest12Hour: Story = {
  args: {
    label: 'وقت الموعد',
    defaultValue: '10:30',
    min: '09:00',
    max: '17:00',
    hourCycle: 12,
    defaultOpen: true,
  },
  parameters: { matrix: false },
};

const states = storyStates((label) => <TimeInput label={label} defaultValue="14:30" />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
