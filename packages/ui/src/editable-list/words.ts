// The words of EditableList in Arabic and English (A-03-01, sheet A03SheetEditableList).

export interface EditableListWords {
  count: (n: number, max: number) => string;
  editLabel: string;
  addLabel: string;
  addPlaceholder: string;
  add: string;
  archived: string;
  restore: string;
  restoreItem: (label: string) => string;
  up: (label: string) => string;
  down: (label: string) => string;
  rename: (label: string) => string;
  archive: (label: string) => string;
  full: (max: number) => string;
  addDuplicate: (existing: string) => string;
  renameDuplicate: (existing: string) => string;
  archivedFoot: (count: number) => string;
}

export const EDITABLE_WORDS: Record<'rtl' | 'ltr', EditableListWords> = {
  rtl: {
    count: (n, max) => `${String(n)} من ${String(max)}`,
    editLabel: 'اسم الخيار',
    addLabel: 'خيار جديد',
    addPlaceholder: 'اكتب الخيار ثم «إضافة»',
    add: 'إضافة',
    archived: 'مؤرشف',
    restore: 'استعادة',
    restoreItem: (label) => `استعادة «${label}»`,
    up: (label) => `نقل «${label}» للأعلى`,
    down: (label) => `نقل «${label}» للأسفل`,
    rename: (label) => `إعادة تسمية «${label}»`,
    archive: (label) => `أرشفة «${label}»`,
    full: (max) => `وصلت إلى ${String(max)} خيارًا. أرشف خيارًا لا يُستعمل لتضيف غيره.`,
    addDuplicate: (existing) => `«${existing}» موجود؛ لا يتكرر خيار.`,
    renameDuplicate: (existing) => `هذا الخيار موجود باسم «${existing}».`,
    archivedFoot: (count) =>
      `${count === 1 ? 'خيار مؤرشف يبقى' : `${String(count)} خيارات مؤرشفة تبقى`} على الملفات التي تحمله ولا يُعرض للاختيار. لا يُحذف خيار أبدًا.`,
  },
  ltr: {
    count: (n, max) => `${String(n)} of ${String(max)}`,
    editLabel: 'Choice name',
    addLabel: 'New choice',
    addPlaceholder: 'Type a choice, then Add',
    add: 'Add',
    archived: 'Archived',
    restore: 'Restore',
    restoreItem: (label) => `Restore “${label}”`,
    up: (label) => `Move “${label}” up`,
    down: (label) => `Move “${label}” down`,
    rename: (label) => `Rename “${label}”`,
    archive: (label) => `Archive “${label}”`,
    full: (max) =>
      `You have reached ${String(max)} choices. Archive one that is not used to add another.`,
    addDuplicate: (existing) => `“${existing}” is already there; a choice is not repeated.`,
    renameDuplicate: (existing) => `This choice is already there as “${existing}”.`,
    archivedFoot: () =>
      'An archived choice stays on the charts that hold it and is not offered. A choice is never deleted.',
  },
};
