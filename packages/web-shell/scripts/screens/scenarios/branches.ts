// The owner's branches (/branches, A-01-08 checkpoint 4): src/branches/ — the cards of active and
// archived branches, the branch dialog (add, edit), archiving with what it ends, restoring.
import type { Answer, Scenario, Sheet, Step, World } from '../scenario.ts';
import { fail } from '../server.ts';
import { B_OLD } from '../world.ts';

const branches = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/branches', ...s });
const addDialog: Step[] = [{ press: 'branchesAdd' }, { until: 'branchAddTitle' }];
/** The archive of the n-th active card: 0 the main branch (its assistant works there only). */
const archive = (nth: number): Step[] => [{ press: 'branchArchive', nth }];
const archiveNow: Step[] = [...archive(2), { press: 'branchArchiveAction' }];
const addFilled: Step[] = [
  ...addDialog,
  { fill: 'branchName', value: 'فرع الحمدانية' },
  { press: 'branchAddSubmit' },
];
const editName: Step[] = [
  { press: 'branchEdit' },
  { fill: 'branchName', value: 'الفرع الرئيسي - الفرقان' },
  { press: 'save' },
];
const restore: Step[] = [{ press: 'branchRestore' }];
const answered = (
  id: string,
  title: string,
  route: string,
  answer: Answer,
  steps: Step[],
  overlay = false,
): Scenario => branches({ id, title, answers: { [route]: answer }, steps, overlay });

