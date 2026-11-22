// Drawer stories, as on the approved sheet (owner, 2026-11-22). The trigger renders in the eight
// combinations of direction × theme × density; an open drawer is a play story (a modal covers the
// page, so eight cannot sit side by side).
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Button } from '../button/button.tsx';
import { Input } from '../input/input.tsx';
import { Textarea } from '../textarea/textarea.tsx';
import {
  Drawer,
  DrawerActions,
  DrawerClose,
  DrawerContent,
  type DrawerSide,
  DrawerTrigger,
} from './drawer.tsx';

const meta = {
  title: 'Components/Drawer',
  component: Drawer,
  parameters: {
    docs: {
      description: {
        component:
          'A panel to edit a record without leaving the page. From the logical end by default (the left in Arabic), 400 px; `side="start"` for navigation; `side="bottom"` on a tablet or phone, with a named grabber. Focus starts on the first field and stays inside; Escape, the close button, a press outside or a drag toward its edge close it and focus returns to the trigger.',
      },
    },
  },
  args: { children: null },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

function EditAppointment({
  side,
  title = 'تعديل الموعد',
  open,
}: {
  side?: DrawerSide;
  title?: string;
  open?: boolean;
}) {
  return (
    <Drawer
      {...(side === undefined ? {} : { side })}
      {...(open === undefined ? {} : { defaultOpen: open })}
    >
      <DrawerTrigger startIcon="pencil">تعديل الموعد</DrawerTrigger>
      <DrawerContent title={title} description="الثلاثاء 24/11/2026 الساعة 10:30">
        <Input label="الهاتف" dir="auto" defaultValue="0944 123 456" />
        <Textarea label="ملاحظة" defaultValue="يفضّل موعداً بعد الظهر" />
        <DrawerActions>
          <DrawerClose>إلغاء</DrawerClose>
          <Button variant="primary">حفظ</Button>
        </DrawerActions>
      </DrawerContent>
    </Drawer>
  );
}

function AppointmentActions({ open }: { open?: boolean }) {
  return (
    <Drawer side="bottom" {...(open === undefined ? {} : { defaultOpen: open })}>
      <DrawerTrigger>إجراءات الموعد</DrawerTrigger>
      <DrawerContent title="موعد الثلاثاء" description="24/11/2026 · 10:30">
        <div className="-mx-6 flex flex-col">
          <Button variant="ghost" className="justify-start rounded-none px-6">
            تأكيد الموعد
          </Button>
          <Button variant="ghost" className="justify-start rounded-none px-6">
            إرسال تذكير
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

async function openIt(canvasElement: HTMLElement, name: string) {
  await userEvent.click(within(canvasElement).getByRole('button', { name }));
  const panel = within(canvasElement.ownerDocument.body).getByRole('dialog');
  await waitFor(async () => {
    await expect(panel).toBeVisible();
  });
  return panel;
}

/** The trigger at rest. */
export const Default: Story = { render: () => <EditAppointment /> };

/** Shown from the start, for the screenshot: from the logical end. */
export const ShownEnd: Story = {
  parameters: { matrix: false },
  render: () => <EditAppointment open />,
};

/** Shown from the start, for the screenshot: from the bottom. */
export const ShownBottom: Story = {
  parameters: { matrix: false },
  render: () => <AppointmentActions open />,
};

/** Open from the logical end, focus in the first field. */
export const OpenEnd: Story = {
  parameters: { matrix: false },
  render: () => <EditAppointment />,
  play: async ({ canvasElement }) => {
    const panel = await openIt(canvasElement, 'تعديل الموعد');
    await expect(within(panel).getByRole('textbox', { name: 'الهاتف' })).toHaveFocus();
  },
};

/** Open from the logical start. */
export const OpenStart: Story = {
  parameters: { matrix: false },
  render: () => <EditAppointment side="start" />,
  play: async ({ canvasElement }) => {
    await openIt(canvasElement, 'تعديل الموعد');
  },
};

/** From the bottom, as on a tablet or phone, with its grabber. */
export const OpenBottom: Story = {
  parameters: { matrix: false },
  render: () => <AppointmentActions />,
  play: async ({ canvasElement }) => {
    const panel = await openIt(canvasElement, 'إجراءات الموعد');
    await expect(
      within(panel).getByRole('button', { name: 'اسحب لتغيير الحجم أو للإغلاق' }),
    ).toBeVisible();
  },
};

const states = storyStates((label) => <EditAppointment title={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
