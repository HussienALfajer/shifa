// Toolbar stories, as on the approved sheet (owner, 2026-11-22). Every story renders in the eight
// combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Toolbar, ToolbarButton, ToolbarSeparator } from './toolbar.tsx';

const meta = {
  title: 'Components/Toolbar',
  component: Toolbar,
  parameters: {
    docs: {
      description: {
        component:
          'A strip of light buttons, groups split by separators; a toggle that is on shows the selected tint. When narrow, the last buttons move into «المزيد».\n\n**Accessibility.** A `role="toolbar"` named by the required `aria-label`, its buttons native `button`s named by their text. One Tab stop: Tab enters on one button and the next Tab leaves the strip; the arrows follow the reading direction (Left is next in Arabic), Home and End reach the ends, a disabled button is skipped, no wrapping. A screen reader hears a toggle that is on as pressed (`aria-pressed`) and a separator as vertical. Buttons that moved into «المزيد» are items of its menu, under the same names.',
      },
    },
  },
  args: { 'aria-label': 'أدوات قائمة المرضى', children: null },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

function PatientTools() {
  return (
    <Toolbar aria-label="أدوات قائمة المرضى">
      <ToolbarButton icon="printer">طباعة</ToolbarButton>
      <ToolbarButton icon="file-text">تصدير</ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton pressed>الأحدث أولاً</ToolbarButton>
      <ToolbarButton disabled>دمج</ToolbarButton>
      <ToolbarButton icon="list">الأعمدة</ToolbarButton>
    </Toolbar>
  );
}

/** Wide: every button shows. */
export const Default: Story = { render: () => <PatientTools /> };

/** Fixture geometry, not a design value: a narrow column where the toolbar overflows. */
// eslint-disable-next-line shifa/no-hardcoded-design-values -- story fixture: a 240 px column
const NARROW: CSSProperties = { width: 240 };

/** Narrow: the last buttons wait in «المزيد». */
export const Narrow: Story = {
  render: () => (
    <div style={NARROW}>
      <PatientTools />
    </div>
  ),
};

/** The text states: the label on the first button, a short one beside it. */
const states = storyStates((label) => (
  <Toolbar aria-label="أدوات قائمة المرضى">
    <ToolbarButton icon="printer">{label}</ToolbarButton>
    <ToolbarButton icon="file-text">تصدير</ToolbarButton>
  </Toolbar>
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
