// Toolbar (slice 0.4-07), as the owner approved the sheet on 2026-11-22: one Tab stop; the arrows
// of the reading direction move between its buttons (Left is next in Arabic), Home and End reach
// the ends, a disabled button is skipped, no wrapping. Groups are split by separators. What does
// not fit goes into a «المزيد» menu (our Menu, 0.4-04).
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { arrows, expectArrow, expectAxeClean, renderDir } from '../../test/support/index.ts';
import { Toolbar, ToolbarButton, ToolbarSeparator } from './toolbar.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

function PatientTools({ onExport, width }: { onExport?: () => void; width?: number }) {
  return (
    <div style={width === undefined ? undefined : { width }}>
      <Toolbar aria-label="أدوات قائمة المرضى">
        <ToolbarButton>طباعة</ToolbarButton>
        <ToolbarButton {...(onExport ? { onClick: onExport } : {})}>تصدير</ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton pressed>الأحدث أولاً</ToolbarButton>
        <ToolbarButton disabled>دمج</ToolbarButton>
        <ToolbarButton>الأعمدة</ToolbarButton>
      </Toolbar>
    </div>
  );
}

const maybeButton = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="toolbar"] button')].find(
    (b) => b.textContent.trim() === name,
  );
const button = (name: string): HTMLElement => {
  const found = maybeButton(name);
  if (found === undefined) throw new Error(`no button ${name}`);
  return found;
};

describe.each(DIRS)('Toolbar in %s', (dir) => {
  it('is a named toolbar with one Tab stop', async () => {
    const screen = await renderDir(<PatientTools />, { dir });
    const bar = screen.getByRole('toolbar', { name: 'أدوات قائمة المرضى' }).element();
    await userEvent.tab();
    expect(document.activeElement).toBe(button('طباعة'));
    await userEvent.tab();
    expect(bar.contains(document.activeElement)).toBe(false);
    await screen.unmount();
  });

  it('moves with the arrow of the reading direction', async () => {
    const screen = await renderDir(<PatientTools />, { dir });
    await expectArrow({ dir, items: [button('طباعة'), button('تصدير')] });
    await screen.unmount();
  });

  it('skips a disabled button; Home and End reach the ends; no wrapping', async () => {
    const screen = await renderDir(<PatientTools />, { dir });
    const { forward } = arrows(dir);
    button('الأحدث أولاً').focus();
    await userEvent.keyboard(`{${forward}}`);
    await poll(() => document.activeElement, 'past «دمج»').toBe(button('الأعمدة'));
    await userEvent.keyboard(`{${forward}}`);
    await poll(() => document.activeElement, 'stays at the end').toBe(button('الأعمدة'));
    await userEvent.keyboard('{Home}');
    await poll(() => document.activeElement, 'Home').toBe(button('طباعة'));
    await userEvent.keyboard('{End}');
    await poll(() => document.activeElement, 'End').toBe(button('الأعمدة'));
    await screen.unmount();
  });

  it('a pressed button says so; a separator is vertical', async () => {
    const screen = await renderDir(<PatientTools />, { dir });
    expect(button('الأحدث أولاً').getAttribute('aria-pressed')).toBe('true');
    const sep = screen.getByRole('separator').element();
    expect(sep.getAttribute('aria-orientation')).toBe('vertical');
    await screen.unmount();
  });

  it('a press calls the button back', async () => {
    const onExport = vi.fn();
    const screen = await renderDir(<PatientTools onExport={onExport} />, { dir });
    await userEvent.click(button('تصدير'));
    expect(onExport).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });

  it('when narrow, the last buttons move into «المزيد»', async () => {
    const onExport = vi.fn();
    const screen = await renderDir(<PatientTools onExport={onExport} width={220} />, { dir });
    const more = await vi.waitFor(() => {
      const el = screen.getByRole('button', { name: 'المزيد' }).element();
      return el;
    });
    // The columns button no longer shows in the bar.
    await poll(() => {
      const b = maybeButton('الأعمدة');
      return b === undefined || b.offsetParent === null;
    }, 'hidden in the bar').toBe(true);
    await userEvent.click(more);
    const item = await vi.waitFor(() =>
      screen.getByRole('menuitem', { name: 'الأعمدة' }).element(),
    );
    expect(item).toBeTruthy();
    await userEvent.click(screen.getByRole('menuitem', { name: 'الأعمدة' }));
    await screen.unmount();
  });

  it('when wide, there is no «المزيد»', async () => {
    const screen = await renderDir(<PatientTools width={900} />, { dir });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.querySelector('[aria-label="المزيد"]')).toBeNull();
    await screen.unmount();
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<PatientTools />, { dir, theme });
      await expectAxeClean(document.body);
      await screen.unmount();
    }
  });
});

// Slice 0.4-12 (OD-66; sheet "Before Phase A · 0.4-12 and 0.4-13", approved 2026-11-23): a long
// button label stays on one line, at most 150 px, cut with an ellipsis; the icon keeps its size;
// the full label is the button's name and shows in a tooltip when cut.
const LONG_LABEL = 'تصدير قائمة المرضى المسجلين هذا الأسبوع';

function LongTools() {
  return (
    <div style={{ width: 900 }}>
      <Toolbar aria-label="أدوات قائمة المرضى">
        <ToolbarButton icon="list">{LONG_LABEL}</ToolbarButton>
        <ToolbarButton>طباعة</ToolbarButton>
      </Toolbar>
    </div>
  );
}

const openTooltip = () => document.querySelector<HTMLElement>('[role="tooltip"][data-open]');

describe.each(DIRS)('a long Toolbar label in %s', (dir) => {
  it('stays on one line, at most 150 px, the icon full size', async () => {
    const screen = await renderDir(<LongTools />, { dir });
    const b = screen.getByRole('button', { name: LONG_LABEL }).element() as HTMLElement;
    const label = b.querySelector<HTMLElement>('[data-slot="toolbar-label"]');
    expect(label).not.toBeNull();
    if (label === null) return;
    expect(label.getClientRects()).toHaveLength(1);
    expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(150.5);
    expect(getComputedStyle(label).textOverflow).toBe('ellipsis');
    expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
    const icon = b.querySelector('svg') as SVGElement;
    const size = tokenPx('--shifa-size-icon-sm', b);
    expect(icon.getBoundingClientRect().width).toBeCloseTo(size, 0);
    expect(icon.getBoundingClientRect().height).toBeCloseTo(size, 0);
    await screen.unmount();
  });

  it('shows the full label in a tooltip when cut, on focus and on hover', async () => {
    const screen = await renderDir(<LongTools />, { dir });
    await userEvent.tab();
    await poll(() => openTooltip()?.textContent, 'open on focus').toBe(LONG_LABEL);
    await userEvent.keyboard('{Escape}');
    await screen.unmount();
  });

  it('a short label has no tooltip', async () => {
    const screen = await renderDir(<LongTools />, { dir });
    await userEvent.hover(screen.getByRole('button', { name: 'طباعة' }));
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(openTooltip()).toBeNull();
    await screen.unmount();
  });
});

/** A length token in px, as the element sees it. */
function tokenPx(name: string, within: Element): number {
  const probe = document.createElement('div');
  probe.style.width = `var(${name})`;
  within.appendChild(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();
  return px;
}
