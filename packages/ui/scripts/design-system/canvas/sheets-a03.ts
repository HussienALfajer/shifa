// The sheets of the components A-03 added (A-03-01, approved by the owner 2026-11-27; built in
// A-03-12): RecordList, RecordHeader, DescriptionList and EditableList, every state of each, from
// the system's bundle (the Drawer's wide size is on the Drawer sheet). Data in data-a03.ts.
import {
  CANDIDATES,
  CHOICE_LIST,
  CHOICES,
  FAMILY,
  FIELD_ROWS,
  FLAT,
  HEADER,
  LIST,
  name,
  RECENT,
  RECORD_MENU,
  SEARCH,
  SECTIONS,
  TREATING,
} from './data-a03.ts';
import { type SheetSpec, st } from './types.ts';

export const A03_SHEETS: SheetSpec[] = [
  {
    name: 'RecordList',
    group: 'Data display',
    fill: true,
    layout: 'stack',
    desc: 'Rows of people or records: search results, a family, duplicate candidates, treating doctors, the recently opened, a clinic’s fields. The avatar or a type icon, the title with the matched words heavier, a second line of badges and texts, columns in the table layout (two lines under 640 px), and at the end a chevron (the row is a link), a button, tools or a badge.',
    play: 'Tab into a list, then ↑ ↓ Home End between the rows; Enter opens a link row.',
    blocks: () => [
      {
        label: 'Table · matched words, a current, a merged and an archived row',
        cols: 1,
        items: [
          st(
            {
              ...LIST,
              items: SEARCH,
              footer: '4 نتائج، الأقرب أولًا · ↑ ↓ للتنقل، Enter لفتح الملف',
            },
            'table, md',
          ),
        ],
      },
      {
        label: 'Two lines, sm',
        cols: 2,
        items: [
          st(
            { 'aria-label': 'العائلة', layout: 'stack', size: 'sm', items: FAMILY },
            'a family: link rows',
          ),
          st(
            { 'aria-label': 'ملفات مشابهة', layout: 'stack', size: 'sm', items: CANDIDATES },
            'candidates: a button, a hidden row, an archived one',
          ),
          st(
            {
              'aria-label': 'الأطباء المعالجون',
              layout: 'stack',
              size: 'sm',
              framed: false,
              items: TREATING,
            },
            'treating doctors: a badge at the end, unframed',
          ),
          st(
            { 'aria-label': 'حقول ملف المريض', layout: 'stack', size: 'sm', items: FIELD_ROWS },
            'a clinic’s fields: a type icon, tools and a button',
          ),
        ],
      },
      {
        label: 'Tiles, sm',
        cols: 1,
        items: [
          st(
            {
              'aria-label': 'فتحتها مؤخرًا',
              layout: 'tiles',
              size: 'sm',
              framed: false,
              items: RECENT,
            },
            'recently opened',
          ),
        ],
      },
      {
        label: 'Loading, empty, a phone',
        cols: 2,
        items: [
          st(
            { ...LIST, 'aria-label': 'نتائج قيد التحميل', items: SEARCH, loading: true },
            'loading',
          ),
          st(
            {
              ...LIST,
              'aria-label': 'نتائج فارغة',
              items: [],
              empty: {
                title: `لا ملف يطابق «${name(3)}»`,
                description: 'تأكد من الكتابة، أو ابحث بالهاتف.',
              },
            },
            'empty',
          ),
          st(
            { ...LIST, 'aria-label': 'نتائج على الهاتف', items: SEARCH.slice(0, 3) },
            'the table on a phone: two lines',
            null,
            { w: 358 },
          ),
        ],
      },
    ],
  },
  {
    name: 'RecordHeader',
    group: 'Data display',
    fill: true,
    layout: 'stack',
    desc: 'A record’s identity at the top of its page: the avatar, the title, the number in a gold tag («ملف 1061»), badges (one with a Tooltip for an estimated age), the facts under a rule, a meta line, then the actions or «للقراءة فقط». Muted for an archived or merged record; compact in a panel.',
    play: 'Tab to «~40 سنة» for its tooltip; open «المزيد».',
    blocks: () => [
      {
        label: 'Page',
        cols: 1,
        items: [
          st(
            {
              ...HEADER,
              'aria-label': 'هوية المريض 1',
              actions: [{ label: 'تعديل', icon: 'pencil' }, RECORD_MENU],
            },
            'the owner: «تعديل» and «المزيد»',
          ),
          st(
            {
              ...HEADER,
              'aria-label': 'هوية المريض 2',
              badges: [
                { label: 'ذكر' },
                { label: '~40 سنة', tip: 'عمر تقريبي: سُجّل العمر دون تاريخ الميلاد.' },
              ],
              actions: [{ label: 'تعديل', icon: 'pencil' }],
            },
            'an estimated age: a badge with its tooltip',
          ),
          st(
            {
              ...HEADER,
              'aria-label': 'هوية المريض 3',
              muted: true,
              badges: [
                { label: 'ذكر' },
                { label: '34 سنة', icon: 'calendar' },
                { label: 'مؤرشف', icon: 'archive' },
              ],
              readOnlyNote: 'للقراءة فقط',
            },
            'archived: muted, «للقراءة فقط», no actions',
          ),
        ],
      },
      {
        label: 'In a panel, loading, a phone',
        cols: 2,
        items: [
          st(
            {
              'aria-label': 'الملف المحفوظ',
              title: name(3),
              idLabel: 'ملف',
              idValue: '1285',
              compact: true,
              badges: [{ label: 'أنثى' }, { label: '9 سنوات', icon: 'calendar' }],
              meta: 'ابنة صاحب الهاتف · سُجّل الآن في فرع الشهباء',
            },
            'compact after saving: h2, the number larger',
          ),
          st({ 'aria-label': 'ملف قيد الفتح', title: name(0), loading: true }, 'loading'),
          st(
            {
              ...HEADER,
              'aria-label': 'هوية المريض 4',
              actions: [{ label: 'تعديل', icon: 'pencil' }, RECORD_MENU],
            },
            'a phone: the actions under the title, facts in one column',
            null,
            { w: 358 },
          ),
        ],
      },
    ],
  },
  {
    name: 'DescriptionList',
    group: 'Data display',
    fill: true,
    desc: 'Labels and their values by section: a clinic’s fields on a patient’s chart. An empty value shows «—» muted and is read «فارغ»; one badge per value («حساس»); latin values isolated left to right; one column, or two when there is room.',
    play: 'Nothing is pressed here: editing is the record’s form.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st(
            { 'aria-label': 'حقول العيادة 1', sections: SECTIONS },
            'sections, an empty value, sensitive',
          ),
          st(
            { 'aria-label': 'حقول العيادة 2', sections: FLAT },
            'no section titles, a long value wraps',
          ),
          st({ 'aria-label': 'حقول العيادة 3', sections: SECTIONS, loading: true }, 'loading'),
          st({ 'aria-label': 'حقول العيادة 4', sections: SECTIONS }, 'a phone', null, { w: 358 }),
        ],
      },
      {
        label: 'Two columns (a wide card)',
        cols: 1,
        items: [
          st(
            { 'aria-label': 'حقول العيادة 5', sections: SECTIONS, columns: 2 },
            'sections side by side',
          ),
        ],
      },
    ],
  },
  {
    name: 'EditableList',
    group: 'Forms',
    fill: true,
    desc: 'A short list edited in place: a choice field’s choices. Numbered rows with how many charts hold each; up and down, rename in place, archive (never delete) and restore; the add line, and the count against the maximum.',
    play: 'Rename a choice (Enter saves, Esc cancels), move it, archive and restore it, add «صيدليه» to see the duplicate refused.',
    blocks: () => [
      {
        label: 'States',
        cols: 2,
        items: [
          st({ ...CHOICE_LIST, items: CHOICES }, 'choices, one archived'),
          st(
            {
              ...CHOICE_LIST,
              label: 'خيارات «شركة التأمين»',
              items: [],
              addError: 'حقل الاختيار يحتاج خيارين على الأقل.',
            },
            'empty: the first choice',
          ),
          st(
            { ...CHOICE_LIST, items: CHOICES.slice(0, 4), max: 4 },
            'full (4 here, 250 in the app)',
          ),
          st({ ...CHOICE_LIST, items: CHOICES, readOnly: true }, 'read only (a support session)'),
          st({ ...CHOICE_LIST, items: CHOICES.slice(0, 4) }, 'a phone', null, { w: 358 }),
        ],
      },
    ],
  },
];
