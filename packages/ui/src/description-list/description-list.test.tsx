// DescriptionList (A-03-01, sheet A03SheetDescriptionList approved by the owner 2026-11-27): labels
// and their values by section. A real dl/dt/dd per section under an h3; an empty value shows «—»
// muted and is read «فارغ»; one badge per value, read after it; latin values isolated left to
// right; one column, or two when there is room; loading. Nothing in it is pressed.
import { describe, expect, it } from 'vitest';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { DescriptionList, type DescriptionListSection } from './description-list.tsx';

const DIRS = ['rtl', 'ltr'] as const;

/** `value`, or a failed test when it is missing. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing: ${what}`);
  return value;
}

const SECTIONS: DescriptionListSection[] = [
  { id: 'ref', title: 'الإحالة', rows: [{ id: 'r1', label: 'جهة الإحالة', value: 'طبيب آخر' }] },
  {
    id: 'ins',
    title: 'التأمين',
    rows: [
      { id: 'i1', label: 'شركة التأمين', value: 'تأمين الشمال' },
      { id: 'i2', label: 'رقم بطاقة التأمين', value: '40017733', kind: 'latin' },
    ],
  },
  {
    id: 'w',
    title: 'الإعفاء',
    rows: [
      {
        id: 'w1',
        label: 'سبب الإعفاء من الرسوم',
        value: 'حالة اجتماعية',
        badge: { label: 'حساس', tone: 'warning', icon: 'eye' },
      },
      { id: 'w2', label: 'أفضل وقت للاتصال', value: '' },
    ],
  },
];

describe.each(DIRS)('DescriptionList in %s', (dir) => {
  it('sections are h3 over a dl of dt and dd pairs, in a named group', async () => {
    const screen = await renderDir(
      <DescriptionList aria-label="حقول العيادة" sections={SECTIONS} />,
      { dir },
    );
    const group = screen.getByRole('group', { name: 'حقول العيادة' }).element();
    expect([...group.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'الإحالة',
      'التأمين',
      'الإعفاء',
    ]);
    expect(group.querySelectorAll('dl')).toHaveLength(3);
    expect(group.querySelectorAll('dt')).toHaveLength(5);
    expect(group.querySelectorAll('dd')).toHaveLength(5);
    expect(group.querySelector('button, a, input')).toBeNull();
    await screen.unmount();
  });

  it('an empty value shows «—» muted and is read «فارغ»', async () => {
    const screen = await renderDir(<DescriptionList aria-label="حقول" sections={SECTIONS} />, {
      dir,
    });
    const dd = must([...document.querySelectorAll('dd')].at(-1), 'last value');
    const shown = dd.querySelector('[aria-hidden="true"]');
    expect(shown?.textContent).toBe('—');
    expect(dd.querySelector('.sr-only')?.textContent).toBe(dir === 'rtl' ? 'فارغ' : 'Empty');
    expect(getComputedStyle(dd).color).toBe(tokenColor('--shifa-color-text-muted', dd));
    await screen.unmount();
  });

  it('a badge is read after its value; latin values are isolated', async () => {
    const screen = await renderDir(<DescriptionList aria-label="حقول" sections={SECTIONS} />, {
      dir,
    });
    const dds = [...document.querySelectorAll('dd')];
    const sensitive = dds[3]?.textContent ?? '';
    expect(sensitive.indexOf('حالة اجتماعية')).toBeLessThan(sensitive.indexOf('حساس'));
    const card = must(dds[2]?.querySelector('bdi, [data-kind="latin"]'), 'latin value');
    expect(getComputedStyle(card).direction).toBe('ltr');
    await screen.unmount();
  });

  it('two columns when there is room, one when narrow; sections without titles', async () => {
    for (const [width, cols] of [
      [1000, 2],
      [358, 1],
    ] as const) {
      const screen = await renderDir(
        <div style={{ width }}>
          <DescriptionList aria-label="حقول" sections={SECTIONS} columns={2} />
        </div>,
        { dir },
      );
      const tops = [...document.querySelectorAll('section')].map((s) =>
        Math.round(s.getBoundingClientRect().top),
      );
      expect(new Set(tops.slice(0, 2)).size, `${String(width)} px`).toBe(cols === 2 ? 1 : 2);
      await screen.unmount();
    }
    const flat = await renderDir(
      <DescriptionList
        aria-label="حقول"
        sections={[{ id: 'f', rows: [{ id: 'a', label: 'جهة الإحالة', value: 'طبيب آخر' }] }]}
      />,
      { dir },
    );
    expect(document.querySelector('h3')).toBeNull();
    await flat.unmount();
  });

  it('loading: busy, a named skeleton, no rows', async () => {
    const screen = await renderDir(
      <DescriptionList aria-label="حقول" sections={SECTIONS} loading loadingLabel="جارٍ التحميل" />,
      { dir },
    );
    const group = screen.getByRole('group', { name: 'حقول' }).element();
    expect(group.getAttribute('aria-busy')).toBe('true');
    expect(group.querySelector('dl')).toBeNull();
    expect(group.textContent).toContain('جارٍ التحميل');
    await screen.unmount();
  });

  it.each(['light', 'dark'] as const)('is axe clean in %s', async (theme) => {
    const screen = await renderDir(
      <DescriptionList aria-label="حقول" sections={SECTIONS} columns={2} />,
      {
        dir,
        theme,
      },
    );
    await expectAxeClean(screen.container);
    await screen.unmount();
  });
});
