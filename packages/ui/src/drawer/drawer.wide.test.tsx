// Drawer size="wide" (A-03-01, sheet A03SheetDrawerWide approved by the owner 2026-11-27): a side
// panel of `shifa-size-drawer` plus `shifa-width-37-5` (550 px) for a long form with fields side by
// side; never wider than the screen; the default stays 400 px; the header, the scrolling body and
// the actions as today.
import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir } from '../../test/support/index.ts';
import { Input } from '../input/input.tsx';
import { Drawer, DrawerActions, DrawerClose, DrawerContent, DrawerTrigger } from './drawer.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const TITLE = 'مريض جديد';

async function open(
  dir: 'rtl' | 'ltr',
  size?: 'default' | 'wide',
  theme: 'light' | 'dark' = 'light',
) {
  const screen = await renderDir(
    <Drawer {...(size === undefined ? {} : { size })}>
      <DrawerTrigger>مريض جديد</DrawerTrigger>
      <DrawerContent title={TITLE} description="يأخذ الملف رقمه التالي عند الحفظ">
        <Input label="الاسم" required />
        <DrawerActions>
          <DrawerClose>إلغاء</DrawerClose>
        </DrawerActions>
      </DrawerContent>
    </Drawer>,
    { dir, theme },
  );
  (screen.getByRole('button', { name: 'مريض جديد' }).element() as HTMLElement).focus();
  await userEvent.keyboard('{Enter}');
  const panel = screen.getByRole('dialog', { name: TITLE });
  await expect.element(panel).toBeVisible();
  return { screen, panel: panel.element() as HTMLElement };
}

async function width(panel: HTMLElement): Promise<number> {
  let last = -1;
  await expect
    .poll(() => {
      const now = panel.getBoundingClientRect().width;
      const same = now === last;
      last = now;
      return same;
    })
    .toBe(true);
  return Math.round(last);
}

describe.each(DIRS)('Drawer size in %s', (dir) => {
  it('wide is 550 px; the default stays 400 px', async () => {
    const wide = await open(dir, 'wide');
    expect(await width(wide.panel)).toBe(550);
    await wide.screen.unmount();
    const plain = await open(dir);
    expect(await width(plain.panel)).toBe(400);
    await plain.screen.unmount();
  });

  it('wide on a screen narrower than 550 px takes the whole width', async () => {
    await page.viewport(500, 800);
    try {
      const { screen, panel } = await open(dir, 'wide');
      expect(await width(panel)).toBe(500);
      await screen.unmount();
    } finally {
      await page.viewport(1280, 800);
    }
  });

  it.each(['light', 'dark'] as const)('wide is axe clean in %s', async (theme) => {
    const { screen } = await open(dir, 'wide', theme);
    await expectAxeClean(document.body);
    await screen.unmount();
  });
});
