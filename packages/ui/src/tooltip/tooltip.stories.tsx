// Tooltip stories, as on the approved sheet (owner, 2026-11-22). The triggers render in the eight
// combinations of direction × theme × density; an open tooltip is a play story (only one tooltip
// is open at a time, so eight cannot sit side by side), opened by keyboard focus.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Button } from '../button/button.tsx';
import { IconButton } from '../icon-button/icon-button.tsx';
import { Tooltip } from './tooltip.tsx';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  parameters: {
    docs: {
      description: {
        component:
          'A short explanation in a dark ink bubble above its trigger (below with `side="bottom"` or when there is no room), at most 240 px wide; hover opens it after 500 ms, a touch tap never. It never holds the only copy of something a person needs: a field hint belongs under the field.\n\n**Accessibility.** The bubble renders `role="tooltip"`; the trigger keeps its own element and role. Tab to the trigger opens it at once and Escape closes it, focus staying on the trigger; the tooltip itself never takes focus, so `content` is plain text with no links or buttons. By default screen readers hear it as the trigger’s description (`aria-describedby`); with `type="label"` it is the trigger’s name instead. On an icon button use `tooltip` on `IconButton`, which repeats its label as its name and adds no second description.',
      },
    },
  },
  args: { content: '', children: <span /> },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

function Triggers({ hint = 'إرسال تذكير عبر واتساب', open }: { hint?: string; open?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-12">
      <IconButton icon="printer" label="طباعة الوصفة" tooltip />
      <Tooltip content={hint} {...(open === undefined ? {} : { defaultOpen: open })}>
        <Button>إرسال تذكير</Button>
      </Tooltip>
      <IconButton icon="bell" label="الإشعارات" variant="ghost" tooltip />
    </div>
  );
}

async function openFirst(canvasElement: HTMLElement, text: string) {
  await userEvent.tab();
  const body = within(canvasElement.ownerDocument.body);
  await waitFor(async () => {
    const tip = body.getByRole('tooltip');
    await expect(tip).toHaveTextContent(text);
    await expect(tip).toHaveAttribute('data-open');
  });
}

/** The triggers at rest. */
export const Default: Story = { render: () => <Triggers /> };

/** Keyboard focus on the icon button: its label above it. */
export const Open: Story = {
  parameters: { matrix: false },
  render: () => <Triggers />,
  play: async ({ canvasElement }) => {
    await openFirst(canvasElement, 'طباعة الوصفة');
  },
};

/** Shown from the start, for the screenshot: the icon button's name above it. */
export const Shown: Story = {
  parameters: { matrix: false },
  render: () => (
    <div className="p-16">
      <Tooltip content="طباعة الوصفة" type="label" defaultOpen>
        <IconButton icon="printer" label="طباعة الوصفة" />
      </Tooltip>
    </div>
  ),
};

/** Below the trigger, as at the top of a screen. */
export const Below: Story = {
  parameters: { matrix: false },
  render: () => (
    <div className="p-4">
      <Tooltip content="الإشعارات" side="bottom" type="label">
        <IconButton icon="bell" label="الإشعارات" />
      </Tooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await openFirst(canvasElement, 'الإشعارات');
  },
};

/** A long explanation wraps at 240 px. */
export const LongText: Story = {
  parameters: { matrix: false },
  render: () => (
    <div className="p-16">
      <Tooltip content="نسخ رابط صفحة الحجز إلى الحافظة لإرساله إلى المريض">
        <Button startIcon="file-text">نسخ رابط الحجز</Button>
      </Tooltip>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await openFirst(canvasElement, 'نسخ رابط صفحة الحجز');
  },
};

// The text states with the tooltip shown, one copy each (one tooltip is open at a time).
const states = storyStates((label) => <Triggers hint={label} open />);
const single = { parameters: { matrix: false } };
export const LongArabicLabel: Story = { ...states['LongArabicLabel'], ...single };
export const MixedDirection: Story = { ...states['MixedDirection'], ...single };
export const Zoom200: Story = { ...states['Zoom200'], ...single };
export const ReducedMotion: Story = { ...states['ReducedMotion'], ...single };
