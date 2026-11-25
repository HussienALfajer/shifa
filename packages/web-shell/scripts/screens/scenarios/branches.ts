// The owner's branches (/branches, A-01-08 checkpoint 4): src/branches/ — the cards of active and
// archived branches, the branch dialog (add, edit), archiving with what it ends, restoring.
import type { Scenario, Sheet, Step, World } from '../scenario.ts';
import { fail } from '../server.ts';

const branches = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/branches', ...s });
const addDialog: Step[] = [{ press: 'branchesAdd' }, { until: 'branchAddTitle' }];
/** The archive of the n-th active card: 0 the main branch (its assistant works there only). */
const archive = (nth: number): Step[] => [{ press: 'branchArchive', nth }];

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
    branches({ id: 'Add', title: 'إضافة فرع', steps: addDialog, overlay: true }),
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
    branches({
      id: 'RestoreRefused',
      title: 'استعادة مرفوضة: الفرع فعّال الآن',
      answers: { 'POST /branches/:id/restore': [fail(409, 'branch_not_archived')] },
      steps: [{ press: 'branchRestore' }],
    }),
  ],
};
