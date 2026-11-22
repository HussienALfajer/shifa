// Toolbar stories, as on the approved sheet (owner, 2026-11-22). Every story renders in the eight
// combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import { Toolbar, ToolbarButton, ToolbarSeparator } from './toolbar.tsx';

const meta = {
  title: 'Components/Toolbar',
  component: Toolbar,
  parameters: {
    docs: {
      description: {
        component:
          'A strip of light buttons with one Tab stop: the arrows follow the reading direction (Left is next in Arabic), Home and End reach the ends, a disabled button is skipped, no wrapping. Groups are split by separators; a toggle that is on is pressed (aria-pressed). When narrow, the last buttons move into «المزيد».',
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
