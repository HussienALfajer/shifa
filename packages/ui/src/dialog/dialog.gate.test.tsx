// RTL gate (spec 0.4 criterion 7, slice 0.4-04): Dialog in Arabic RTL and English LTR. It is a
// named modal dialog; focus starts on the safe action, stays inside, and returns to the trigger
// on Escape or close; the close button sits at the logical end of the title; axe is clean.
// Arrows, popup side (it is centred), Arabic typeahead and digits do not apply (n/a).
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir } from '../../test/support/index.ts';
import { Button } from '../button/button.tsx';
import { Dialog, DialogActions, DialogClose, DialogContent, DialogTrigger } from './dialog.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const TITLE = 'إلغاء الموعد؟';

function CancelDialog({ onConfirm = () => undefined }: { onConfirm?: () => void }) {
  return (
    <Dialog>
      <DialogTrigger>إلغاء الموعد</DialogTrigger>
      <DialogContent title={TITLE} description="سيصل المريضَ إشعار بالإلغاء.">
        <DialogActions>
          <DialogClose>رجوع</DialogClose>
          <Button variant="danger" onClick={onConfirm}>
            تأكيد الإلغاء
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

async function open(dir: 'rtl' | 'ltr', ui = <CancelDialog />) {
  const screen = await renderDir(ui, { dir });
  const trigger = screen.getByRole('button', { name: 'إلغاء الموعد' }).element() as HTMLElement;
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  const dialog = screen.getByRole('dialog', { name: TITLE });
  await expect.element(dialog).toBeVisible();
  return { screen, trigger, dialog: dialog.element() as HTMLElement };
}

describe.each(DIRS)('Dialog gate in %s', (dir) => {
  it('opens a named, described modal dialog from its trigger', async () => {
    const { dialog, trigger } = await open(dir);
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const describedBy = dialog.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.textContent).toBe('سيصل المريضَ إشعار بالإلغاء.');
  });

  it('puts focus on the safe action first', async () => {
    const { screen } = await open(dir);
    await poll(() => document.activeElement, 'focus on «رجوع»').toBe(
      screen.getByRole('button', { name: 'رجوع' }).element(),
    );
  });

  it('traps Tab and Shift+Tab inside the dialog', async () => {
    const { dialog } = await open(dir);
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 5; i++) {
      await userEvent.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('Escape closes it and returns focus to the trigger', async () => {
    const { screen, trigger } = await open(dir);
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'focus back on the trigger').toBe(trigger);
  });

  it('the close button and «رجوع» close it; focus returns to the trigger', async () => {
    const { screen, trigger } = await open(dir);
    await userEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'after close').toBe(trigger);
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'رجوع' }));
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'after «رجوع»').toBe(trigger);
  });

  it('runs the action of a button inside it', async () => {
    const onConfirm = vi.fn();
    const { screen } = await open(dir, <CancelDialog onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'تأكيد الإلغاء' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('puts the close button at the logical end of the title and the main action last', async () => {
    const { screen } = await open(dir);
    const close = screen.getByRole('button', { name: 'إغلاق' }).element().getBoundingClientRect();
    const title = screen.getByRole('heading', { name: TITLE }).element().getBoundingClientRect();
    const back = screen.getByRole('button', { name: 'رجوع' }).element().getBoundingClientRect();
    const confirm = screen
      .getByRole('button', { name: 'تأكيد الإلغاء' })
      .element()
      .getBoundingClientRect();
    if (dir === 'rtl') {
      expect(close.right).toBeLessThanOrEqual(title.left + 1);
      expect(confirm.right).toBeLessThanOrEqual(back.left + 1);
    } else {
      expect(close.left).toBeGreaterThanOrEqual(title.right - 1);
      expect(confirm.left).toBeGreaterThanOrEqual(back.right - 1);
    }
  });

  it('is clean under axe while open, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<CancelDialog />, { dir, theme });
      await userEvent.click(screen.getByRole('button', { name: 'إلغاء الموعد' }));
      await expect.element(screen.getByRole('dialog')).toBeVisible();
      await expectAxeClean(document.body);
      await userEvent.keyboard('{Escape}');
      await screen.unmount();
    }
  });
});
