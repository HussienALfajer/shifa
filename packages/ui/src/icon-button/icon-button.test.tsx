// Icon Button (slice 0.4-05, spec 0.4 criterion 8), as on the approved sheet: a square button
// with no visible text, so its name is required; 44 px (md) or 36 px (sm) in the comfortable
// density, 32 and 28 compact; Enter and Space press it; disabled leaves the tab order; the focus
// ring is the Button's; axe is clean in every variant, light and dark.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, expectFocusRing, renderDir } from '../../test/support/index.ts';
import { IconButton } from './icon-button.tsx';

describe.each(['rtl', 'ltr'] as const)('Icon Button in %s', (dir) => {
  it('is a button named by its label, pressed by Enter and Space', async () => {
    const onClick = vi.fn();
    const screen = await renderDir(<IconButton icon="pencil" label="تعديل" onClick={onClick} />, {
      dir,
    });
    const button = screen.getByRole('button', { name: 'تعديل' }).element();
    expect(button.textContent.trim()).toBe('');
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    await expectFocusRing(button);
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('is square: 44 px (md) and 36 px (sm), 32 and 28 compact', async () => {
    for (const [density, md, sm] of [
      ['comfortable', 44, 36],
      ['compact', 32, 28],
    ] as const) {
      const screen = await renderDir(
        <>
          <IconButton icon="x" label="إغلاق" />
          <IconButton icon="x" label="مسح" size="sm" />
        </>,
        { dir, density },
      );
      const a = screen.getByRole('button', { name: 'إغلاق' }).element().getBoundingClientRect();
      const b = screen.getByRole('button', { name: 'مسح' }).element().getBoundingClientRect();
      expect([Math.round(a.width), Math.round(a.height)]).toEqual([md, md]);
      expect([Math.round(b.width), Math.round(b.height)]).toEqual([sm, sm]);
      await screen.unmount();
    }
  });

  it('disabled: not pressed and out of the tab order', async () => {
    const onClick = vi.fn();
    const screen = await renderDir(
      <>
        <IconButton icon="trash" label="حذف المرفق" variant="danger" disabled onClick={onClick} />
        <button type="button">التالي</button>
      </>,
      { dir },
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'التالي' }).element());
    await userEvent.click(screen.getByRole('button', { name: 'حذف المرفق' }), { force: true });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is clean under axe in every variant, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <div className="flex gap-2">
          <IconButton icon="pencil" label="تعديل" />
          <IconButton icon="x" label="إغلاق" variant="ghost" />
          <IconButton icon="plus" label="إضافة موعد" variant="primary" />
          <IconButton icon="trash" label="حذف المرفق" variant="danger" />
          <IconButton icon="pencil" label="تعديل الملاحظة" disabled />
        </div>,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
