// RecordHeader stories, as on the approved sheet (owner, 2026-11-27, A03SheetRecordHeader): the
// owner's page with «تعديل» and «المزيد», the archived one (muted, «للقراءة فقط»), an estimated age
// with its tooltip, compact in a panel after saving, loading, and a phone width. Every story
// renders in the eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { type ComponentProps, useId } from 'react';
import { storyStates } from '../../.storybook/story-states.tsx';
import { nationalPhone, people, phones } from '../../test/fixtures.ts';
import { Button } from '../button/button.tsx';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../menu/menu.tsx';
import { RecordHeader, type RecordHeaderFact } from './record-header.tsx';

const [PATIENT, CHILD, EDITOR] = people(3, { seed: 41 }).map((p) => p.name);
const [PHONE, SECOND] = phones(2, { seed: 90 }).map(nationalPhone);
const FACTS: RecordHeaderFact[] = [
  { label: 'هاتف التواصل', value: PHONE ?? '', kind: 'latin' },
  { label: 'هاتف ثانٍ', value: SECOND ?? '', kind: 'latin' },
  { label: 'رقم الملف السابق', value: 'A-1180', kind: 'latin' },
  { label: 'سُجّل في', value: 'فرع الشهباء · 12/03/2026' },
];
const META = `آخر تعديل 20/11/2026 بيد ${EDITOR ?? ''}`;

/** The matrix draws each story eight times on one page: each copy's region gets its own name. */
function Header(props: ComponentProps<typeof RecordHeader>) {
  return (
    <RecordHeader {...props} aria-label={`${props['aria-label'] ?? props.title} ${useId()}`} />
  );
}

const ownerActions = (
  <>
    <Button startIcon="pencil">تعديل</Button>
    <Menu>
      <MenuTrigger icon="dots">المزيد</MenuTrigger>
      <MenuContent title="إجراءات الملف">
        <MenuItem value="merge" icon="users">
          دمج مع ملف آخر
        </MenuItem>
        <MenuItem value="print" icon="printer" disabled hint="لاحقًا">
          طباعة البطاقة
        </MenuItem>
        <MenuSeparator />
        <MenuItem value="archive" icon="archive" danger>
          أرشفة الملف
        </MenuItem>
      </MenuContent>
    </Menu>
  </>
);

const meta = {
  title: 'Components/RecordHeader',
  component: RecordHeader,
  args: { title: PATIENT ?? '' },
  parameters: {
    docs: {
      description: {
        component:
          'A record’s identity at the top of its page: the avatar, the `title` (h1, or h2 when `compact`), the number in a gold tag (`idLabel`, `idValue`), `badges` (one may carry a `tip`), `facts` under a rule, a `meta` line, then `actions` (Buttons and at most one Menu) or a `readOnlyNote`. `muted` for an archived or merged record drops the actions; `compact` inside a panel shows no facts and a larger number; `loading` shows a skeleton.\n\n**Accessibility.** A `role="region"` (a `section`) named by `aria-label`, the title by default; the title is the page’s `h1` (or `h2` when compact). The number is read «ملف 1043»; phones and codes are isolated left to right. A badge with `tip` is a `button` that opens its Tooltip at once on focus (Tab), and Escape closes it; its own text always says what the tooltip explains. The actions are ordinary Tab stops; the Menu is the system’s (arrows inside, a bottom sheet on touch). While loading the region is `aria-busy` and the skeleton is named by `loadingLabel`.',
      },
    },
  },
} satisfies Meta<typeof RecordHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The owner's page: «تعديل» and the «المزيد» menu. */
export const Page: Story = {
  render: () => (
    <Header
      aria-label="هوية المريض"
      title={PATIENT ?? ''}
      idLabel="ملف"
      idValue="1043"
      badges={[{ label: 'أنثى' }, { label: '34 سنة', icon: 'calendar' }]}
      facts={FACTS}
      meta={META}
      actions={ownerActions}
    />
  ),
};

/** Archived: muted, the «مؤرشف» badge, «للقراءة فقط», no actions. */
export const Archived: Story = {
  render: () => (
    <Header
      aria-label="هوية المريض"
      title={PATIENT ?? ''}
      idLabel="ملف"
      idValue="1043"
      muted
      badges={[
        { label: 'أنثى' },
        { label: '34 سنة', icon: 'calendar' },
        { label: 'مؤرشف', icon: 'archive' },
      ]}
      facts={FACTS}
      readOnlyNote="للقراءة فقط"
    />
  ),
};

/** An estimated age: a badge with its tooltip; the «~» stays visible. */
export const EstimatedAge: Story = {
  render: () => (
    <Header
      title={PATIENT ?? ''}
      idLabel="ملف"
      idValue="1043"
      badges={[
        { label: 'أنثى' },
        { label: '~40 سنة', tip: 'عمر تقريبي: سُجّل العمر دون تاريخ الميلاد.' },
      ]}
      facts={FACTS.slice(0, 2)}
      meta={META}
      actions={<Button startIcon="pencil">تعديل</Button>}
    />
  ),
};

/** Compact inside a panel, after saving: the number larger. Then loading. */
export const CompactAndLoading: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Header
        title={CHILD ?? ''}
        idLabel="ملف"
        idValue="1285"
        compact
        badges={[{ label: 'أنثى' }, { label: '9 سنوات', icon: 'calendar' }]}
        meta="ابنة صاحب الهاتف · سُجّل الآن في فرع الشهباء"
      />
      <Header title={PATIENT ?? ''} loading />
    </div>
  ),
};

/** A phone (358 px): the actions under the title, the facts in one column. */
export const Phone: Story = {
  render: () => (
    <div className="w-(--shifa-width-90) max-w-full">
      <Header
        title={PATIENT ?? ''}
        idLabel="ملف"
        idValue="1043"
        facts={FACTS}
        actions={ownerActions}
      />
    </div>
  ),
};

const states = storyStates((label) => (
  <Header title={label} idLabel="ملف" idValue="1043" badges={[{ label }]} meta={label} />
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
