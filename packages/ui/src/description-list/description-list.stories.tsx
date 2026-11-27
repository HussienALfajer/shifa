// DescriptionList stories, as on the approved sheet (owner, 2026-11-27, A03SheetDescriptionList):
// one column with sections, an empty value and a sensitive badge; two columns; a flat list with a
// long value that wraps; loading. Every story renders in the eight combinations of direction ×
// theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { DescriptionList, type DescriptionListSection } from './description-list.tsx';

const SECTIONS: DescriptionListSection[] = [
  { id: 'ref', title: 'الإحالة', rows: [{ id: 'r1', label: 'جهة الإحالة', value: 'طبيب آخر' }] },
  {
    id: 'ins',
    title: 'التأمين',
    rows: [
      { id: 'i1', label: 'شركة التأمين', value: 'تأمين الشمال' },
      { id: 'i2', label: 'رقم بطاقة التأمين', value: '40017733', kind: 'latin' },
    ],
  },
  {
    id: 'w',
    title: 'الإعفاء',
    rows: [
      {
        id: 'w1',
        label: 'سبب الإعفاء من الرسوم',
        value: 'حالة اجتماعية',
        badge: { label: 'حساس', tone: 'warning', icon: 'eye' },
      },
      { id: 'w2', label: 'أفضل وقت للاتصال', value: '' },
    ],
  },
];

const FLAT: DescriptionListSection[] = [
  {
    id: 'flat',
    rows: [
      { id: 'a', label: 'جهة الإحالة', value: 'طبيب آخر' },
      {
        id: 'b',
        label: 'ملاحظة إدارية',
        value: 'يفضّل المواعيد بعد الظهر لأن عمله صباحًا، ويحضر مع ابنته غالبًا.',
      },
      { id: 'c', label: 'رسائل التذكير', value: 'نعم' },
    ],
  },
];

const meta = {
  title: 'Components/DescriptionList',
  component: DescriptionList,
  args: { 'aria-label': 'حقول العيادة', sections: SECTIONS },
  parameters: {
    docs: {
      description: {
        component:
          'Labels and their values grouped by section: the clinic’s fields on a patient’s chart, later the details of any record. An empty value shows «—» muted; a value may carry one `badge` («حساس»); `kind: \'latin\'` isolates card numbers and codes left to right; `columns={2}` puts sections side by side (320 px each at least, one column when narrow); `loading` shows a skeleton. Read-only: editing happens in the record’s form.\n\n**Accessibility.** A `role="group"` named by `aria-label`; each section is a `dl` of `dt` and `dd` under an `h3`. It has no keyboard interaction (nothing in it is pressed). An empty value is read «فارغ» (`emptyLabel`), not «dash»; a badge is read after its value. While loading the group is `aria-busy` and the skeleton is named by `loadingLabel`.',
      },
    },
  },
} satisfies Meta<typeof DescriptionList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One column: sections, an empty value, a sensitive badge. */
export const Sections: Story = {};

/** Two columns in a wide card. */
export const TwoColumns: Story = { args: { columns: 2 } };

/** No section titles; a long value wraps. */
export const Flat: Story = { args: { sections: FLAT } };

/** Loading. */
export const Loading: Story = { args: { loading: true } };

const states = storyStates((label) => (
  <DescriptionList
    aria-label="حقول"
    sections={[{ id: 's', title: label, rows: [{ id: 'r', label, value: label }] }]}
  />
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
