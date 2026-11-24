// CodeList stories, as on the approved sheet (owner, 2026-11-24, `CodeListSheet`, ADR-0046). Every
// story renders in the eight combinations of direction × theme × density and is checked by axe.
// The codes are made up; the print sheet is hidden on screen (it shows only when printing).
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { CodeList } from './code-list.tsx';

const CODES = [
  'k7m2q-9xw4r',
  'h8zdt-3npwa',
  'p5rte-9cqeb',
  'b2nvk-7yfgm',
  'x6gjh-4tsmq',
  'c9wat-3hune',
  'r4yxe-6bnqz',
  'f7mck-2vjta',
  'u3ksy-5wgad',
  'd8qpm-4rzhe',
];

const meta = {
  title: 'Components/CodeList',
  component: CodeList,
  parameters: {
    docs: {
      description: {
        component:
          'The ten recovery codes, shown once after enrolment (and after «إنشاء رموز جديدة» on My account): numbered, in the mono font, two columns laid out left to right in both directions, with «نسخ الكل» and «طباعة». Copy puts one code per line without numbers and the button reads «نُسخت الرموز العشرة» with a tick for three seconds. Print prints only the sheet (light in both themes: the logo, the date, the person and the clinic, a box to cross out each code, the advice). The codes are never stored or sent: they live in the caller’s memory and go with the screen.\n\n**Accessibility.** An ordered list named by `label` («رموز الاسترداد العشرة»), isolated left to right inside the Arabic page; the visible numbers are hidden, since the list numbers each item. Tab reaches the two buttons; a copy is announced once through a status. The print sheet is hidden from screen readers (it duplicates the list).',
      },
    },
  },
  args: { codes: CODES },
} satisfies Meta<typeof CodeList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default row of the sheet, with print details. */
export const Default: Story = {
  args: {
    print: {
      title: 'رموز الاسترداد لحساب شفاء',
      who: 'شخص تجريبي · عيادة تجريبية',
      date: 'طُبعت 24/11/2026',
      note: 'كل رمز يعمل مرة واحدة؛ اشطب ما تستعمله. احفظ الورقة بعيداً عن الهاتف، ولا تصوّرها.',
    },
  },
};

/** Without print details: copy only. */
export const CopyOnly: Story = {};

const states = storyStates((label) => <CodeList codes={CODES} label={label} copyLabel={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
