// Menu stories, as on the approved sheet (owner, 2026-11-20). The triggers render in the eight
// combinations; the open menu with its submenu is one story, opened by its play function.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { people } from '../../test/fixtures.ts';
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuNote,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  Submenu,
} from './menu.tsx';

const meta = {
  title: 'Components/Menu',
  component: Menu,
  parameters: {
    docs: {
      description: {
        component:
          'A list of actions from a button. Icons on the logical start; a submenu chevron points to the logical end. The danger item (brick, never red) comes last, after a separator. A disabled item says why in `hint`. For a choice that stays shown, use Select. `MenuGroup` and `MenuRadioGroup` put rows under a label; a `MenuRadioItem` carries an avatar or icon, a second line, a badge, the check of the current row at the logical end and a busy spinner, and choosing it keeps the menu open until the caller closes it; `MenuNote` is information only. `presentation="sheet"` shows the same rows rising from the bottom on a phone, under MenuContent\'s `title`.\n\n**Accessibility.** The trigger is a native `button` with `aria-haspopup="menu"` and `aria-expanded`; the list is a `role="menu"` of `menuitem`s, and a submenu is a `menu` named by its item. Down Arrow on the trigger opens it on the first item; Up and Down move, Home and End jump to the first and last; the forward arrow of the reading direction (Left in Arabic, Right in English) opens a submenu and the backward one closes it; typing a letter (Arabic too) moves to the item that starts with it. Enter or Space runs the item, and Enter and Escape return focus to the trigger. A disabled item stays reachable, is announced with `aria-disabled` and its `hint`, and never runs; an icon-only trigger needs an `aria-label`. A group is a `group` named by its label; radio rows are `menuitemradio` with `aria-checked`, and a busy row has `aria-busy`. A note is a disabled `menuitem`, reachable and read but never run. As a sheet the menu is named by its `title`; the drawn header and its close button are hidden from screen readers, who close it with Escape.',
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

const SWITCH_PEOPLE = people(2, { seed: 812 });
const CLINICS = SWITCH_PEOPLE.map((p, i) =>
  i === 0 ? `مجمع ${p.name.split(' ')[1] ?? ''} الطبي` : `عيادة ${p.name.split(' ')[1] ?? ''}`,
);
const SUSPENDED = 'مركز الياسمين الطبي';

/** The clinic and branch switcher of sheet `MenuGroupsSheet` (A-01-08). */
function ClinicSwitcher({ presentation }: { presentation?: 'popover' | 'sheet' }) {
  const [clinic, other] = CLINICS;
  return (
    <Menu {...(presentation === undefined ? {} : { presentation })}>
      <MenuTrigger variant="ghost" aria-label={`العيادة والفرع: ${clinic ?? ''}، كل الفروع`}>
        {`${clinic ?? ''} · كل الفروع`}
      </MenuTrigger>
      <MenuContent title="العيادة والفرع">
        <MenuRadioGroup label="العيادات" value="a" onValueChange={() => undefined}>
          <MenuRadioItem value="a" avatar={clinic} description="مالك · كل الفروع · آخر نشاط الآن">
            {clinic ?? ''}
          </MenuRadioItem>
          <MenuRadioItem value="b" avatar={other} description="طبيب · فرعان · آخر نشاط أمس 20:10">
            {other ?? ''}
          </MenuRadioItem>
          <MenuRadioItem
            value="c"
            avatar={SUSPENDED}
            description="موقوفة · تواصل مع إدارة شفاء"
            badge="موقوفة"
            disabled
          >
            {SUSPENDED}
          </MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuRadioGroup
          label={`الفروع في ${clinic ?? ''}`}
          value="all"
          onValueChange={() => undefined}
        >
          <MenuRadioItem value="all" icon="buildings">
            كل الفروع
          </MenuRadioItem>
          <MenuRadioItem value="main" icon="buildings">
            الفرع الرئيسي
          </MenuRadioItem>
          <MenuRadioItem value="jamiliyeh" icon="buildings">
            فرع الجميلية
          </MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuGroup label="دعوات تنتظر ردّك">
          <MenuNote icon="bell" description="مساعد · افتحها من الرابط الذي وصلك">
            عيادة الحمدانية
          </MenuNote>
        </MenuGroup>
      </MenuContent>
    </Menu>
  );
}

/** Groups (A-01-08): the clinic switcher open, the current clinic and branch checked. */
export const Groups: Story = {
  parameters: { matrix: false },
  render: () => <ClinicSwitcher />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /العيادة والفرع/ }));
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(page.getByRole('menu')).toBeVisible();
    });
  },
};

/** On a phone (A-01-08): the same rows in a sheet rising from the bottom. */
export const Sheet: Story = {
  parameters: { matrix: false, docs: { story: { inline: false } } },
  render: () => <ClinicSwitcher presentation="sheet" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /العيادة والفرع/ }));
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(page.getByRole('menu', { name: 'العيادة والفرع' })).toBeVisible();
    });
  },
};

const states = storyStates((label) => <AppointmentMenu label={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
