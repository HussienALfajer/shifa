// Alert dialog stories, as on the approved sheet (owner, 2026-11-22). The trigger renders in the
// eight combinations of direction × theme × density; an open dialog is a play story (a modal
// covers the page, so eight cannot sit side by side).
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTrigger,
} from './alert-dialog.tsx';

const meta = {
  title: 'Components/AlertDialog',
  component: AlertDialog,
  parameters: {
    docs: {
      description: {
        component:
          'A question that needs an explicit answer before something that cannot be undone. A status mark and a question, one or two sentences, then «رجوع» and the action last (the left in Arabic). No close button; a press outside does nothing. An action that returns a Promise keeps the dialog open and busy; a failure keeps it open with `errorText`.\n\n**Accessibility.** A modal `role="alertdialog"` with `aria-modal`, named by its title (the question) and described by its sentences through `aria-describedby`; the trigger and both answers are native `button`s. Focus starts on «رجوع» and Tab stays inside the dialog; Escape and «رجوع» close it and focus returns to the trigger, but while the action runs Escape does nothing. The busy action is announced with `aria-busy` and keeps its label, a run longer than a second is announced as `pendingAnnouncement` («جارٍ التنفيذ»), and a failure’s `errorText` is a `role="alert"`.',
      },
    },
  },
  args: { children: null },
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function DeletePrescription({
  title = 'حذف وصفة المريض؟',
  onAction,
  open,
}: {
  title?: string;
  onAction?: () => unknown;
  open?: boolean;
}) {
  return (
    <AlertDialog {...(open === undefined ? {} : { defaultOpen: open })}>
      <AlertDialogTrigger variant="danger" startIcon="trash">
        حذف الوصفة
      </AlertDialogTrigger>
      <AlertDialogContent
        title={title}
        description="وصفة 12/11/2026، ثلاثة أدوية. لا يمكن التراجع عن الحذف."
      >
        <AlertDialogCancel>رجوع</AlertDialogCancel>
        <AlertDialogAction
          {...(onAction === undefined ? {} : { onAction })}
          errorText="تعذّر حذف الوصفة. تحقق من الاتصال ثم حاول مجدداً."
        >
          حذف الوصفة
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}

async function openIt(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'حذف الوصفة' }));
  const dialog = within(canvasElement.ownerDocument.body).getByRole('alertdialog');
  await waitFor(async () => {
    await expect(dialog).toBeVisible();
  });
  return dialog;
}

/** The trigger at rest. */
export const Default: Story = { render: () => <DeletePrescription /> };

/** Open, focus on «رجوع». */
export const Open: Story = {
  parameters: { matrix: false },
  render: () => <DeletePrescription />,
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await expect(within(dialog).getByRole('button', { name: 'رجوع' })).toHaveFocus();
  },
};

/** An ordinary confirmation: the info mark and the primary action. */
export const Confirm: Story = {
  parameters: { matrix: false },
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger>إنهاء الزيارة</AlertDialogTrigger>
      <AlertDialogContent
        tone="info"
        title="إنهاء زيارة المريض؟"
        description="تُرسل الفاتورة إلى الاستقبال ويُستدعى المريض التالي."
      >
        <AlertDialogCancel>رجوع</AlertDialogCancel>
        <AlertDialogAction variant="primary">إنهاء الزيارة</AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

/** The action failed: the dialog stays open with the message. */
export const Failed: Story = {
  parameters: { matrix: false },
  render: () => <DeletePrescription onAction={() => Promise.reject(new Error('offline'))} />,
  play: async ({ canvasElement }) => {
    const dialog = await openIt(canvasElement);
    await userEvent.click(within(dialog).getByRole('button', { name: 'حذف الوصفة' }));
    await waitFor(async () => {
      await expect(within(dialog).getByRole('alert')).toBeVisible();
    });
  },
};

// The text states open, one copy each (a modal covers the page): the question is what they test.
const states = storyStates((label) => <DeletePrescription title={label} open />);
const single = { parameters: { matrix: false } };
export const LongArabicLabel: Story = { ...states['LongArabicLabel'], ...single };
export const MixedDirection: Story = { ...states['MixedDirection'], ...single };
export const Zoom200: Story = { ...states['Zoom200'], ...single };
export const ReducedMotion: Story = { ...states['ReducedMotion'], ...single };
