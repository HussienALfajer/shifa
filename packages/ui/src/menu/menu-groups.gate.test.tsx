// Menu groups (slice A-01-08, sheet `MenuGroupsSheet`, approved by the owner 2026-11-24): an
// addition to the approved Menu, in Arabic RTL and English LTR. A group is named by its label
// (`role="group"`); a radio group's items are `menuitemradio` with `aria-checked`, a second line,
// a badge, a check at the logical end and a busy state; choosing one keeps the menu open (the
// caller closes it once the server answered); a disabled item is reachable and never chosen;
// Arabic typeahead finds a name; a note row is information only; `closeOnSelect={false}` keeps
// the menu open for a step inside it; `presentation="sheet"` rises from the bottom with its title
// and the same rows; axe is clean in both presentations.
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, pressKeys, renderDir } from '../../test/support/index.ts';
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
} from './menu.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const CLINIC_A = 'مجمع الشفاء الطبي';
const CLINIC_B = 'عيادة الياسمين';
const CLINIC_C = 'مركز النور الطبي';
const INVITE = 'عيادة الحمدانية';

interface Props {
  presentation?: 'popover' | 'sheet';
  busy?: string | null;
  onClinic?: (v: string) => void;
  onBranch?: (v: string) => void;
  onAction?: (v: string) => void;
}

function Switcher({ presentation = 'popover', busy = null, onClinic, onBranch, onAction }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex justify-center p-16">
      <Menu
        presentation={presentation}
        open={open}
        onOpenChange={setOpen}
        {...(onAction ? { onAction } : {})}
      >
        <MenuTrigger variant="ghost">{CLINIC_A}</MenuTrigger>
        <MenuContent title="العيادة والفرع">
          <MenuItem value="back" icon="arrow-back" closeOnSelect={false}>
            رجوع إلى العيادات
          </MenuItem>
          <MenuRadioGroup
            label="العيادات"
            value="a"
            onValueChange={(v) => {
              onClinic?.(v);
            }}
          >
            <MenuRadioItem
              value="a"
              avatar={CLINIC_A}
              description="المالك · كل الفروع"
              checkedLabel="الحالية"
            >
              {CLINIC_A}
            </MenuRadioItem>
            <MenuRadioItem
              value="b"
              avatar={CLINIC_B}
              description="طبيبة · فرعان"
              busy={busy === 'b'}
              busyLabel="جارٍ التبديل"
            >
              {CLINIC_B}
            </MenuRadioItem>
            <MenuRadioItem
              value="c"
              avatar={CLINIC_C}
              description="موقوفة · تواصل مع إدارة شفاء"
              badge="موقوفة"
              disabled
            >
              {CLINIC_C}
            </MenuRadioItem>
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuRadioGroup
            label="الفروع في مجمع الشفاء الطبي"
            value="all"
            onValueChange={(v) => {
              onBranch?.(v);
            }}
          >
            <MenuRadioItem value="all" icon="buildings">
              كل الفروع
            </MenuRadioItem>
            <MenuRadioItem value="main" icon="buildings">
              الفرع الرئيسي
            </MenuRadioItem>
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuGroup label="دعوات تنتظر ردّك">
            <MenuNote icon="bell" description="مساعدة · افتحيها من الرابط الذي وصلك">
              {INVITE}
            </MenuNote>
          </MenuGroup>
        </MenuContent>
      </Menu>
    </div>
  );
}

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1500, message });

async function open(dir: 'rtl' | 'ltr', props: Props = {}) {
  const screen = await renderDir(<Switcher {...props} />, { dir });
  const trigger = screen.getByRole('button', { name: CLINIC_A }).element() as HTMLElement;
  await userEvent.click(trigger);
  const menu = screen.getByRole('menu');
  await expect.element(menu).toBeVisible();
  return { screen, trigger, menu: menu.element() as HTMLElement };
}

