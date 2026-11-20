// Popover stories, as on the approved sheet (owner, 2026-11-20). The trigger renders in the
// eight combinations; the open popover is one story, opened by its play function.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Button } from '../button/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from './popover.tsx';

const meta = {
  title: 'Components/Popover',
  component: Popover,
  parameters: {
    docs: {
      description: {
        component:
          'A small panel under its trigger, starting at the trigger’s logical edge (the right in Arabic), for a short form or details. Focus moves to its first field; Escape or a press outside closes it and focus returns to the trigger. Give it a `title`. For a list of actions use Menu; for choices use Select.',
      },
    },
  },
  args: { children: null },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

function NotePopover({ label = 'ملاحظة سريعة' }: { label?: string }) {
  return (
    <Popover>
      <PopoverTrigger startIcon="pencil">{label}</PopoverTrigger>
      <PopoverContent title="ملاحظة للطبيب">
        <label className="flex flex-col gap-1 text-200 font-medium">
          <span>الملاحظة</span>
          <textarea
            defaultValue="يفضّل موعداً بعد الظهر"
            className="min-h-(--shifa-size-control-lg) rounded-input border border-(--shifa-input-border) bg-(--shifa-input-bg) p-2 text-body font-normal text-(--shifa-input-fg)"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button size="sm">إلغاء</Button>
          <Button size="sm" variant="primary">
            حفظ
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The trigger at rest. */
export const Default: Story = { render: () => <NotePopover /> };

/** Open under its trigger, focus in the note. */
export const Open: Story = {
  parameters: { matrix: false },
  render: () => <NotePopover />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'ملاحظة سريعة' }));
    const popup = within(canvasElement.ownerDocument.body).getByRole('dialog', {
      name: 'ملاحظة للطبيب',
    });
    await waitFor(async () => {
      await expect(popup).toBeVisible();
    });
    await expect(within(popup).getByRole('textbox')).toHaveFocus();
  },
};

const states = storyStates((label) => <NotePopover label={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