export const branchesSheet: Sheet = {
  id: 'Branches',
  title: 'الفروع',
  route: '/branches',
  note: 'The owner’s branches: active cards (address, phone, members, the team of a branch) and archived ones; loading; the branch dialog to add or edit with its refusals; archiving, which first reads whose sessions end, and its failures; the last active branch; restoring; the notes after each action.',
  code: [
    'branches/branches-page.tsx',
    'branches/branch-dialog.tsx',
    'branches/archive-dialog.tsx',
    'branches/branch-note.tsx',
  ],
  scenarios: [
    branches({ id: 'List', title: 'الفروع الفعّالة والمؤرشفة' }),
    branches({ id: 'Loading', title: 'تحميل الفروع', answers: { 'GET /branches': 'hold' } }),
    branches({
      id: 'LoadFailed',
      title: 'تعذّر تحميل الفروع',
      answers: { 'GET /branches': 'offline' },
      steps: [{ until: 'loadFailedTitle' }],
    }),
    branches({
      id: 'NoArchived',
      title: 'لا فروع مؤرشفة',
      world: (w: World) => {
        w.branches = w.branches.filter((b) => b.id !== B_OLD.id);
      },
    }),
    branches({ id: 'Add', title: 'إضافة فرع', steps: addDialog, overlay: true }),
    answered('AddSending', 'إضافة فرع: جارٍ الحفظ', 'POST /branches', 'hold', addFilled, true),
    answered('AddOffline', 'إضافة فرع: لا اتصال', 'POST /branches', ['offline'], addFilled, true),
    answered(
      'AddServerError',
      'إضافة فرع: خطأ في الخادم',
      'POST /branches',
      [fail(500, 'internal_error')],
      addFilled,
      true,
    ),
    branches({
      id: 'AddMissing',
      title: 'إضافة فرع: الاسم فارغ',
      steps: [...addDialog, { press: 'branchAddSubmit' }],
      overlay: true,
    }),
    branches({
      id: 'AddPhoneInvalid',
      title: 'إضافة فرع: رقم غير صالح',
      steps: [
        ...addDialog,
        { fill: 'branchName', value: 'فرع الحمدانية' },
        { fill: 'branchPhone', value: '02121' },
        { press: 'branchAddSubmit' },
      ],
      overlay: true,
    }),
    branches({
      id: 'Added',
      title: 'أُضيف الفرع',
      steps: [
        ...addDialog,
        { fill: 'branchName', value: 'فرع الحمدانية' },
        { fill: 'branchAddress', value: 'حلب، الحمدانية، الشارع الرئيسي' },
        { press: 'branchAddSubmit' },
      ],
    }),
    branches({ id: 'Edit', title: 'تعديل فرع', steps: [{ press: 'branchEdit' }], overlay: true }),
    branches({
      id: 'EditGone',
      title: 'تعديل فرع أُرشف للتو',
      answers: { 'PATCH /branches/:id': [fail(409, 'branch_archived')] },
      steps: [
        { press: 'branchEdit' },
        { fill: 'branchName', value: 'الفرع الرئيسي - الفرقان' },
        { press: 'save' },
      ],
    }),
    branches({ id: 'EditSaved', title: 'حُفظ تعديل الفرع', steps: editName }),
    branches({
      id: 'EditPhoneInvalid',
      title: 'تعديل فرع: رقم غير صالح',
      steps: [{ press: 'branchEdit' }, { fill: 'branchPhone', value: '02121' }, { press: 'save' }],
      overlay: true,
    }),
    answered(
      'EditNotFound',
      'تعديل فرع: لم يعد موجودًا',
      'PATCH /branches/:id',
      [fail(404, 'not_found')],
      editName,
    ),
    answered(
      'EditOffline',
      'تعديل فرع: لا اتصال',
      'PATCH /branches/:id',
      ['offline'],
      editName,
      true,
    ),
    branches({
      id: 'ArchiveAsk',
      title: 'أرشفة فرع: تنتهي جلسات من يعمل فيه وحده',
      steps: [...archive(0), { until: 'branchArchiveAction' }],
      overlay: true,
    }),
    branches({
      id: 'ArchiveNobody',
      title: 'أرشفة فرع: لا جلسات تنتهي',
      steps: [...archive(2), { until: 'branchArchiveNobody' }],
      overlay: true,
    }),
    branches({
      id: 'ArchiveReading',
      title: 'أرشفة فرع: قراءة ما ينتهي',
      answers: { 'GET /branches/:id/archive-preview': 'hold' },
      steps: archive(0),
      overlay: true,
    }),
    branches({
      id: 'ArchivePreviewFailed',
      title: 'أرشفة فرع: تعذّرت القراءة',
      answers: { 'GET /branches/:id/archive-preview': 'offline' },
      steps: [...archive(0), { until: 'branchArchivePreviewFailed' }],
      overlay: true,
    }),
    branches({
      id: 'Archived',
      title: 'أُرشف الفرع',
      steps: [...archive(2), { press: 'branchArchiveAction' }],
    }),
    branches({
      id: 'ArchiveOffline',
      title: 'أرشفة فرع: انقطع الاتصال',
      answers: { 'POST /branches/:id/archive': ['offline'] },
      steps: [...archive(2), { press: 'branchArchiveAction' }],
      overlay: true,
    }),
    answered(
      'Archiving',
      'أرشفة فرع: جارٍ الأرشفة',
      'POST /branches/:id/archive',
      'hold',
      archiveNow,
      true,
    ),
    answered(
      'ArchiveLastRefused',
      'أرشفة مرفوضة: آخر فرع فعّال',
      'POST /branches/:id/archive',
      [fail(409, 'last_branch')],
      archiveNow,
      true,
    ),
    answered(
      'ArchiveAlready',
      'أرشفة: أُرشف من مكان آخر',
      'POST /branches/:id/archive',
      [fail(409, 'branch_archived')],
      archiveNow,
    ),
    answered(
      'ArchiveGone',
      'أرشفة: الفرع لم يعد موجودًا',
      'POST /branches/:id/archive',
      [fail(404, 'not_found')],
      archiveNow,
    ),
    answered(
      'ArchiveServerError',
      'أرشفة: خطأ في الخادم',
      'POST /branches/:id/archive',
      [fail(500, 'internal_error')],
      archiveNow,
      true,
    ),
    answered(
      'PreviewAlready',
      'أرشفة: الفرع أُرشف قبل القراءة',
      'GET /branches/:id/archive-preview',
      fail(409, 'branch_archived'),
      archive(2),
    ),
    branches({
      id: 'LastBranch',
      title: 'فرع فعّال واحد: لا أرشفة',
      world: (w: World) => {
        w.branches = w.branches.filter((b, i) => i === 0 || b.archivedAt !== null);
      },
    }),
    branches({
      id: 'ArchiveLast',
      title: 'أرشفة مرفوضة: صار آخر فرع فعّال',
      answers: {
        'GET /branches/:id/archive-preview': {
          status: 200,
          body: { lastBranch: true, members: [] },
        },
      },
      steps: [...archive(2), { until: 'branchLastActive' }],
      overlay: true,
    }),
    branches({ id: 'Restored', title: 'استُعيد الفرع', steps: [{ press: 'branchRestore' }] }),
    answered('Restoring', 'استعادة: جارٍ الاستعادة', 'POST /branches/:id/restore', 'hold', restore),
    answered(
      'RestoreOffline',
      'استعادة: لا اتصال',
      'POST /branches/:id/restore',
      ['offline'],
      restore,
    ),
    answered(
      'RestoreGone',
      'استعادة: الفرع لم يعد موجودًا',
      'POST /branches/:id/restore',
      [fail(404, 'not_found')],
      restore,
    ),
    answered(
      'RestoreServerError',
      'استعادة: خطأ في الخادم',
      'POST /branches/:id/restore',
      [fail(500, 'internal_error')],
      restore,
    ),
    branches({
      id: 'RestoreRefused',
      title: 'استعادة مرفوضة: الفرع فعّال الآن',
      answers: { 'POST /branches/:id/restore': [fail(409, 'branch_not_archived')] },
      steps: [{ press: 'branchRestore' }],
    }),
  ],
};
