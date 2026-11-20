// Spec 0.4 criterion 9 (slice 0.4-03): Button as the owner approved its sheet (2026-11-20), in a
// real browser and in both directions: keyboard activation, focus ring, disabled and loading,
// the icon on the logical start, the variant colours and sizes from the tokens, axe.
import type { CSSProperties } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { Button } from './button.tsx';

const DIRS = ['rtl', 'ltr'] as const;
/** Fixture geometry (a 256 px column), kept out of inline style literals the lint rule reads. */
const NARROW: CSSProperties = { width: 256 };
const rect = (el: Element) => el.getBoundingClientRect();
const style = (el: Element) => getComputedStyle(el);

describe.each(DIRS)('Button in %s', (dir) => {
  it('is a native button of type button with its label', async () => {
    const screen = await renderDir(<Button>حفظ الزيارة</Button>, { dir });
    const button = screen.getByRole('button', { name: 'حفظ الزيارة' }).element();
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('activates with Enter and with Space', async () => {
    const onClick = vi.fn();
    await renderDir(<Button onClick={onClick}>حفظ</Button>, { dir });
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('shows the 2 px focus ring in the focus colour when reached by keyboard', async () => {
    const screen = await renderDir(<Button>حفظ</Button>, { dir });
    await userEvent.tab();
    const button = screen.getByRole('button').element();
    expect(document.activeElement).toBe(button);
    expect(style(button).outlineStyle).toBe('solid');
    expect(style(button).outlineWidth).toBe('2px');
    expect(style(button).outlineColor).toBe(tokenColor('--shifa-color-border-focus', button));
    expect(style(button).boxShadow).not.toBe('none');
  });

  it('disabled: natively disabled, out of the tab order, never activates', async () => {
    const onClick = vi.fn();
    const screen = await renderDir(
      <>
        <Button disabled onClick={onClick}>
          حفظ
        </Button>
        <Button>طباعة</Button>
      </>,
      { dir },
    );
    const disabled = screen.getByRole('button', { name: 'حفظ' }).element();
    expect(disabled.hasAttribute('disabled')).toBe(true);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'طباعة' }).element());
    await userEvent.click(disabled, { force: true });
    expect(onClick).not.toHaveBeenCalled();
    expect(style(disabled).color).toBe(tokenColor('--shifa-color-text-disabled', disabled));
  });

  it('loading: busy, still focusable, label kept, a spinner before it, never activates', async () => {
    const onClick = vi.fn();
    const screen = await renderDir(
      <Button loading onClick={onClick}>
        حفظ الزيارة
      </Button>,
      { dir },
    );
    const button = screen.getByRole('button', { name: 'حفظ الزيارة' }).element();
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    await userEvent.keyboard('{Enter}');
    // force: Playwright waits for an aria-disabled element to become enabled before clicking.
    await userEvent.click(button, { force: true });
    expect(onClick).not.toHaveBeenCalled();
    const spinner = button.querySelector('[data-slot="spinner"]');
    expect(spinner, 'spinner').not.toBeNull();
    const label = button.querySelector('[data-slot="label"]');
    expect(label?.textContent).toBe('حفظ الزيارة');
    if (!spinner || !label) return;
    // The spinner is on the logical start, like an icon.
    if (dir === 'rtl') expect(rect(spinner).left).toBeGreaterThan(rect(label).left);
    else expect(rect(spinner).left).toBeLessThan(rect(label).left);
  });

  it('puts the start icon on the logical start and the end icon on the logical end', async () => {
    const screen = await renderDir(
      <>
        <Button startIcon="calendar-plus">حجز موعد</Button>
        <Button endIcon="arrow-forward">التالي</Button>
      </>,
      { dir },
    );
    const [book, next] = screen.getByRole('button').elements();
    const parts = (button: Element | undefined) => {
      const icon = button?.querySelector('svg');
      const label = button?.querySelector('[data-slot="label"]');
      if (!icon || !label) throw new Error('icon or label missing');
      return { icon: rect(icon), label: rect(label) };
    };
    const start = parts(book);
    const end = parts(next);
    if (dir === 'rtl') {
      expect(start.icon.left).toBeGreaterThan(start.label.left);
      expect(end.icon.left).toBeLessThan(end.label.left);
    } else {
      expect(start.icon.left).toBeLessThan(start.label.left);
      expect(end.icon.left).toBeGreaterThan(end.label.left);
    }
  });

  it('icon only: named by aria-label and square', async () => {
    const screen = await renderDir(<Button startIcon="printer" aria-label="طباعة" />, { dir });
    const button = screen.getByRole('button', { name: 'طباعة' }).element();
    expect(rect(button).width).toBe(rect(button).height);
  });

  it('draws each variant in its tokens', async () => {
    const screen = await renderDir(
      <>
        <Button variant="primary">أ</Button>
        <Button variant="secondary">ب</Button>
        <Button variant="ghost">ج</Button>
        <Button variant="danger">د</Button>
      </>,
      { dir },
    );
    const [primary, secondary, ghost, danger] = screen.getByRole('button').elements();
    if (!primary || !secondary || !ghost || !danger) throw new Error('four buttons expected');
    expect(style(primary).backgroundColor).toBe(tokenColor('--shifa-button-primary-bg', primary));
    expect(style(primary).color).toBe(tokenColor('--shifa-button-primary-fg', primary));
    expect(style(secondary).backgroundColor).toBe(
      tokenColor('--shifa-color-bg-surface', secondary),
    );
    expect(style(secondary).borderTopColor).toBe(
      tokenColor('--shifa-color-border-strong', secondary),
    );
    expect(style(ghost).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(style(ghost).color).toBe(tokenColor('--shifa-color-brand-primary', ghost));
    expect(style(danger).backgroundColor).toBe(
      tokenColor('--shifa-color-status-danger-solid', danger),
    );
    expect(style(danger).color).toBe(tokenColor('--shifa-color-status-danger-on-solid', danger));
  });

  it('is secondary and medium by default', async () => {
    const screen = await renderDir(<Button>طباعة</Button>, { dir });
    const button = screen.getByRole('button').element();
    expect(style(button).backgroundColor).toBe(tokenColor('--shifa-color-bg-surface', button));
    expect(rect(button).height).toBe(44);
  });

  it.each([
    ['comfortable', [36, 44, 52]],
    ['compact', [28, 32, 40]],
  ] as const)('has the control heights of the %s density', async (density, heights) => {
    const screen = await renderDir(
      <>
        <Button size="sm">أ</Button>
        <Button size="md">ب</Button>
        <Button size="lg">ج</Button>
      </>,
      { dir, density },
    );
    expect(
      screen
        .getByRole('button')
        .elements()
        .map((b) => rect(b).height),
    ).toEqual(heights);
  });

  it('wraps a long label onto two lines in a narrow place instead of clipping it', async () => {
    const screen = await renderDir(
      <div style={NARROW}>
        <Button variant="primary" className="w-full">
          تأكيد حضور المريض وإرساله إلى غرفة الطبيب
        </Button>
      </div>,
      { dir },
    );
    const button = screen.getByRole('button').element();
    expect(rect(button).height).toBeGreaterThan(44);
    expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
  });

  it('has no axe violations in any variant, state or size', async () => {
    const screen = await renderDir(
      <div className="flex flex-wrap gap-2 bg-bg-app p-4">
        {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
          <div key={variant} className="flex gap-2">
            <Button variant={variant}>حفظ</Button>
            <Button variant={variant} disabled>
              حفظ
            </Button>
            <Button variant={variant} loading>
              حفظ
            </Button>
            <Button variant={variant} startIcon="printer" aria-label="طباعة" />
          </div>
        ))}
      </div>,
      { dir },
    );
    await expectAxeClean(screen.container);
  });
});
