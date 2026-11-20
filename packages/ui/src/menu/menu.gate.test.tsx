// RTL gate (spec 0.4 criterion 7, slice 0.4-04): Menu in Arabic RTL and English LTR. It opens
// below its trigger aligned to the logical start; Up and Down move (a disabled item is reachable, says why and never runs); the
// forward arrow of the reading direction (Left in Arabic) opens a submenu on the logical end and
// the backward arrow closes it; typing an Arabic letter finds an item; Enter runs the action and
// focus returns to the trigger; axe is clean. Digits do not apply (n/a).
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { arrows, expectAxeClean, expectPopupSide, renderDir } from '../../test/support/index.ts';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Submenu } from './menu.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const L = {
  edit: 'تعديل الموعد',
  copy: 'نسخ رابط الحجز',
  print: 'طباعة',
  small: 'إيصال صغير',
  page: 'ورقة كاملة',
  move: 'نقل إلى طبيب آخر',
  cancel: 'إلغاء الموعد',
};

function AppointmentMenu({ onAction = () => undefined }: { onAction?: (v: string) => void }) {
  return (
    <div className="flex justify-center p-16">
      <Menu onAction={onAction}>
        <MenuTrigger icon="dots" aria-label="إجراءات الموعد" />
        <MenuContent>
          <MenuItem value="edit" icon="pencil">
            {L.edit}
          </MenuItem>
          <MenuItem value="copy">{L.copy}</MenuItem>
          <Submenu label={L.print} icon="printer">
            <MenuItem value="print-small">{L.small}</MenuItem>
            <MenuItem value="print-page">{L.page}</MenuItem>
          </Submenu>
          <MenuSeparator />
          <MenuItem value="move" disabled hint="لا طبيب متاح">
            {L.move}
          </MenuItem>
          <MenuSeparator />
          <MenuItem value="cancel" icon="trash" danger>
            {L.cancel}
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

/** The item a keyboard user is on: the focused one, or the one the menu marks as highlighted. */
function current(): string | undefined {
  const active = document.activeElement;
  const id = active?.getAttribute('aria-activedescendant');
  const el = id ? document.getElementById(id) : active;
  const item =
    el?.closest('[role^="menuitem"]') ??
    document.querySelector('[role^="menuitem"][data-highlighted]');
  return item?.textContent?.trim().split('\n')[0];
}

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

async function open(dir: 'rtl' | 'ltr', onAction?: (v: string) => void) {
  const screen = await renderDir(<AppointmentMenu {...(onAction ? { onAction } : {})} />, { dir });
  const trigger = screen.getByRole('button', { name: 'إجراءات الموعد' }).element() as HTMLElement;
  trigger.focus();
  await userEvent.keyboard('{ArrowDown}');
  const menu = screen.getByRole('menu').first();
  await expect.element(menu).toBeVisible();
  return { screen, trigger, menu: menu.element() as HTMLElement };
}

const startsWith = (text: string | undefined, label: string) => text?.startsWith(label) ?? false;

describe.each(DIRS)('Menu gate in %s', (dir) => {
  it('opens below the trigger, aligned to its logical start, on the first item', async () => {
    const { trigger, menu } = await open(dir);
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expectPopupSide({ dir, trigger, popup: menu, side: 'bottom', align: 'start' });
    await poll(() => startsWith(current(), L.edit), 'first item').toBe(true);
  });

  it('Down and Up move between items; the disabled one is reachable, with its reason', async () => {
    await open(dir);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await poll(() => startsWith(current(), L.print), 'third item').toBe(true);
    await userEvent.keyboard('{ArrowDown}');
    await poll(() => startsWith(current(), L.move), 'the disabled item, past the separator').toBe(
      true,
    );
    await userEvent.keyboard('{ArrowDown}');
    await poll(() => startsWith(current(), L.cancel), 'the last item').toBe(true);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    await poll(() => startsWith(current(), L.print), 'back up').toBe(true);
  });

  it('the forward arrow opens the submenu on the logical end; the backward arrow closes it', async () => {
    const { screen } = await open(dir);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await poll(() => startsWith(current(), L.print), 'on the submenu item').toBe(true);
    const { forward, backward } = arrows(dir);
    await userEvent.keyboard(`{${forward}}`);
    const sub = screen.getByRole('menu', { name: L.print });
    await expect.element(sub).toBeVisible();
    await poll(() => startsWith(current(), L.small), 'first item of the submenu').toBe(true);
    const parentItem = screen.getByRole('menuitem', { name: L.print }).element();
    expectPopupSide({
      dir,
      trigger: parentItem,
      popup: sub.element(),
      side: 'inline-end',
      align: 'start',
    });
    await userEvent.keyboard(`{${backward}}`);
    await expect.element(sub).not.toBeInTheDocument();
    await poll(() => startsWith(current(), L.print), 'back on the submenu item').toBe(true);
  });

  it('typing an Arabic letter moves to the item that starts with it', async () => {
    await open(dir);
    await userEvent.keyboard('إ');
    await poll(() => startsWith(current(), L.cancel), '«إ» finds «إلغاء الموعد»').toBe(true);
    await userEvent.keyboard('ن');
    await poll(() => current(), 'a new letter after a pause').toBeDefined();
  });

  it('Enter runs the action, closes the menu and returns focus to the trigger', async () => {
    const onAction = vi.fn();
    const { screen, trigger } = await open(dir, onAction);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onAction).toHaveBeenCalledWith('copy');
    await expect.element(screen.getByRole('menu')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'focus back on the trigger').toBe(trigger);
  });

  it('Escape closes it and returns focus to the trigger', async () => {
    const { screen, trigger } = await open(dir);
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('menu')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'focus back on the trigger').toBe(trigger);
  });

  it('the disabled item says why and never runs, by Enter or by a press', async () => {
    const onAction = vi.fn();
    const { screen } = await open(dir, onAction);
    const item = screen.getByRole('menuitem', { name: new RegExp(L.move) }).element();
    expect(item.getAttribute('aria-disabled')).toBe('true');
    expect(item.textContent).toContain('لا طبيب متاح');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    await userEvent.click(item, { force: true });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('is clean under axe while open, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<AppointmentMenu />, { dir, theme });
      await userEvent.click(screen.getByRole('button', { name: 'إجراءات الموعد' }));
      await expect.element(screen.getByRole('menu')).toBeVisible();
      await expectAxeClean(screen.container);
      await userEvent.keyboard('{Escape}');
      await screen.unmount();
    }
  });
});
