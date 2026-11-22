// Drawer (slice 0.4-06) in Arabic RTL and English LTR, as the owner approved the sheet on
// 2026-11-22 with OD-63: a modal panel that slides in from the logical end by default (the left
// edge in Arabic, the right in English), 400 px wide; `side="bottom"` rises from the bottom on a
// tablet or phone with a named grabber. Focus starts on the first field, stays inside, and returns
// to the trigger when Escape, the close button or a press outside closes it.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir } from '../../test/support/index.ts';
import { Input } from '../input/input.tsx';
import { Drawer, DrawerActions, DrawerClose, DrawerContent, DrawerTrigger } from './drawer.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const TITLE = 'تعديل الموعد';

function EditAppointment({ side }: { side?: 'start' | 'end' | 'bottom' }) {
  return (
    <Drawer {...(side === undefined ? {} : { side })}>
      <DrawerTrigger>تعديل</DrawerTrigger>
      <DrawerContent title={TITLE} description="موعد الثلاثاء 24/11/2026 الساعة 10:30.">
        <Input label="ملاحظة" defaultValue="يفضّل موعداً بعد الظهر" />
        <DrawerActions>
          <DrawerClose>إلغاء</DrawerClose>
        </DrawerActions>
      </DrawerContent>
    </Drawer>
  );
}

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1500, message });

async function open(dir: 'rtl' | 'ltr', side?: 'start' | 'end' | 'bottom') {
  const screen = await renderDir(<EditAppointment {...(side === undefined ? {} : { side })} />, {
    dir,
  });
  const trigger = screen.getByRole('button', { name: 'تعديل' }).element() as HTMLElement;
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  const panel = screen.getByRole('dialog', { name: TITLE });
  await expect.element(panel).toBeVisible();
  return { screen, trigger, panel: panel.element() as HTMLElement };
}

/** Waits until the panel has stopped moving and returns its box. */
async function settled(panel: HTMLElement): Promise<DOMRect> {
  let last = '';
  await poll(() => {
    const now = JSON.stringify(panel.getBoundingClientRect());
    const same = now === last;
    last = now;
    return same;
  }, 'the panel stops moving').toBe(true);
  return panel.getBoundingClientRect();
}

describe.each(DIRS)('Drawer in %s', (dir) => {
  it('opens a named modal panel with focus on its first field', async () => {
    const { screen, panel } = await open(dir);
    expect(panel.getAttribute('aria-modal')).toBe('true');
    await poll(() => document.activeElement, 'focus on the field').toBe(
      screen.getByRole('textbox', { name: 'ملاحظة' }).element(),
    );
    await screen.unmount();
  });

  it('side="end" is the left edge in RTL and the right edge in LTR, 400 px wide', async () => {
    const { screen, panel } = await open(dir);
    const box = await settled(panel);
    if (dir === 'rtl') expect(Math.abs(box.left)).toBeLessThanOrEqual(1);
    else expect(Math.abs(box.right - window.innerWidth)).toBeLessThanOrEqual(1);
    expect(Math.round(box.width)).toBe(Math.min(400, window.innerWidth));
    await screen.unmount();
  });

  it('side="start" is the opposite edge', async () => {
    const { screen, panel } = await open(dir, 'start');
    const box = await settled(panel);
    if (dir === 'rtl') expect(Math.abs(box.right - window.innerWidth)).toBeLessThanOrEqual(1);
    else expect(Math.abs(box.left)).toBeLessThanOrEqual(1);
    await screen.unmount();
  });

  it('side="bottom" rises from the bottom with a named grabber', async () => {
    const { screen, panel } = await open(dir, 'bottom');
    const box = await settled(panel);
    expect(Math.abs(box.bottom - window.innerHeight)).toBeLessThanOrEqual(1);
    const grabber = screen.getByRole('button', { name: 'اسحب لتغيير الحجم أو للإغلاق' });
    expect(panel.contains(grabber.element())).toBe(true);
    await screen.unmount();
  });

  it('keeps Tab inside', async () => {
    const { screen, panel } = await open(dir);
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      expect(panel.contains(document.activeElement)).toBe(true);
    }
    await screen.unmount();
  });

  it('Escape, the close button and a press outside close it; focus returns', async () => {
    const { screen, trigger } = await open(dir);
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'after Escape').toBe(trigger);

    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'after the close button').toBe(trigger);

    await userEvent.keyboard('{Enter}');
    const panel = screen.getByRole('dialog', { name: TITLE }).element() as HTMLElement;
    await settled(panel);
    const box = panel.getBoundingClientRect();
    // A point on the page beside the panel, on the side away from it.
    const x = dir === 'rtl' ? window.innerWidth - 8 : 8;
    await userEvent.click(document.body, { position: { x, y: box.top + 40 }, force: true });
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'after a press outside').toBe(trigger);
    await screen.unmount();
  });

  it('is clean under axe while open, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<EditAppointment />, { dir, theme });
      await userEvent.click(screen.getByRole('button', { name: 'تعديل' }));
      const panel = screen.getByRole('dialog', { name: TITLE });
      await expect.element(panel).toBeVisible();
      await settled(panel.element() as HTMLElement);
      await expectAxeClean(document.body);
      await userEvent.keyboard('{Escape}');
      await screen.unmount();
    }
  });
});
