// Alert dialog (slice 0.4-06) in Arabic RTL and English LTR, as the owner approved the sheet on
// 2026-11-22: a dialog that asks for an explicit answer. It opens with focus on the least harmful
// action («رجوع»), keeps Tab inside, never closes on a press outside and has no close button;
// Escape and «رجوع» close it and focus returns to the trigger. The action is last (the left in
// Arabic) in the danger or primary look; while its Promise runs the dialog stays open, the button
// keeps its label and says it is busy; a failure keeps the dialog open with the caller's message.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTrigger,
} from './alert-dialog.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const TITLE = 'حذف الوصفة؟';
const DESCRIPTION = 'وصفة 12/11/2026، ثلاثة أدوية. لا يمكن التراجع عن الحذف.';

function DeletePrescription({ onAction = () => undefined }: { onAction?: () => unknown }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger variant="danger">حذف الوصفة</AlertDialogTrigger>
      <AlertDialogContent title={TITLE} description={DESCRIPTION}>
        <AlertDialogCancel>رجوع</AlertDialogCancel>
        <AlertDialogAction
          variant="danger"
          onAction={onAction}
          errorText="تعذّر حذف الوصفة. حاول مجدداً."
        >
          حذف نهائي
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1500, message });

async function open(dir: 'rtl' | 'ltr', ui = <DeletePrescription />) {
  const screen = await renderDir(ui, { dir });
  const trigger = screen.getByRole('button', { name: 'حذف الوصفة' }).element() as HTMLElement;
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  const dialog = screen.getByRole('alertdialog', { name: TITLE });
  await expect.element(dialog).toBeVisible();
  return { screen, trigger, dialog: dialog.element() as HTMLElement };
}

describe.each(DIRS)('Alert dialog in %s', (dir) => {
  it('opens a named, described modal alert dialog with no close button', async () => {
    const { screen, dialog } = await open(dir);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const describedBy = dialog.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.textContent).toBe(DESCRIPTION);
    expect(screen.getByRole('button', { name: 'إغلاق' }).elements()).toHaveLength(0);
    await screen.unmount();
  });

  it('puts focus on «رجوع» first and keeps Tab inside', async () => {
    const { screen, dialog } = await open(dir);
    await poll(() => document.activeElement, 'focus on «رجوع»').toBe(
      screen.getByRole('button', { name: 'رجوع' }).element(),
    );
    for (let i = 0; i < 4; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await screen.unmount();
  });

  it('does not close on a press outside', async () => {
    const { screen, dialog } = await open(dir);
    await userEvent.click(document.body, { position: { x: 4, y: 4 }, force: true });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(dialog.isConnected && dialog.hasAttribute('data-open')).toBe(true);
    await screen.unmount();
  });

  it('Escape and «رجوع» close it and return focus to the trigger', async () => {
    const { screen, trigger } = await open(dir);
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'after Escape').toBe(trigger);
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'رجوع' }));
    await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'after «رجوع»').toBe(trigger);
    await screen.unmount();
  });

  it('puts the action last, at the logical end, in the danger colours', async () => {
    const { screen } = await open(dir);
    const back = screen.getByRole('button', { name: 'رجوع' }).element();
    const action = screen.getByRole('button', { name: 'حذف نهائي' }).element();
    const b = back.getBoundingClientRect();
    const a = action.getBoundingClientRect();
    if (dir === 'rtl') expect(a.right).toBeLessThanOrEqual(b.left + 1);
    else expect(a.left).toBeGreaterThanOrEqual(b.right - 1);
    expect(getComputedStyle(action).backgroundColor).toBe(
      tokenColor('--shifa-color-status-danger-solid', action),
    );
    await screen.unmount();
  });

  it('stays open and busy while the action runs, then closes', async () => {
    let finish: () => void = () => undefined;
    const onAction = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { screen, trigger } = await open(dir, <DeletePrescription onAction={onAction} />);
    const action = screen.getByRole('button', { name: 'حذف نهائي' });
    await userEvent.click(action);
    expect(onAction).toHaveBeenCalledTimes(1);
    await poll(() => action.element().getAttribute('aria-busy'), 'busy').toBe('true');
    expect(action.element().textContent).toContain('حذف نهائي');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog').element().isConnected).toBe(true);
    finish();
    await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'focus back on the trigger').toBe(trigger);
    await screen.unmount();
  });

  it('keeps the dialog open with the error message when the action fails', async () => {
    const onAction = vi.fn(() => Promise.reject(new Error('offline')));
    const { screen } = await open(dir, <DeletePrescription onAction={onAction} />);
    await userEvent.click(screen.getByRole('button', { name: 'حذف نهائي' }));
    await expect.element(screen.getByRole('alert')).toMatchTextContent('تعذّر حذف الوصفة');
    expect(screen.getByRole('alertdialog').element().isConnected).toBe(true);
    await screen.unmount();
  });

  it('does not animate under reduced motion', async () => {
    const screen = await renderDir(
      <div data-motion="reduce">
        <DeletePrescription />
      </div>,
      { dir },
    );
    await userEvent.click(screen.getByRole('button', { name: 'حذف الوصفة' }));
    const dialog = screen.getByRole('alertdialog').element();
    expect(getComputedStyle(dialog).transitionDuration).toBe('0s');
    await screen.unmount();
  });

  it('is clean under axe while open, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<DeletePrescription />, { dir, theme });
      await userEvent.click(screen.getByRole('button', { name: 'حذف الوصفة' }));
      await expect.element(screen.getByRole('alertdialog')).toBeVisible();
      await expectAxeClean(document.body);
      await userEvent.keyboard('{Escape}');
      await screen.unmount();
    }
  });
});
