// RecordList stories, as on the approved sheet (owner, 2026-11-27, A03SheetRecordList): the search
// table with matched words, a current, a merged and an archived row; a family and duplicate
// candidates in two lines (a button, a hidden row); recently opened as tiles; treating doctors
// with a badge; a clinic's fields with a type icon and row tools; loading, empty and a phone width.
// Every story renders in the eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { DOCTORS, nationalPhone, people, phones } from '../../test/fixtures.ts';
import { RecordList, type RecordListColumn, type RecordListItem } from './record-list.tsx';

const NAMES = people(6, { seed: 31 }).map((p) => p.name);
const name = (i: number) => NAMES[i] ?? '';
const [P1, P2, P3] = phones(3, { seed: 77 }).map(nationalPhone);
const COLUMNS: RecordListColumn[] = [
  { header: 'رقم الملف', weight: 0.7 },
  { header: 'الجنس والعمر' },
  { header: 'هاتف التواصل', weight: 1.5 },
];
const patient = (
  id: string,
  title: string,
  sexAge: string,
  phone: string,
  extra: Partial<RecordListItem> = {},
): RecordListItem => ({
  id,
  title,
  href: `#patient-${id}`,
  cells: [{ text: id, kind: 'number' }, { text: sexAge }, { text: phone, kind: 'latin' }],
  ...extra,
});

const SEARCH: RecordListItem[] = [
  patient('1043', name(0), 'أنثى · 34 سنة', P1 ?? '', {
    matches: [0],
    details: [{ text: 'الاسم' }],
    current: true,
  }),
  patient('1187', name(2), 'أنثى · ~9 سنوات', P1 ?? '', {
    details: [{ text: 'الاسم بتهجئة قريبة' }, { text: 'ابنة صاحب الهاتف' }],
  }),
  patient('1077', name(0), 'أنثى · 34 سنة', P1 ?? '', {
    details: [{ badge: 'مدموج', tone: 'info' }, { text: 'الملف 1077 دُمج في الملف 1043' }],
  }),
  patient('214', name(4), 'أنثى · 70 سنة', P2 ?? '', {
    matches: [0],
    details: [{ badge: 'مؤرشف', icon: 'archive' }, { text: 'أُرشف في 02/09/2026' }],
    dim: true,
  }),
];

const noop = () => undefined;

const meta = {
  title: 'Components/RecordList',
  component: RecordList,
  args: { 'aria-label': 'نتائج البحث', items: SEARCH, columns: COLUMNS, titleHeader: 'المريض' },
  parameters: {
    docs: {
      description: {
        component:
          'Rows of people or records: search results, a family, duplicate candidates, treating doctors, the recently opened, a clinic’s fields. Each item has a `title` (with `matches`, the indexes of its matched words, shown heavier), the avatar or an `icon`, `details` (short texts and badges), `cells` for the `columns` of the table layout, and at its end a chevron (an `href` row is a link), an `action`, `tools`, or a `badge`. `locked` hides a record’s name and avatar; `dim` mutes an archived one; `current` marks the selected one. Layouts `table` (shown as two lines under 640 px), `stack` and `tiles`; sizes `md` and `sm`; `loading`, `empty` and a `footer`. Use `onOpen` to route a link row in the app.\n\n**Accessibility.** A `role="list"` named by `aria-label`, each row a `listitem`. The link rows share one Tab stop: ↑ and ↓ move between rows, Home and End go to the first and last, Enter opens the link. A row with its own buttons keeps them in the Tab order and the arrows land on its first one. Each row is read once: the title, the second line, then each column with its header (the visible header row is `aria-hidden`); the avatar is not read again. A locked row is read by its title and its lock’s label («مخفي عنك», `lockedLabel`). The current row has `aria-current="true"`. Matched words are bold, never another colour, and read as plain text. While loading the list is `aria-busy`.',
      },
    },
  },
} satisfies Meta<typeof RecordList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Search results: table, matched words, a current, a merged and an archived row, a footer. */
export const Table: Story = {
  args: { footer: '4 نتائج، الأقرب أولًا · ↑ ↓ للتنقل، Enter لفتح الملف' },
};

