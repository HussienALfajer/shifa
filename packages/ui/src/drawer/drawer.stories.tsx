// Drawer stories, as on the approved sheet (owner, 2026-11-22). The trigger renders in the eight
// combinations of direction × theme × density; an open drawer is a play story (a modal covers the
// page, so eight cannot sit side by side).
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { PHONE } from '../../test/fixtures.ts';
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
      // Stories open a modal on load: inline on the docs page they would cover it (and make it
      // inert), so each docs story renders in its own frame.
      story: { inline: false, iframeHeight: 640 },
      description: {
        component:
          'A panel to edit a record without leaving the page. From the logical end by default (the left in Arabic), 400 px; `side="start"` for navigation; `side="bottom"` on a tablet or phone, with a grabber.\n\n**Accessibility.** A `role="dialog"` with `aria-modal="true"`, named by its `title` (a heading) and described by its `description`; the trigger is a native `button`. Focus starts on the first field, else on the close button, and Tab stays inside. Escape, the close button, a press outside or a drag toward its edge close it and focus returns to the trigger. The icon-only close button is named «إغلاق» (`closeLabel`) and the bottom drawer’s grabber is a `button` named «اسحب لتغيير الحجم أو للإغلاق» (`handleLabel`). While a confirmation rendered beside the panel (inside `Drawer`, after `DrawerContent`) is open, the drawer is inert and `aria-hidden` (its own live regions are silent until the answer); one rendered inside the body stays inside the panel and is not hidden.',
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
        <Input label="الهاتف" dir="auto" defaultValue={PHONE} />
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

// The text states open, one copy each (a modal covers the page): the title is what they test.
const states = storyStates((label) => <EditAppointment title={label} open />);
const single = { parameters: { matrix: false } };
export const LongArabicLabel: Story = { ...states['LongArabicLabel'], ...single };
export const MixedDirection: Story = { ...states['MixedDirection'], ...single };
export const Zoom200: Story = { ...states['Zoom200'], ...single };
export const ReducedMotion: Story = { ...states['ReducedMotion'], ...single };
