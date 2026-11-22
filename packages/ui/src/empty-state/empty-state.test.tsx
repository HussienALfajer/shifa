// Empty state (slice 0.4-07), as the owner approved the sheet on 2026-11-22 (OD-64): says what is
// happening and the next step. A small line drawing (the jasmine or the eight-point star, with
// the gold dot) or an icon, a title, a description and up to two actions; two sizes, panel and
// page. The drawing is decoration; the text is the caller's, never built by the component.
import { describe, expect, it } from 'vitest';
import { expectAxeClean, renderDir } from '../../test/support/index.ts';
import { Button } from '../button/button.tsx';
import { EmptyState } from './empty-state.tsx';

const DIRS = ['rtl', 'ltr'] as const;

/** The one element matching `selector`; fails the test when there is none. */
function one(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (el === null) throw new Error(`no ${selector}`);
  return el;
}

function NoAppointments({ size }: { size?: 'panel' | 'page' }) {
  return (
    <EmptyState
      art="jasmine"
      title="لا مواعيد اليوم"
      description="لم يُحجز أي موعد ليوم الأحد 22/11/2026."
      actions={<Button variant="primary">موعد جديد</Button>}
      {...(size === undefined ? {} : { size })}
    />
  );
}

describe.each(DIRS)('Empty state in %s', (dir) => {
  it('a heading title, its description and its action; the drawing is hidden', async () => {
    const screen = await renderDir(<NoAppointments />, { dir });
    expect(screen.getByRole('heading', { name: 'لا مواعيد اليوم' }).element()).toBeTruthy();
    expect(screen.getByText('لم يُحجز أي موعد ليوم الأحد 22/11/2026.').element()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'موعد جديد' }).element()).toBeTruthy();
    const art = document.querySelector('[data-slot="empty-art"]');
    expect(art).not.toBeNull();
    expect(art?.closest('[aria-hidden="true"]')).not.toBeNull();
    await screen.unmount();
  });

  it('takes the heading level from the caller', async () => {
    const screen = await renderDir(
      <EmptyState icon="magnifying-glass" title="لا نتائج" headingLevel={2} />,
      { dir },
    );
    expect(screen.getByRole('heading', { level: 2, name: 'لا نتائج' }).element()).toBeTruthy();
    await screen.unmount();
  });

  it('an icon instead of a drawing, for search and errors', async () => {
    const screen = await renderDir(<EmptyState icon="warning" title="تعذّر تحميل الفواتير" />, {
      dir,
    });
    expect(document.querySelector('[data-slot="empty-art"]')).toBeNull();
    const icon = document.querySelector('[data-slot="empty-state"] svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    await screen.unmount();
  });

  it('the page size is larger than the panel size', async () => {
    const panel = await renderDir(<NoAppointments />, { dir });
    const small = one('[data-slot="empty-art"]').getBoundingClientRect().width;
    const smallTitle = Number.parseFloat(
      getComputedStyle(panel.getByRole('heading').element()).fontSize,
    );
    await panel.unmount();
    const page = await renderDir(<NoAppointments size="page" />, { dir });
    const big = one('[data-slot="empty-art"]').getBoundingClientRect().width;
    const bigTitle = Number.parseFloat(
      getComputedStyle(page.getByRole('heading').element()).fontSize,
    );
    expect(small).toBe(64);
    expect(big).toBe(96);
    expect(bigTitle).toBeGreaterThan(smallTitle);
    await page.unmount();
  });

  it('centres its content', async () => {
    const screen = await renderDir(<NoAppointments />, { dir });
    const host = one('[data-slot="empty-state"]');
    expect(getComputedStyle(host).textAlign).toBe('center');
    await screen.unmount();
  });

  it('is clean under axe, both sizes, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <>
          <NoAppointments />
          <EmptyState
            art="star"
            size="page"
            title="لا مرضى بعد"
            description="أضف أول مريض أو استورد قائمة المرضى من ملف."
            actions={
              <>
                <Button variant="primary">إضافة مريض</Button>
                <Button>استيراد</Button>
              </>
            }
          />
        </>,
        { dir, theme },
      );
      await expectAxeClean(document.body);
      await screen.unmount();
    }
  });
});