/** A family and duplicate candidates in two lines, sm: links; a button and a hidden row. */
export const TwoLines: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <RecordList
        aria-label="العائلة"
        layout="stack"
        size="sm"
        items={[
          {
            id: '1012',
            title: name(1),
            details: [{ text: 'صاحب الهاتف' }, { text: 'ملف 1012' }, { text: '41 سنة' }],
            href: '#1012',
          },
          {
            id: '1043',
            title: name(0),
            details: [{ text: 'زوجة' }, { text: 'ملف 1043' }, { text: '34 سنة' }],
            href: '#1043',
          },
          {
            id: '1188',
            title: name(3),
            details: [{ text: 'ابن' }, { text: 'ملف 1188' }, { text: '14 شهرًا' }],
            href: '#1188',
          },
        ]}
      />
      <RecordList
        aria-label="ملفات مشابهة"
        layout="stack"
        size="sm"
        items={[
          {
            id: '88',
            title: name(3),
            details: [
              { text: 'ملف 88' },
              { text: 'ذكر · 45 سنة' },
              { text: 'الهاتف نفسه واسم قريب' },
            ],
            action: { label: 'فتح الملف', onClick: noop },
          },
          {
            id: '1190',
            locked: true,
            title: 'ملف مشابه لدى طبيب آخر',
            details: [{ text: 'ملف 1190' }, { text: 'لا تظهر لك تفاصيله' }],
          },
          {
            id: '214',
            title: name(3),
            details: [
              { badge: 'مؤرشف', icon: 'archive' },
              { text: 'ملف 214' },
              { text: 'اطلب من المالك استعادته' },
            ],
            action: { label: 'فتح الملف', onClick: noop },
            dim: true,
          },
        ]}
      />
    </div>
  ),
};

/** Recently opened as tiles; treating doctors with a trailing badge; fields with a type icon and tools. */
export const TilesAndTools: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <RecordList
        aria-label="فتحتها مؤخرًا"
        layout="tiles"
        size="sm"
        framed={false}
        items={[0, 1, 2, 5].map((i, at) => ({
          id: `r${String(i)}`,
          title: name(i),
          details: [
            { text: String(1043 + i) },
            { text: ['قبل 5 دقائق', 'قبل 20 دقيقة', 'اليوم 09:40', 'أمس 17:05'][at] ?? '' },
          ],
          href: `#r${String(i)}`,
        }))}
      />
      <RecordList
        aria-label="الأطباء المعالجون"
        layout="stack"
        size="sm"
        framed={false}
        items={[
          { id: 'd1', title: DOCTORS[0]?.name ?? '', details: [{ text: 'أُضيف عند التسجيل' }] },
          {
            id: 'd2',
            title: DOCTORS[1]?.name ?? '',
            details: [{ text: 'لم يعد في الفريق · يبقى على الملف' }],
            badge: { label: 'غير نشط' },
            dim: true,
          },
        ]}
      />
      <RecordList
        aria-label="حقول ملف المريض"
        layout="stack"
        size="sm"
        items={[
          {
            id: 'f1',
            icon: 'check-circle',
            title: 'جهة الإحالة',
            details: [
              { badge: 'اختيار واحد' },
              { badge: 'مطلوب', tone: 'brand' },
              { text: 'يراه الكل' },
            ],
            tools: [
              {
                icon: 'caret-up',
                label: 'نقل «جهة الإحالة» للأعلى',
                onClick: noop,
                disabled: true,
              },
              { icon: 'caret-down', label: 'نقل «جهة الإحالة» للأسفل', onClick: noop },
            ],
            action: { label: 'تعديل', onClick: noop },
          },
          {
            id: 'f2',
            icon: 'pencil',
            title: 'رقم بطاقة التأمين',
            details: [
              { badge: 'نص' },
              { badge: 'قابل للبحث', tone: 'outline', icon: 'magnifying-glass' },
            ],
            tools: [
              { icon: 'caret-up', label: 'نقل «رقم بطاقة التأمين» للأعلى', onClick: noop },
              {
                icon: 'caret-down',
                label: 'نقل «رقم بطاقة التأمين» للأسفل',
                onClick: noop,
                disabled: true,
              },
            ],
            action: { label: 'تعديل', onClick: noop },
          },
        ]}
      />
    </div>
  ),
};

/** Loading, empty, and the table on a phone (358 px): two lines. */
export const LoadingEmptyPhone: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <RecordList aria-label="نتائج قيد التحميل" items={SEARCH} columns={COLUMNS} loading />
      <RecordList
        aria-label="نتائج فارغة"
        items={[]}
        empty={{
          title: `لا ملف يطابق «${name(5)}»`,
          description: 'تأكد من الكتابة، أو ابحث بالهاتف.',
        }}
      />
      <div className="w-(--shifa-width-90) max-w-full">
        <RecordList
          aria-label="نتائج على الهاتف"
          items={[
            ...SEARCH.slice(0, 2),
            patient('1220', name(5), 'أنثى · 27 سنة', P3 ?? '', {
              details: [{ text: 'رقم تركي' }],
            }),
          ]}
          columns={COLUMNS}
        />
      </div>
    </div>
  ),
};

/** ↓ and End move between the link rows behind one Tab stop. */
export const Keyboard: Story = {
  parameters: { matrix: false },
  args: {
    layout: 'stack',
    onOpen: (_id, event) => {
      event.preventDefault();
    },
  },
  play: async ({ canvasElement }) => {
    const links = within(canvasElement).getAllByRole('link');
    links[0]?.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(links[1]).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(links.at(-1)).toHaveFocus();
  },
};

const states = storyStates((label) => (
  <RecordList
    aria-label="نتائج"
    layout="stack"
    items={[{ id: '1', title: label, details: [{ text: label }], href: '#1' }]}
  />
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
