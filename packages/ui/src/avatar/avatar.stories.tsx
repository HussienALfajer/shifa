// Avatar stories, as on the approved sheet (owner, 2026-11-22, OD-64). Every story renders in the
// eight combinations of direction × theme × density and is checked by axe. Names are synthetic.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { latinPeople, people } from '../../test/fixtures.ts';
import { Avatar, AvatarGroup } from './avatar.tsx';

/** A generated name in Latin letters, for the mixed-direction line (slice 0.4-12). */
const LATIN = latinPeople(1)[0]?.name ?? '';

const CREW = people(6, { seed: 31 });
const name = (i: number) => CREW[i]?.name ?? '';

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  parameters: {
    docs: {
      description: {
        component:
          'A person’s picture; while it loads or when it fails, the first letters of the first and last names («ال» and «د.» skipped; a Latin name two capitals) on one of six avatar hues chosen from the name. Sizes xs 24, sm 32, md 40, lg 56, xl 80. AvatarGroup overlaps toward the logical end and counts the rest.\n\n**Accessibility.** A `role="img"` whose accessible name is the full name; the picture (`alt=""`) and the initials are hidden from screen readers, and Latin initials are isolated in `<bdi>`. It has no keyboard interaction: an avatar is never focused or pressed (put it inside a link or button for that). AvatarGroup is a `role="group"` named by its required `label`; the count of the rest is announced in words («و3 آخرون», `moreLabel`), not as «+3».',
      },
    },
  },
  args: { name: name(0) },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The five sizes. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size, i) => (
        <Avatar key={size} name={name(i)} size={size} />
      ))}
    </div>
  ),
};

/** Initials: Arabic names, a Latin name, a single name, a broken picture. */
export const Initials: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar name={name(1)} />
      <Avatar name={name(2)} />
      <Avatar name={LATIN} />
      <Avatar name={name(3).split(' ')[0] ?? ''} />
      <Avatar name={name(4)} src="/no-such-picture.png" />
    </div>
  ),
};

/** Beside a name, and a group with the rest counted. */
export const Group: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4 font-ui">
      <div className="flex items-center gap-3">
        <Avatar name={name(5)} />
        <div className="flex flex-col">
          <span className="text-body leading-heading font-medium">د. {name(5)}</span>
          <span className="text-data text-text-muted">طب الأسنان · الغرفة 2</span>
        </div>
      </div>
      <AvatarGroup label="الأطباء المناوبون" people={CREW} max={3} />
    </div>
  ),
};

/** The text states: the avatar drawn from the label as a name, the name beside it. */
const states = storyStates((label) => (
  <div className="flex items-center gap-3">
    <Avatar name={label} />
    <span className="text-body leading-heading font-medium">{label}</span>
  </div>
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
/** Mixed direction: a Latin name (two capitals, isolated) beside an Arabic title. */
export const MixedDirection: Story = {
  ...states['MixedDirection'],
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar name={LATIN} />
      <span className="text-body leading-heading font-medium">
        د. <bdi>{LATIN}</bdi>
      </span>
    </div>
  ),
};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
