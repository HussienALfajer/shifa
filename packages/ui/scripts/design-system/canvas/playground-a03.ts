// Playgrounds of the components A-03 added: RecordList, RecordHeader, DescriptionList and
// EditableList (playground.ts has the rest and the rules).
import { choose, flag, int, type Playground, pick, text } from './controls.ts';
import {
  CHOICES,
  FACTS,
  FAMILY,
  FIELD_ROWS,
  HEADER,
  RECORD_MENU,
  SEARCH,
  SECTIONS,
} from './data-a03.ts';

export const A03_PLAYGROUNDS: Record<string, Playground> = {
  RecordList: {
    base: {
      columns: [
        { header: 'رقم الملف', weight: 0.7 },
        { header: 'الجنس والعمر' },
        { header: 'الفرع', weight: 1.2 },
      ],
    },
    controls: [
      choose(
        'items',
        { search: SEARCH, family: FAMILY, fields: FIELD_ROWS, none: [] },
        { search: 'search results', family: 'a family', fields: 'a clinic’s fields', none: 'none' },
      ),
      text('aria-label', 'نتائج البحث'),
      pick('layout', ['table', 'stack', 'tiles']),
      pick('size', ['md', 'sm']),
      text('titleHeader', 'المريض'),
      flag('framed', true),
      flag('chevron', true),
      flag('loading'),
      text('footer', ''),
    ],
    scenarios: [
      { label: 'Two lines', set: { layout: 'stack', size: 'sm', items: 'family' } },
      { label: 'Tiles', set: { layout: 'tiles', size: 'sm', framed: false, items: 'family' } },
      { label: 'Fields', set: { layout: 'stack', size: 'sm', items: 'fields' } },
      { label: 'Loading', set: { loading: true } },
    ],
  },
  RecordHeader: {
    base: { idLabel: 'ملف', facts: FACTS },
    controls: [
      text('title', HEADER.title),
      text('idValue', HEADER.idValue),
      choose(
        'badges',
        {
          plain: HEADER.badges,
          estimated: [
            { label: 'ذكر' },
            { label: '~40 سنة', tip: 'عمر تقريبي: سُجّل العمر دون تاريخ الميلاد.' },
          ],
          archived: [...HEADER.badges, { label: 'مؤرشف', icon: 'archive' }],
        },
        { plain: 'sex and age', estimated: 'an estimated age', archived: 'archived' },
      ),
      text('meta', HEADER.meta),
      choose(
        'actions',
        {
          owner: [{ label: 'تعديل', icon: 'pencil' }, RECORD_MENU],
          edit: [{ label: 'تعديل', icon: 'pencil' }],
          none: undefined,
        },
        { owner: 'edit and the menu', edit: 'edit', none: 'none' },
      ),
      text('readOnlyNote', ''),
      flag('muted'),
      flag('compact'),
      flag('loading'),
    ],
    scenarios: [
      { label: 'Estimated age', set: { badges: 'estimated' } },
      {
        label: 'Archived',
        set: { badges: 'archived', muted: true, readOnlyNote: 'للقراءة فقط' },
      },
      { label: 'Compact', set: { compact: true, actions: 'none' } },
    ],
  },
  DescriptionList: {
    base: { sections: SECTIONS },
    controls: [
      text('aria-label', 'حقول العيادة'),
      int('columns', 1),
      flag('loading'),
      text('emptyLabel', 'فارغ'),
    ],
    scenarios: [
      { label: 'Two columns', set: { columns: 2 } },
      { label: 'Loading', set: { loading: true } },
    ],
  },
  EditableList: {
    base: { items: CHOICES },
    remountAll: true,
    controls: [
      text('label', 'خيارات «جهة الإحالة»'),
      int('max', 250),
      flag('readOnly'),
      text('addError', ''),
    ],
    scenarios: [
      { label: 'Full', set: { max: 4 } },
      { label: 'Read only', set: { readOnly: true } },
    ],
  },
};
