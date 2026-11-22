// RTL gate (spec 0.4 criterion 7, slice 0.4-04): Popover in Arabic RTL and English LTR. It opens
// below its trigger aligned to the trigger's logical start (the right edge in Arabic), moves
// focus to its first field, and Escape or an outside press closes it with focus back on the
// trigger; axe is clean. Arrows, Arabic typeahead and digits do not apply (n/a).
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  expectAxeClean,
  renderDir,
  typeArabic,
  waitForPopupSide,
} from '../../test/support/index.ts';
import { Popover, PopoverContent, PopoverTrigger } from './popover.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const TITLE = 'ملاحظة للطبيب';

function NotePopover() {
  return (
    // A wide row, so the popup has room on both sides and must choose the logical start.
    <div className="flex justify-center p-16">
      <Popover>
        <PopoverTrigger startIcon="pencil">ملاحظة سريعة</PopoverTrigger>
        <PopoverContent title={TITLE}>
          <label className="flex flex-col gap-1">
            <span>الملاحظة</span>
            <textarea />
          </label>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

async function open(dir: 'rtl' | 'ltr') {
  const screen = await renderDir(<NotePopover />, { dir });
  const trigger = screen.getByRole('button', { name: 'ملاحظة سريعة' }).element() as HTMLElement;
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  const popup = screen.getByRole('dialog', { name: TITLE });
  await expect.element(popup).toBeVisible();
  return { screen, trigger, popup: popup.element() as HTMLElement };
}

describe.each(DIRS)('Popover gate in %s', (dir) => {
  it('opens below the trigger, aligned to its logical start', async () => {
    const { trigger, popup } = await open(dir);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await waitForPopupSide({ dir, trigger, popup, side: 'bottom', align: 'start' });
  });

  it('moves focus to its first field, which takes Arabic text', async () => {
    const { screen } = await open(dir);
    const field = screen
      .getByRole('textbox', { name: 'الملاحظة' })
      .element() as HTMLTextAreaElement;
    await poll(() => document.activeElement, 'focus in the first field').toBe(field);
    await typeArabic(field, 'يفضّل موعداً بعد الظهر');
  });

  it('Escape closes it and returns focus to the trigger', async () => {
    const { screen, trigger } = await open(dir);
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await poll(() => document.activeElement, 'focus back on the trigger').toBe(trigger);
  });

  it('an outside press closes it', async () => {
    const { screen } = await open(dir);
    await userEvent.click(document.body, { position: { x: 4, y: 4 } });
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });

  it('is clean under axe while open, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<NotePopover />, { dir, theme });
      await userEvent.click(screen.getByRole('button', { name: 'ملاحظة سريعة' }));
      await expect.element(screen.getByRole('dialog')).toBeVisible();
      await expectAxeClean(screen.container);
      await userEvent.keyboard('{Escape}');
      await screen.unmount();
    }
  });
});
