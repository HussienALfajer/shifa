// Textarea stories, as on the approved sheet (owner, 2026-11-20). Every story renders in the eight
// combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Textarea } from './textarea.tsx';

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  args: { label: 'ملاحظات للطبيب' },
  parameters: {
    docs: {
      description: {
        component:
          'Longer text in the field box; it grows with its text. With `maxLength`, a «n / max» counter in Western digits at the logical end.\n\n**Accessibility.** It renders a native `textarea` (`role="textbox"`) named by its `label`. Tab reaches it (a disabled one is skipped, a read-only one is reached but not edited); Enter adds a line and never submits the form. Screen readers hear the label, the hint and the error through `aria-describedby`, and `aria-invalid` when there is an error; the counter is hidden from them. Give it a `label`, or place it in a `Field` that has one.',
      },
    },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** With a counter and a hint, an error, disabled, read-only. */
export const States: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Textarea
        {...args}
        defaultValue="يفضّل موعداً بعد الظهر، ويحتاج إلى مرافق."
        maxLength={500}
        hint="تظهر للطبيب فقط"
      />
      <Textarea {...args} error="500 حرف على الأكثر" />
      <Textarea {...args} defaultValue="يفضّل موعداً بعد الظهر." disabled />
      <Textarea {...args} defaultValue="يفضّل موعداً بعد الظهر." readOnly />
    </div>
  ),
};

const states = storyStates((label) => (
  <Textarea label={label} defaultValue="حساسية من البنسلين." />
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
