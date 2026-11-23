// Switch stories, as on the approved sheet (owner, 2026-11-20). Every story renders in the eight
// combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Switch } from './switch.tsx';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  args: { children: 'تذكير عبر واتساب' },
  parameters: {
    docs: {
      description: {
        component:
          'A setting that acts at once: a 44 × 24 track; on, green with the thumb at the logical end (the left in Arabic) and a tick.\n\n**Accessibility.** It renders `role="switch"` inside a `label`, so its text (`children`) is its name and a click on the text toggles it too. Tab reaches it; Space toggles, Enter never does; a disabled switch leaves the tab order. Screen readers announce it as on or off (checked), and `description` is read with it through `aria-describedby`; the tick and thumb are drawing only.',
      },
    },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Off, on, disabled, disabled and on, a description. */
export const States: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 sm:grid-cols-2">
      <Switch {...args} />
      <Switch {...args} defaultChecked />
      <Switch {...args} disabled />
      <Switch {...args} disabled defaultChecked />
      <Switch defaultChecked description="يظهر للمرضى زر «احجز»">
        قبول الحجز من صفحة العيادة
      </Switch>
    </div>
  ),
};

const states = storyStates((label) => <Switch defaultChecked>{label}</Switch>);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
