// Pagination at narrow widths (slice 0.4-12, OD-66; sheet "Before Phase A · 0.4-12 and 0.4-13",
// approved 2026-11-23): below 430 px of its own width the compact form («الصفحة 3 من 13», two
// arrows, the summary on a second line) shows, at or above it the page numbers; a container with
// no size gets the compact form. Every button stays inside the region, at 200 % zoom too. The
// rows-per-page Select is at least 88 px wide (76 px compact) and shows «100» unclipped.
// `form="numbers" | "compact"` still forces one form.
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { type Region, renderDir } from '../../test/support/index.ts';
import * as stories from './pagination.stories.tsx';
import { Pagination } from './pagination.tsx';

const DIRS = ['rtl', 'ltr'] as const;

function Sized({ width, form }: { width: number | 'none'; form?: 'numbers' | 'compact' }) {
  const box = width === 'none' ? { display: 'inline-block' } : { width };
  return (
    <div data-testid="region" style={box}>
      <Pagination
        page={3}
        pageSize={100}
        totalItems={1300}
        pageSizes={[25, 50, 100]}
        onPageSizeChange={() => undefined}
        onPageChange={() => undefined}
        {...(form === undefined ? {} : { form })}
      />
    </div>
  );
}

const region = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('[data-testid="region"]');
  if (el === null) throw new Error('no region');
  return el;
};
/** Visible elements only: a hidden form is display: none, so not in the accessibility tree. */
const shown = (el: Element) => (el as HTMLElement).offsetParent !== null;
const isCompact = () =>
  [...document.querySelectorAll('li')].some(
    (li) => shown(li) && li.textContent.trim() === 'الصفحة 3 من 13',
  );
const pageButtons = () =>
  [...document.querySelectorAll<HTMLElement>('nav button')].filter(
    (b) => shown(b) && /^الصفحة \d+$/.test(b.getAttribute('aria-label') ?? ''),
  );

/** Every shown button and the select lie inside the region's box (1 px for rounding). */
function expectInside() {
  const box = region().getBoundingClientRect();
  const controls = [...document.querySelectorAll<HTMLElement>('button, [role="combobox"]')].filter(
    shown,
  );
  expect(controls.length).toBeGreaterThan(2);
  for (const c of controls) {
    const r = c.getBoundingClientRect();
    const name = c.getAttribute('aria-label') ?? c.textContent;
    expect(r.left, `${name} left`).toBeGreaterThanOrEqual(box.left - 1);
    expect(r.right, `${name} right`).toBeLessThanOrEqual(box.right + 1);
  }
}

async function at(width: number | 'none', options: Region & { form?: 'numbers' | 'compact' }) {
  const { form, ...rest } = options;
  return renderDir(<Sized width={width} {...(form === undefined ? {} : { form })} />, rest);
}

describe.each(DIRS)('Pagination at narrow widths in %s', (dir) => {
  it.each([320, 429])('at %i px the compact form shows, every button inside', async (width) => {
    const screen = await at(width, { dir });
    expect(isCompact()).toBe(true);
    expect(pageButtons()).toHaveLength(0);
    // One form in the accessibility tree: the hidden page numbers are display: none.
    expect(screen.getByRole('button', { name: 'الصفحة 4' }).query()).toBeNull();
    expectInside();
    await screen.unmount();
  });

  it.each([430, 600])('at %i px the page numbers show', async (width) => {
    const screen = await at(width, { dir });
    expect(isCompact()).toBe(false);
    expect(pageButtons().length).toBeGreaterThan(3);
    expect(screen.getByRole('button', { name: 'الصفحة 4' }).element()).toBeTruthy();
    expectInside();
    await screen.unmount();
  });

  it('in the compact form the summary is on its own line, under the arrows', async () => {
    const screen = await at(320, { dir });
    const summary = screen.getByText('عرض 201–300 من 1,300').element();
    const nav = screen.getByRole('navigation').element();
    expect(summary.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      nav.getBoundingClientRect().bottom - 1,
    );
    await screen.unmount();
  });

  it('at 320 px with the root font doubled every button stays inside', async () => {
    const root = document.documentElement;
    const before = root.style.fontSize;
    root.style.fontSize = '200%';
    try {
      const screen = await at(320, { dir });
      expect(isCompact()).toBe(true);
      expectInside();
      await screen.unmount();
    } finally {
      root.style.fontSize = before;
    }
  });

  it('a container with no size gets the compact form', async () => {
    const screen = await at('none', { dir });
    expect(isCompact()).toBe(true);
    expect(pageButtons()).toHaveLength(0);
    await screen.unmount();
  });

  it('form="numbers" and form="compact" still force one form', async () => {
    let screen = await at(320, { dir, form: 'numbers' });
    expect(isCompact()).toBe(false);
    expect(pageButtons().length).toBeGreaterThan(3);
    await screen.unmount();
    screen = await at(600, { dir, form: 'compact' });
    expect(isCompact()).toBe(true);
    expect(pageButtons()).toHaveLength(0);
    await screen.unmount();
  });

  it.each([
    ['comfortable', 88],
    ['compact', 76],
  ] as const)(
    'in %s density the rows-per-page Select is %i px and shows «100»',
    async (density, min) => {
      const screen = await at(600, { dir, density });
      const select = screen
        .getByRole('combobox', { name: 'صفوف في الصفحة' })
        .element() as HTMLElement;
      expect(select.getBoundingClientRect().width).toBeGreaterThanOrEqual(min);
      const value = [...select.querySelectorAll<HTMLElement>('span, div')].find(
        (el) => el.children.length === 0 && el.textContent.trim() === '100',
      );
      expect(value, 'the value is written').toBeDefined();
      if (value === undefined) return;
      expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth);
      const v = value.getBoundingClientRect();
      const s = select.getBoundingClientRect();
      expect(v.left).toBeGreaterThanOrEqual(s.left);
      expect(v.right).toBeLessThanOrEqual(s.right);
      // The chevron is drawn beside the value, inside the box.
      const chevron = select.querySelector('svg');
      expect(chevron).not.toBeNull();
      const c = (chevron as SVGElement).getBoundingClientRect();
      expect(c.left).toBeGreaterThanOrEqual(s.left);
      expect(c.right).toBeLessThanOrEqual(s.right);
      expect(c.right <= v.left || c.left >= v.right).toBe(true);
      await screen.unmount();
    },
  );
});

describe('the Zoom200 story (criterion 13)', () => {
  // The story's own render, outside the eight-cell matrix: one region per direction.
  const Zoom200 = () => (stories.Zoom200.render as unknown as () => ReactElement)();

  it('in English LTR shows English copy', async () => {
    const screen = await renderDir(<Zoom200 />, { dir: 'ltr' });
    const text = document.body.textContent;
    expect(text).toMatch(/Page 248 of 494/);
    expect(text).not.toMatch(/[؀-ۿ]/);
    expect(screen.getByRole('button', { name: 'Next page' }).element()).toBeTruthy();
    await screen.unmount();
  });

  it('in Arabic RTL keeps the Arabic copy', async () => {
    const screen = await renderDir(<Zoom200 />, { dir: 'rtl' });
    expect(document.body.textContent).toMatch(/الصفحة 248 من 494/);
    await screen.unmount();
  });
});
