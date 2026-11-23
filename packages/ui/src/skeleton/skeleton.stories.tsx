// Skeleton stories, as on the approved sheet (owner, 2026-11-22). Every story renders in the eight
// combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton, SkeletonGroup, SkeletonText } from './skeleton.tsx';

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  parameters: {
    docs: {
      description: {
        component:
          'Placeholders for content whose shape is known: blocks, text lines (the last one shorter) and a circle on the raised surface. A soft pulse that stops under reduced motion. Waits without a shape use Spinner.\n\n**Accessibility.** It has no keyboard interaction: nothing in it takes focus. Every piece is `aria-hidden`, so screen readers skip it. Wrap the pieces in SkeletonGroup, a `role="status"` with `aria-busy="true"`, whose required `label` («جارٍ تحميل بطاقة المريض») is what is announced while the content loads.',
      },
    },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

function PersonCard() {
  return (
    <SkeletonGroup
      label="جارٍ تحميل بطاقة المريض"
      className="w-(--shifa-size-popover) rounded-surface border border-border-default p-5"
    >
      <div className="flex items-center gap-3">
        <Skeleton shape="circle" className="size-10" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton shape="line" className="w-1/2" />
          <Skeleton shape="line" className="w-1/3" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </SkeletonGroup>
  );
}

/** A person's card loading. */
export const Card: Story = { render: () => <PersonCard /> };

/** A picture and a caption loading. */
export const Media: Story = {
  render: () => (
    <SkeletonGroup
      label="جارٍ تحميل الصورة"
      className="w-(--shifa-size-popover) rounded-surface border border-border-default p-5"
    >
      <Skeleton className="h-16 w-full" />
      <div className="flex items-center gap-3">
        <Skeleton shape="line" className="w-1/4" />
        <Skeleton shape="line" className="ms-auto w-1/6" />
      </div>
    </SkeletonGroup>
  ),
};

/** Still under reduced motion. */
export const ReducedMotion: Story = {
  render: () => (
    <div data-motion="reduce">
      <PersonCard />
    </div>
  ),
};
