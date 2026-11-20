// Switch (slice 0.4-05, spec 0.4 criterion 8), as on the approved sheet: a setting that acts at
// once; Space toggles, Enter does not; on, the thumb moves to the logical end of the track (the
// left in Arabic); the ring is on the track; disabled leaves the tab order; axe is clean, light
// and dark.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, expectFocusRing, renderDir } from '../../test/support/index.ts';
import { Switch } from './switch.tsx';

const thumbSide = (track: Element) => {
  const t = track.getBoundingClientRect();
  const thumb = track.querySelector('[data-slot="thumb"]')?.getBoundingClientRect();
  if (thumb === undefined) throw new Error('no thumb');
  return thumb.left + thumb.width / 2 < t.left + t.width / 2 ? 'left' : 'right';
};

describe.each(['rtl', 'ltr'] as const)('Switch in %s', (dir) => {
  it('is named by its text; Space toggles and Enter does not', async () => {
    const onCheckedChange = vi.fn();
    const screen = await renderDir(
      <Switch onCheckedChange={onCheckedChange}>تذكير عبر واتساب</Switch>,
      { dir },
    );
    const sw = screen.getByRole('switch', { name: 'تذكير عبر واتساب' });
    await userEvent.tab();
    expect(document.activeElement).toBe(sw.element());
    await expectFocusRing(sw.element());
    await userEvent.keyboard(' ');
    await expect.element(sw).toBeChecked();
    await userEvent.keyboard('{Enter}');
    await expect.element(sw).toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByText('تذكير عبر واتساب'));
    await expect.element(sw).not.toBeChecked();
  });

  it('moves the thumb to the logical end when on', async () => {
    const screen = await renderDir(
      <>
        <Switch>أ</Switch>
        <Switch defaultChecked>ب</Switch>
      </>,
      { dir },
    );
    const off = screen.getByRole('switch', { name: 'أ' }).element();
    const on = screen.getByRole('switch', { name: 'ب' }).element();
    await expect.poll(() => thumbSide(off)).toBe(dir === 'rtl' ? 'right' : 'left');
    await expect.poll(() => thumbSide(on)).toBe(dir === 'rtl' ? 'left' : 'right');
  });

  it('disabled: out of the tab order and not toggled', async () => {
    const screen = await renderDir(
      <>
        <Switch disabled defaultChecked>
          تذكير
        </Switch>
        <button type="button">التالي</button>
      </>,
      { dir },
    );
    const sw = screen.getByRole('switch');
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button').element());
    await userEvent.click(screen.getByText('تذكير'), { force: true });
    await expect.element(sw).toBeChecked();
  });

  it('reads its description with it', async () => {
    const screen = await renderDir(
      <Switch description="يظهر للمرضى زر «احجز»">قبول الحجز من صفحة العيادة</Switch>,
      { dir },
    );
    const sw = screen.getByRole('switch').element();
    const ids = (sw.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids.map((id) => document.getElementById(id)?.textContent).join(' ')).toContain(
      'يظهر للمرضى زر «احجز»',
    );
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <div className="flex flex-col">
          <Switch>تذكير عبر واتساب</Switch>
          <Switch defaultChecked>تذكير بالرسائل</Switch>
          <Switch disabled>تذكير بالبريد</Switch>
          <Switch disabled defaultChecked description="يظهر للمرضى زر «احجز»">
            قبول الحجز
          </Switch>
        </div>,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
