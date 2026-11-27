// PageBanner (A-02-01, sheet A02cSheetPageBanner approved by the owner 2026-11-27): a strip the
// width of the page above the top bar. Info and warning in their locked status colours, support
// solid; always an icon and a word (never colour alone), the text, at most one action, a pager
// «1 من 3» with previous and next for several announcements, a named close button only where it
// can be hidden. A region named by its word; its text is read when it changes. On a phone the text
// takes a whole line and the buttons go under it.
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { Button } from '../button/button.tsx';
import { PageBanner } from './page-banner.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const TEXTS = [
  'صيانة الليلة من 11 إلى 12. احفظوا عملكم قبلها.',
  'صار بإمكانكم إضافة مدينة الفرع وحيّه من إعدادات الفروع.',
  'تدريب على جدول المواعيد الجديد يوم السبت 10:00 عبر الهاتف.',
];
const banner = (name: string) => document.querySelector(`[role="region"][aria-label="${name}"]`);

function Announcements({ onDismiss }: { onDismiss?: () => void }) {
  const [index, setIndex] = useState(0);
  return (
    <PageBanner
      tone="info"
      title="معلومة:"
      pager={{ index, count: TEXTS.length, onIndexChange: setIndex }}
      {...(onDismiss === undefined ? {} : { onDismiss })}
    >
      {TEXTS[index]}
    </PageBanner>
  );
}

describe.each(DIRS)('PageBanner in %s', (dir) => {
  const previous = dir === 'rtl' ? 'الإعلان السابق' : 'Previous announcement';
  const next = dir === 'rtl' ? 'الإعلان التالي' : 'Next announcement';
  const hide = dir === 'rtl' ? 'إخفاء الإعلان' : 'Hide the announcement';

  it('is a region named by its word, with an icon, the word and the text', async () => {
    const screen = await renderDir(
      <PageBanner tone="warning" title="تنبيه:">
        {TEXTS[0]}
      </PageBanner>,
      { dir },
    );
    const region = screen.getByRole('region', { name: 'تنبيه:' }).element();
    expect(region.textContent).toContain('تنبيه:');
    expect(region.textContent).toContain(TEXTS[0]);
    expect(region.querySelector('svg[data-shifa-icon="warning"]')).not.toBeNull();
    expect(region.querySelector('[aria-live="polite"]')?.textContent).toContain(TEXTS[0]);
    expect(screen.container.querySelector('button')).toBeNull();
    await screen.unmount();
  });

  it('colours: info and warning in their status colours, support solid', async () => {
    const screen = await renderDir(
      <>
        <PageBanner tone="support" title="دخول الدعم · للقراءة فقط">
          {TEXTS[1]}
        </PageBanner>
        <PageBanner tone="info" title="معلومة:">
          {TEXTS[1]}
        </PageBanner>
        <PageBanner tone="warning" title="تنبيه:">
          {TEXTS[0]}
        </PageBanner>
      </>,
      { dir },
    );
    const check = (name: string, bg: `--shifa-${string}`, fg: `--shifa-${string}`) => {
      const el = banner(name);
      if (el === null) throw new Error(name);
      const box = el.querySelector('[data-slot="page-banner-box"]') ?? el;
      expect(getComputedStyle(box).backgroundColor).toBe(tokenColor(bg, el));
      expect(getComputedStyle(box).color).toBe(tokenColor(fg, el));
    };
    check(
      'دخول الدعم · للقراءة فقط',
      '--shifa-color-status-info-solid',
      '--shifa-color-status-info-on-solid',
    );
    check('معلومة:', '--shifa-color-status-info-bg', '--shifa-color-status-info-fg');
    check('تنبيه:', '--shifa-color-status-warning-bg', '--shifa-color-status-warning-fg');
    expect(
      banner('دخول الدعم · للقراءة فقط')?.querySelector('svg[data-shifa-icon="eye"]'),
    ).not.toBeNull();
    await screen.unmount();
  });

  it('pages through several: «1 من 3», previous and next, the ends disabled', async () => {
    const screen = await renderDir(<Announcements />, { dir });
    const counter = () => document.querySelector('[data-slot="page-banner-pager"]')?.textContent;
    expect(counter()).toContain(dir === 'rtl' ? '1 من 3' : '1 of 3');
    const prev = screen.getByRole('button', { name: previous });
    expect(
      prev.element().getAttribute('aria-disabled') ??
        String((prev.element() as HTMLButtonElement).disabled),
    ).toBe('true');
    await screen.getByRole('button', { name: next }).click();
    expect(counter()).toContain(dir === 'rtl' ? '2 من 3' : '2 of 3');
    expect(banner('معلومة:')?.textContent).toContain(TEXTS[1]);
    await screen.getByRole('button', { name: next }).click();
    const nextButton = screen.getByRole('button', { name: next }).element();
    expect(
      nextButton.getAttribute('aria-disabled') ??
        String((nextButton as HTMLButtonElement).disabled),
    ).toBe('true');
    await screen.getByRole('button', { name: previous }).click();
    expect(counter()).toContain(dir === 'rtl' ? '2 من 3' : '2 of 3');
    await screen.unmount();
  });

  it('a close button named for what it hides, only when it can be hidden', async () => {
    const onDismiss = vi.fn();
    const screen = await renderDir(<Announcements onDismiss={onDismiss} />, { dir });
    await screen.getByRole('button', { name: hide }).click();
    expect(onDismiss).toHaveBeenCalledOnce();
    await screen.unmount();
  });

  it('holds one action at the end of its row', async () => {
    const onClick = vi.fn();
    const screen = await renderDir(
      <PageBanner
        tone="warning"
        icon="eye"
        title="فريق شفاء يقرأ عيادتك الآن، للقراءة فقط."
        action={
          <Button size="sm" onClick={onClick}>
            إنهاء الدخول
          </Button>
        }
      >
        السبب: مشكلة في الفروع · حتى 14:12
      </PageBanner>,
      { dir },
    );
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe('إنهاء الدخول');
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
    await screen.unmount();
  });

  it('on a phone the text takes the line and the buttons go under it; wide, one row', async () => {
    for (const [width, under] of [
      [390, true],
      [1000, false],
    ] as const) {
      const screen = await renderDir(
        <div style={{ width }}>
          <Announcements onDismiss={() => undefined} />
        </div>,
        { dir },
      );
      const text = document.querySelector('[aria-live="polite"]')?.getBoundingClientRect();
      const close = screen.getByRole('button', { name: hide }).element().getBoundingClientRect();
      expect(close.top >= (text?.bottom ?? 0) - 1, `${String(width)} px`).toBe(under);
      await screen.unmount();
    }
  });

  it.each(['light', 'dark'] as const)('is axe clean in %s', async (theme) => {
    const screen = await renderDir(
      <>
        <PageBanner
          tone="support"
          title="دخول الدعم · للقراءة فقط"
          action={<Button size="sm">إنهاء</Button>}
        >
          {TEXTS[1]}
        </PageBanner>
        <Announcements onDismiss={() => undefined} />
        <PageBanner
          tone="warning"
          title="تنبيه:"
          onDismiss={() => undefined}
          dismissLabel="إخفاء التنبيه"
        >
          {TEXTS[0]}
        </PageBanner>
      </>,
      { dir, theme },
    );
    await expectAxeClean(screen.container);
    await screen.unmount();
  });
});