const radio = (menu: HTMLElement, name: string) => {
  const item = [...menu.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((el) =>
    el.textContent.includes(name),
  );
  if (!item) throw new Error(`no radio item ${name}`);
  return item;
};

/** The item a keyboard user is on. */
function current(): string | undefined {
  const active = document.activeElement;
  const id = active?.getAttribute('aria-activedescendant');
  const el = id ? document.getElementById(id) : active;
  const item =
    el?.closest('[role^="menuitem"]') ??
    document.querySelector('[role^="menuitem"][data-highlighted]');
  return item?.textContent.trim();
}

describe.each(DIRS)('Menu groups in %s', (dir) => {
  it('names each group by its label, with a separator between groups', async () => {
    const { menu } = await open(dir);
    const groups = [...menu.querySelectorAll<HTMLElement>('[role="group"][aria-labelledby]')];
    const names = groups.map((g) => {
      const id = g.getAttribute('aria-labelledby') ?? '';
      return document.getElementById(id)?.textContent;
    });
    expect(names).toEqual(['العيادات', 'الفروع في مجمع الشفاء الطبي', 'دعوات تنتظر ردّك']);
    expect(menu.querySelectorAll('[role="separator"]').length).toBe(2);
  });

  it('marks the current item checked, with a second line, the check at the logical end', async () => {
    const { menu } = await open(dir);
    const a = radio(menu, CLINIC_A);
    expect(a.getAttribute('aria-checked')).toBe('true');
    expect(radio(menu, CLINIC_B).getAttribute('aria-checked')).toBe('false');
    expect(a.textContent).toContain('المالك · كل الفروع');
    const check = a.querySelector<SVGElement>('[data-shifa-icon="check"]');
    expect(check).not.toBeNull();
    const box = a.getBoundingClientRect();
    const mark = check?.getBoundingClientRect();
    if (!mark) throw new Error('no check');
    // The logical end: the left in Arabic, the right in English.
    if (dir === 'rtl') expect(mark.left - box.left).toBeLessThan(box.width / 3);
    else expect(box.right - mark.right).toBeLessThan(box.width / 3);
    // An avatar for a clinic, an icon for a branch.
    expect(a.querySelector('[data-slot="avatar"], [role="img"]')).not.toBeNull();
    expect(radio(menu, 'الفرع الرئيسي').querySelector('[data-shifa-icon="buildings"]')).not.toBe(
      null,
    );
  });

  it('choosing an item calls onValueChange and keeps the menu open', async () => {
    const onClinic = vi.fn();
    const { menu } = await open(dir, { onClinic });
    await userEvent.click(radio(menu, CLINIC_B));
    expect(onClinic).toHaveBeenCalledWith('b');
    await expect.element(menu).toBeVisible();
  });

  it('a busy item says so and shows the spinner in place of the check', async () => {
    const { menu } = await open(dir, { busy: 'b' });
    const b = radio(menu, CLINIC_B);
    expect(b.getAttribute('aria-busy')).toBe('true');
    await poll(
      () => b.querySelector('[role="status"]')?.getAttribute('aria-label'),
      'spinner',
    ).toBe('جارٍ التبديل');
  });

  it('a disabled item is reachable, says why and is never chosen', async () => {
    const onClinic = vi.fn();
    const { menu } = await open(dir, { onClinic });
    const c = radio(menu, CLINIC_C);
    expect(c.getAttribute('aria-disabled')).toBe('true');
    expect(c.textContent).toContain('موقوفة · تواصل مع إدارة شفاء');
    await userEvent.click(c, { force: true });
    expect(onClinic).not.toHaveBeenCalled();
    // Reachable by the arrows.
    for (let i = 0; i < 4 && !(current() ?? '').startsWith(CLINIC_C); i++) {
      await userEvent.keyboard('{ArrowDown}');
    }
    expect(current()?.startsWith(CLINIC_C)).toBe(true);
  });

  it('typing an Arabic letter moves to the item whose label starts with it', async () => {
    await open(dir);
    await pressKeys('ع');
    await poll(() => current()?.startsWith(CLINIC_B), 'typeahead').toBe(true);
  });

  it('an item with closeOnSelect={false} runs its action and keeps the menu open', async () => {
    const onAction = vi.fn();
    const { menu, screen } = await open(dir, { onAction });
    await userEvent.click(screen.getByRole('menuitem', { name: 'رجوع إلى العيادات' }));
    expect(onAction).toHaveBeenCalledWith('back');
    await expect.element(menu).toBeVisible();
  });

  // The owner's choice (2026-11-24): axe allows no `note` inside a menu, so a note row is a
  // disabled item: reachable and read aloud, never run.
  it('a note row is information only: a disabled item, never run', async () => {
    const onAction = vi.fn();
    const { menu } = await open(dir, { onAction });
    const note = [...menu.querySelectorAll<HTMLElement>('[data-menu-note]')];
    expect(note.map((n) => n.textContent.includes(INVITE))).toEqual([true]);
    expect(note[0]?.getAttribute('role')).toBe('menuitem');
    expect(note[0]?.getAttribute('aria-disabled')).toBe('true');
    if (note[0]) await userEvent.click(note[0], { force: true });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('is clean for axe, as a popover', async () => {
    const { menu } = await open(dir);
    await expectAxeClean(menu);
  });

  it('as a sheet: rises from the bottom with its title and the same rows; Escape closes it', async () => {
    const { menu, trigger, screen } = await open(dir, { presentation: 'sheet' });
    expect(menu.getAttribute('data-presentation')).toBe('sheet');
    const box = menu.getBoundingClientRect();
    await poll(
      () => Math.abs(menu.getBoundingClientRect().bottom - window.innerHeight) <= 1,
      'at the bottom',
    ).toBe(true);
    expect(box.width).toBeGreaterThan(window.innerWidth * 0.9);
    // The owner's choice (2026-11-24): axe allows no heading or button inside a menu, so the
    // drawn title names the menu and the drawn header is hidden from screen readers.
    const title = document.getElementById(menu.getAttribute('aria-labelledby') ?? '');
    expect(title?.textContent).toBe('العيادة والفرع');
    await expect.element(screen.getByText('العيادة والفرع')).toBeVisible();
    expect(title?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(radio(menu, CLINIC_B).getAttribute('role')).toBe('menuitemradio');
    await expectAxeClean(menu);
    await userEvent.keyboard('{Escape}');
    await poll(() => document.activeElement === trigger, 'focus back on the trigger').toBe(true);
  });
});
