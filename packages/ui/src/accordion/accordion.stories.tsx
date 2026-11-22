// Accordion stories, as on the approved sheet (owner, 2026-11-22). Every story renders in the eight
// combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Accordion, AccordionItem } from './accordion.tsx';

const meta = {
  title: 'Components/Accordion',
  component: Accordion,
  parameters: {
    // Each open panel is a region named by its header. The matrix draws the same accordion eight
    // times, so the names repeat across copies; one copy (accordion.test.tsx) is clean under axe
    // with this rule on.
    a11y: { config: { rules: [{ id: 'landmark-unique', enabled: false }] } },
    docs: {
      description: {
        component:
          'Sections of one record that fold away. Each header is a 48 px button in a heading (32 compact), the caret at the logical end; open, the caret turns over and the text is heavier. Enter and Space open and close; the vertical arrows move between headers, Home and End reach the ends, a disabled header is skipped. One section open at a time; `multiple` keeps several open.',
      },
    },
  },
  args: { children: null },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

function PatientSections({
  title = 'الحساسية والأمراض المزمنة',
  multiple,
}: {
  title?: string;
  multiple?: boolean;
}) {
  return (
    <Accordion
      defaultValue={multiple === true ? ['allergies', 'medicines'] : ['allergies']}
      {...(multiple === undefined ? {} : { multiple })}
    >
      <AccordionItem value="allergies" title={title}>
        <p className="m-0">حساسية من البنسلين</p>
        <p className="m-0">ارتفاع ضغط، منذ 2019</p>
      </AccordionItem>
      <AccordionItem value="medicines" title="الأدوية الحالية">
        أملوديبين 5 ملغ، مرة يومياً
      </AccordionItem>
      <AccordionItem value="visits" title="الزيارات السابقة" badge="4">
        آخر زيارة 12/11/2026 · فحص دوري
      </AccordionItem>
      <AccordionItem value="insurance" title="ملاحظات التأمين (غير متاحة)" disabled>
        لا تأمين
      </AccordionItem>
    </Accordion>
  );
}

/** One section open, a count, a disabled section. */
export const Default: Story = { render: () => <PatientSections /> };

/** Several sections open at once. */
export const Multiple: Story = { render: () => <PatientSections multiple /> };

/** The arrows move between headers and skip the disabled one. */
export const Keyboard: Story = {
  // One copy only: the rule the matrix stories turn off is on here.
  parameters: {
    matrix: false,
    a11y: { config: { rules: [{ id: 'landmark-unique', enabled: true }] } },
  },
  render: () => <PatientSections />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole('button', { name: 'الحساسية والأمراض المزمنة' });
    first.focus();
    await userEvent.keyboard('{End}');
    await expect(canvas.getByRole('button', { name: 'الزيارات السابقة' })).toHaveFocus();
  },
};

const states = storyStates((label) => <PatientSections title={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
