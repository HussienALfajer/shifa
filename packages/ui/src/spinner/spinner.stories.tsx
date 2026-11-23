// Spinner stories, as on the approved sheet (owner, 2026-11-22, OD-64). Every story renders in the
// eight combinations of direction × theme × density and is checked by axe. The delay is 0 so the
// pictures show the spinner; in screens it waits 400 ms.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Button } from '../button/button.tsx';
import { Spinner } from './spinner.tsx';

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
  parameters: {
    docs: {
      description: {
        component:
          'Shifa’s loading indicator: the four jasmine petals of the logo light in turn. For waits without a known shape (a button, a panel, a page); content with a known shape uses Skeleton. It shows after 400 ms and then stays at least 400 ms; still under reduced motion.\n\n**Accessibility.** Alone it renders `role="status"` named by `label` («جارٍ التحميل» by default); the petals are hidden from screen readers, and so is the visible text of `showLabel`, so the name is read once. It has no keyboard interaction and takes no focus. Before the delay nothing is rendered, so a quick load announces nothing. Inside a busy Button it is hidden and the button says `aria-busy="true"` instead.',
      },
    },
  },
  args: { delay: 0 },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The three sizes in the brand colour, and in the text colour. */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <div className="flex items-center gap-4 text-brand-primary">
        <Spinner delay={0} size="sm" />
        <Spinner delay={0} size="md" />
        <Spinner delay={0} size="lg" />
      </div>
      <div className="flex items-center gap-4">
        <Spinner delay={0} size="sm" />
        <Spinner delay={0} size="md" />
        <Spinner delay={0} size="lg" />
      </div>
    </div>
  ),
};

/** Inside busy buttons: hidden, the buttons say they are busy. */
export const InButton: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button variant="primary" loading>
        حفظ الزيارة
      </Button>
      <Button loading>تحديث</Button>
    </div>
  ),
};

/** A whole panel waiting, with its label shown. */
export const Panel: Story = {
  render: () => (
    <div className="flex items-center justify-center p-16 rounded-surface border border-dashed border-border-default">
      <Spinner delay={0} size="lg" showLabel />
    </div>
  ),
};

const states = storyStates((label) => <Spinner delay={0} size="lg" showLabel label={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
