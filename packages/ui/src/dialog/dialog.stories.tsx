// Dialog stories, as on the approved sheet (owner, 2026-11-20). The trigger renders in the eight
// combinations of direction × theme × density; the open dialog is one story (a modal covers the
// page, so eight of them cannot sit side by side), opened by its play function.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Button } from '../button/button.tsx';
import { Dialog, DialogActions, DialogClose, DialogContent, DialogTrigger } from './dialog.tsx';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  parameters: {
    docs: {
      description: {
        component:
          'A modal dialog for a decision or a short form. Title (a question for a confirmation), one or two sentences, then the actions at the end of the line with the main one last (the left in Arabic). Focus starts on the first field, else on the safe action (`DialogClose`); it stays inside; Escape and the close button close it and focus returns to the trigger.',
      },
    },
  },
  args: { children: null },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function CancelDialog({
  title = 'إلغاء الموعد؟',
  defaultOpen,
}: {
  title?: string;
  defaultOpen?: boolean;
}) {
  return (
    <Dialog {...(defaultOpen === undefined ? {} : { defaultOpen })}>
      <DialogTrigger variant="danger" startIcon="trash">
        إلغاء الموعد
      </DialogTrigger>
      <DialogContent
        title={title}
        description="موعد الثلاثاء 24/11/2026 الساعة 10:30. سيصل المريضَ إشعار بالإلغاء."
      >
        <DialogActions>
          <DialogClose>رجوع</DialogClose>
          <Button variant="danger">تأكيد الإلغاء</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

/** The trigger at rest. */
export const Default: Story = { render: () => <CancelDialog /> };

/** Open, focus on «رجوع» (the safe action). */
export const Open: Story = {
  parameters: { matrix: false },
  render: () => <CancelDialog />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'إلغاء الموعد' }));
    const dialog = within(canvasElement.ownerDocument.body).getByRole('dialog', {
      name: 'إلغاء الموعد؟',
    });
    await waitFor(async () => {
      await expect(dialog).toBeVisible();
    });
    await expect(within(dialog).getByRole('button', { name: 'رجوع' })).toHaveFocus();
  },
};

const states = storyStates((label) => <CancelDialog title={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
