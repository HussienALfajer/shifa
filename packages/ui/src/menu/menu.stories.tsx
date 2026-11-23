// Menu stories, as on the approved sheet (owner, 2026-11-20). The triggers render in the eight
// combinations; the open menu with its submenu is one story, opened by its play function.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Submenu } from './menu.tsx';

const meta = {
  title: 'Components/Menu',
  component: Menu,
  parameters: {
    docs: {
      description: {
        component:
          'A list of actions from a button. Icons on the logical start; a submenu chevron points to the logical end. The danger item (brick, never red) comes last, after a separator. A disabled item says why in `hint`. For a choice that stays shown, use Select.\n\n**Accessibility.** The trigger is a native `button` with `aria-haspopup="menu"` and `aria-expanded`; the list is a `role="menu"` of `menuitem`s, and a submenu is a `menu` named by its item. Down Arrow on the trigger opens it on the first item; Up and Down move, Home and End jump to the first and last; the forward arrow of the reading direction (Left in Arabic, Right in English) opens a submenu and the backward one closes it; typing a letter (Arabic too) moves to the item that starts with it. Enter or Space runs the item, and Enter and Escape return focus to the trigger. A disabled item stays reachable, is announced with `aria-disabled` and its `hint`, and never runs; an icon-only trigger needs an `aria-label`.',
      },
    },
  },
  args: { children: null, onAction: fn() },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

function AppointmentMenu({
  label = 'إجراءات',
  onAction,
}: {
  label?: string;
  onAction?: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <Menu {...(onAction === undefined ? {} : { onAction })}>
        <MenuTrigger icon="dots" aria-label="إجراءات الموعد" />
        <MenuContent>
          <MenuItem value="edit" icon="pencil">
            تعديل الموعد
          </MenuItem>
          <MenuItem value="copy">نسخ رابط الحجز</MenuItem>
          <Submenu label="طباعة" icon="printer">
            <MenuItem value="print-small">إيصال صغير</MenuItem>
            <MenuItem value="print-page">
              ورقة <bdi>A4</bdi>
            </MenuItem>
          </Submenu>
          <MenuSeparator />
          <MenuItem value="move" disabled hint="لا طبيب متاح">
            نقل إلى طبيب آخر
          </MenuItem>
          <MenuSeparator />
          <MenuItem value="cancel" icon="trash" danger>
            إلغاء الموعد
          </MenuItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger>{label}</MenuTrigger>
        <MenuContent>
          <MenuItem value="a">تأكيد الحضور</MenuItem>
          <MenuItem value="b">إرسال إلى غرفة الطبيب</MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

/** The triggers at rest: icon only, and with a label. */
export const Default: Story = { render: () => <AppointmentMenu /> };

/** Open, with the print submenu open beside it. */
export const Open: Story = {
  parameters: { matrix: false },
  render: (args) => (
    <AppointmentMenu {...(args.onAction === undefined ? {} : { onAction: args.onAction })} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button', { name: 'إجراءات الموعد' }).focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowLeft}');
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(page.getByRole('menu', { name: 'طباعة' })).toBeVisible();
    });
  },
};

const states = storyStates((label) => <AppointmentMenu label={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
