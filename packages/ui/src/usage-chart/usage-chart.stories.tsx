// Usage chart stories, as on the approved sheet (owner, 2026-11-27, A02SheetUsageChart): 30 days of
// sign-ins with the average line and today in gold, a small clinic with empty days, no data yet
// and loading. Every story renders in the eight combinations of direction × theme × density and
// is checked by axe; the open tooltip of a focused day is a play story.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { useDirection } from '../providers/direction-provider.tsx';
import { UsageChart, type UsageChartDay } from './usage-chart.tsx';

const SIGN_INS = [
  6, 9, 11, 0, 0, 12, 14, 10, 13, 8, 0, 7, 15, 16, 12, 11, 9, 0, 13, 18, 21, 17, 14, 0, 0, 12, 15,
  19, 16, 14,
];
const SMALL = [
  0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1,
];

/** 30 Damascus days ending on 26/11/2026. */
function days(counts: number[]): UsageChartDay[] {
  const end = Date.UTC(2026, 10, 26);
  return counts.map((count, i) => ({
    date: new Date(end - (counts.length - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    count,
  }));
}

/** The chart as a screen holds it: words in the story's language. */
function Chart({ counts, loading }: { counts: number[]; loading?: boolean }) {
  const rtl = useDirection() === 'rtl';
  return (
    <UsageChart
      aria-label={rtl ? 'آخر 30 يومًا' : 'Last 30 days'}
      days={days(counts)}
      unit={(n) => (rtl ? `${String(n)} تسجيل دخول` : `${String(n)} sign-ins`)}
      {...(loading === undefined ? {} : { loading })}
    />
  );
}

const meta = {
  title: 'Components/UsageChart',
  component: UsageChart,
  parameters: {
    docs: {
      description: {
        component:
          'Daily counts of the last 30 days as bars: a y-axis in quarters with grid lines, the daily average as a dashed gold line, today in gold, a day without activity as a thin line. Time runs from left to right in both directions. Pass `days` oldest first (the last is today unless `lastIsToday` is false) and `unit` for the figure’s words; an empty `days` shows the empty state, `loading` a placeholder. The figures above the chart and the series switch belong to the screen.\n\n**Accessibility.** A `role="group"` named by the required `aria-label`, described by a summary for screen readers (total, daily average, highest day); `aria-busy` while loading. Each bar is a button named by its figure and day, opening the Tooltip on hover or focus. One Tab stop (today first); Left and Right move to the day at that side, Home and End to the oldest and today. The axes, grid, average line and legend are hidden from screen readers; the summary carries them.',
      },
    },
  },
  args: { 'aria-label': 'آخر 30 يومًا', days: [], unit: String },
} satisfies Meta<typeof UsageChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sign-ins of a busy clinic: average 10.4, highest 21 on 17/11, four days without activity. */
export const Data: Story = { render: () => <Chart counts={SIGN_INS} /> };

/** A small clinic: whole-number steps on the axis, many empty days. */
export const SmallCounts: Story = { render: () => <Chart counts={SMALL} /> };

/** No usage yet: the empty state. */
export const Empty: Story = { render: () => <Chart counts={[]} /> };

/** Loading: a placeholder of the chart's height, the group busy. */
export const Loading: Story = { render: () => <Chart counts={[]} loading /> };

/** A day focused from the keyboard: its Tooltip with the figure, then the day. */
export const FocusedDay: Story = {
  parameters: { matrix: false },
  render: () => (
    <div className="p-16">
      <Chart counts={SIGN_INS} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const today = [
      ...canvasElement.querySelectorAll<HTMLElement>('[data-slot="usage-bar"] button'),
    ].at(-1);
    today?.focus();
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(async () => {
      await expect(document.querySelector('[role="tooltip"][data-open]')?.textContent).toBe(
        '16 تسجيل دخول · 25/11',
      );
    });
  },
};

/** The text states: a long Arabic unit in the tooltip and summary, and the average's word. */
function TextState({ label }: { label: string }) {
  return (
    <UsageChart
      aria-label={label}
      days={days(SIGN_INS)}
      unit={(n) => `${String(n)} ${label}`}
      labels={{ average: label }}
    />
  );
}

const states = storyStates((label) => <TextState label={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
