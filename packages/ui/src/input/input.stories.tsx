// Input stories, as on the approved sheet (owner, 2026-11-20). Every story renders in the eight
// combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { people } from '../../test/fixtures.ts';
import { Input } from './input.tsx';

const [patient] = people(1, { seed: 31 });
const name = patient?.name ?? '';

const meta = {
  title: 'Components/Input',
  component: Input,
  args: { label: 'اسم المريض' },
  parameters: {
    docs: {
      description: {
        component:
          'One line of text in the shared field box (44 px, 32 compact): hover darkens the border, focus shows the green ring at once, an error is a 2 px danger border with an icon and text, disabled is pale and out of the tab order, read-only stays readable. `dir="auto"` for Latin content (phone, email, medicine).',
      },
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The seven states of the sheet, and Latin content in an Arabic form. */
export const States: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Input {...args} placeholder="مثال: سارة الأحمد" />
      <Input {...args} defaultValue={name} />
      <Input {...args} required error="اكتب اسم المريض" />
      <Input {...args} defaultValue={name} disabled />
      <Input label="رقم الملف" defaultValue="1042" readOnly />
      <Input
        label="بحث"
        startIcon="magnifying-glass"
        placeholder="اسم أو رقم هاتف"
        hint="يكفي جزء من الاسم"
      />
      <Input label="البريد" type="email" dir="auto" defaultValue="sara.ahmad@example.com" />
      <Input label="الدواء" dir="auto" defaultValue="Amoxicillin 500 mg" />
    </div>
  ),
};

const states = storyStates((label) => <Input label={label} defaultValue="1042" />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
