// Textarea (slice 0.4-05, spec 0.4 criterion 8), as on the approved sheet: Enter adds a line,
// a limit shows a «n / max» counter in Western digits, keyboard focus shows the ring, disabled
// and read-only behave as Input; an error is read with it; axe is clean, light and dark.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  expectAxeClean,
  expectFocusRing,
  renderDir,
  typeArabic,
} from '../../test/support/index.ts';
import { Textarea } from './textarea.tsx';

const described = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

describe.each(['rtl', 'ltr'] as const)('Textarea in %s', (dir) => {
  it('is named by its label; Enter adds a line and does not submit', async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => {
      e.preventDefault();
    });
    const screen = await renderDir(
      <form onSubmit={onSubmit}>
        <Textarea label="ملاحظات للطبيب" />
      </form>,
      { dir },
    );
    const area = screen
      .getByRole('textbox', { name: 'ملاحظات للطبيب' })
      .element() as HTMLTextAreaElement;
    await typeArabic(area, 'سطر');
    await userEvent.keyboard('{Enter}ثان');
    expect(area.value).toBe('سطر\nثان');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a counter in Western digits when it has a limit', async () => {
    const screen = await renderDir(
      <Textarea label="ملاحظات للطبيب" maxLength={500} defaultValue="مرحبا" />,
      { dir },
    );
    await expect.element(screen.getByText('5 / 500')).toBeVisible();
    const area = screen.getByRole('textbox').element() as HTMLTextAreaElement;
    await userEvent.type(area, 'ب');
    await expect.element(screen.getByText('6 / 500')).toBeVisible();
    expect(area.maxLength).toBe(500);
  });

  it('has no counter without a limit', async () => {
    const screen = await renderDir(<Textarea label="ملاحظات" defaultValue="مرحبا" />, { dir });
    expect(screen.getByText(/\/\s*\d+/).query()).toBeNull();
  });

  it('shows the focus ring on keyboard focus', async () => {
    const screen = await renderDir(<Textarea label="ملاحظات" />, { dir });
    await userEvent.tab();
    const area = screen.getByRole('textbox').element();
    expect(document.activeElement).toBe(area);
    await expectFocusRing(area);
  });

  it('disabled and read-only', async () => {
    const screen = await renderDir(
      <>
        <Textarea label="أ" defaultValue="نص" disabled />
        <Textarea label="ب" defaultValue="نص" readOnly />
      </>,
      { dir },
    );
    const a = screen.getByRole('textbox', { name: 'أ' }).element() as HTMLTextAreaElement;
    const b = screen.getByRole('textbox', { name: 'ب' }).element() as HTMLTextAreaElement;
    expect(a.disabled).toBe(true);
    await userEvent.tab();
    expect(document.activeElement).toBe(b);
    await userEvent.keyboard('x');
    expect(b.value).toBe('نص');
  });

  it('an error marks it invalid and is read with it', async () => {
    const screen = await renderDir(
      <Textarea label="ملاحظات" maxLength={500} error="500 حرف على الأكثر" />,
      { dir },
    );
    const area = screen.getByRole('textbox').element();
    expect(area.getAttribute('aria-invalid')).toBe('true');
    expect(described(area)).toContain('500 حرف على الأكثر');
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <div className="flex flex-col gap-4">
          <Textarea label="ملاحظات" maxLength={500} hint="تظهر للطبيب فقط" defaultValue="نص" />
          <Textarea label="ملاحظات" error="500 حرف على الأكثر" />
          <Textarea label="ملاحظات" disabled defaultValue="نص" />
        </div>,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
