// Tabs stories, as on the approved sheet (owner, 2026-11-20). Every story renders in the eight
// combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Tab, TabList, TabPanel, Tabs } from './tabs.tsx';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  parameters: {
    docs: {
      description: {
        component:
          'Tabs switch between views of one thing (a patient record). The selected tab is green, heavier and underlined.\n\n**Accessibility.** It renders `role="tablist"` of `tab`s, each tab `aria-controls` its `tabpanel`. Only the selected tab is a Tab stop; the Arrow keys follow the reading direction (ArrowLeft is next in Arabic, ArrowRight in English), Home and End reach the first and last tab, and the tab that takes focus is selected at once. Screen readers announce each tab with its selected state; a disabled tab is reachable by the arrows and announced as disabled (`aria-disabled`), but Enter never selects it. `TabList` needs an `aria-label` that names the set («ملف المريض»).',
      },
    },
  },
  args: { children: null },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

function PatientTabs({ label = 'الملخص' }: { label?: string }) {
  return (
    <Tabs defaultValue="summary">
      <TabList aria-label="ملف المريض">
        <Tab value="summary">{label}</Tab>
        <Tab value="visits">الزيارات</Tab>
        <Tab value="prescriptions">الوصفات</Tab>
        <Tab value="bills">الفواتير</Tab>
        <Tab value="files" disabled>
          المرفقات
        </Tab>
      </TabList>
      <TabPanel value="summary">آخر زيارة: 12/11/2026 · فحص دوري</TabPanel>
      <TabPanel value="visits">ثلاث زيارات هذا العام</TabPanel>
      <TabPanel value="prescriptions">وصفة واحدة سارية</TabPanel>
      <TabPanel value="bills">لا فواتير مستحقة</TabPanel>
      <TabPanel value="files">لا مرفقات</TabPanel>
    </Tabs>
  );
}

/** Selected, at rest and disabled (hover and focus are in the gate tests). */
export const Default: Story = { render: () => <PatientTabs /> };

const states = storyStates((label) => <PatientTabs label={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};

/** Keyboard: Tab reaches the selected tab; Left moves to the next tab in Arabic. */
export const Keyboard: Story = {
  parameters: { matrix: false },
  render: () => <PatientTabs />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(canvas.getByRole('tab', { name: 'الملخص' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('tab', { name: 'الزيارات' })).toHaveFocus();
    await expect(canvas.getByRole('tab', { name: 'الزيارات' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  },
};
