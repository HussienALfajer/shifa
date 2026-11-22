// Badge and count badge (slice 0.4-07), as the owner approved the sheet on 2026-11-22 (OD-64).
// A badge is a small mark that is never pressed and never takes focus. Neutral, brand and outline
// follow the clinic's theme; status and queue badges use the locked colours and always carry an
// icon besides their word, so colour is never the only cue (principle 7). The count badge shows
// Western digits up to a cap (99+), nothing at 0, and is read by the caller's label.
import { describe, expect, it } from 'vitest';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { Badge, type BadgeTone, CountBadge } from './badge.tsx';

const DIRS = ['rtl', 'ltr'] as const;

/** The one element matching `selector`; fails the test when there is none. */
function one(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (el === null) throw new Error(`no ${selector}`);
  return el;
}
const STATUS_TONES: BadgeTone[] = [
  'success',
  'warning',
  'danger',
  'info',
  'queue-booked',
  'queue-confirmed',
  'queue-arrived',
  'queue-waiting',
  'queue-in-room',
  'queue-done',
  'queue-no-show',
  'queue-cancelled',
];

describe.each(DIRS)('Badge in %s', (dir) => {
  it('is plain text: no role, no Tab stop', async () => {
    const screen = await renderDir(<Badge>مسودة</Badge>, { dir });
    const badge = screen.getByText('مسودة').element();
    const host = badge.closest('[data-slot="badge"]');
    expect(host).not.toBeNull();
    expect(host?.getAttribute('role')).toBeNull();
    expect(host?.hasAttribute('tabindex')).toBe(false);
    await screen.unmount();
  });

  it.each(STATUS_TONES)('status tone %s carries an icon besides its word', async (tone) => {
    const screen = await renderDir(<Badge tone={tone}>الحالة</Badge>, { dir });
    const host = screen.getByText('الحالة').element().closest('[data-slot="badge"]');
    const icon = host?.querySelector('svg');
    expect(icon, 'an icon').not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    await screen.unmount();
  });

  it('a status badge cannot drop its icon', async () => {
    const screen = await renderDir(
      <Badge tone="danger" icon={false}>
        ملغاة
      </Badge>,
      { dir },
    );
    const host = screen.getByText('ملغاة').element().closest('[data-slot="badge"]');
    expect(host?.querySelector('svg')).not.toBeNull();
    await screen.unmount();
  });

  it('uses the locked status colours', async () => {
    const screen = await renderDir(<Badge tone="success">مدفوعة</Badge>, { dir });
    const host = screen.getByText('مدفوعة').element().closest('[data-slot="badge"]');
    if (host === null) throw new Error('no badge');
    const style = getComputedStyle(host);
    expect(style.backgroundColor).toBe(tokenColor('--shifa-color-status-success-bg', host));
    expect(style.color).toBe(tokenColor('--shifa-color-status-success-fg', host));
    await screen.unmount();
  });

  it('has two sizes, 24 and 28 px tall', async () => {
    const screen = await renderDir(
      <>
        <Badge size="sm">صغيرة</Badge>
        <Badge size="md">متوسطة</Badge>
      </>,
      { dir },
    );
    const h = (t: string) =>
      screen.getByText(t).element().closest('[data-slot="badge"]')?.getBoundingClientRect().height;
    expect(h('صغيرة')).toBe(24);
    expect(h('متوسطة')).toBe(28);
    await screen.unmount();
  });

  it('is clean under axe, every tone, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <div>
          <Badge>مسودة</Badge>
          <Badge tone="brand">أسنان</Badge>
          <Badge tone="outline">تأمين خاص</Badge>
          {STATUS_TONES.map((tone) => (
            <Badge key={tone} tone={tone}>
              حالة
            </Badge>
          ))}
          <CountBadge count={5} label="5 بالانتظار" />
          <CountBadge count={12} tone="danger" label="12 رسالة غير مقروءة" />
          <CountBadge count={3} tone="brand" label="3 جديدة" />
          <CountBadge dot label="إشعارات جديدة" />
        </div>,
        { dir, theme },
      );
      await expectAxeClean(document.body);
      await screen.unmount();
    }
  });
});

describe.each(DIRS)('Count badge in %s', (dir) => {
  it('shows the count in Western digits and is read by its label', async () => {
    const screen = await renderDir(<CountBadge count={12} label="12 رسالة غير مقروءة" />, {
      dir,
    });
    const host = one('[data-slot="count-badge"]');
    expect(host.innerText.replace(/\s/g, '')).toContain('12');
    expect(screen.getByText('12 رسالة غير مقروءة').element()).toBeTruthy();
    expect(host.querySelector('[aria-hidden="true"]')?.textContent).toBe('12');
    expect(getComputedStyle(host).fontVariantNumeric).toContain('tabular-nums');
    await screen.unmount();
  });

  it('caps at 99+ by default, and at a given cap', async () => {
    const screen = await renderDir(
      <>
        <CountBadge count={140} label="140" />
        <CountBadge count={12} max={9} label="12" />
      </>,
      { dir },
    );
    const shown = [...document.querySelectorAll('[data-slot="count-badge"] [aria-hidden="true"]')];
    expect(shown.map((s) => s.textContent)).toEqual(['99+', '9+']);
    await screen.unmount();
  });

  it('shows nothing at 0', async () => {
    const screen = await renderDir(<CountBadge count={0} label="لا رسائل" />, { dir });
    expect(document.querySelector('[data-slot="count-badge"]')).toBeNull();
    await screen.unmount();
  });

  it('a dot without a number is named by its label', async () => {
    const screen = await renderDir(<CountBadge dot label="إشعارات جديدة" />, { dir });
    expect(screen.getByRole('img', { name: 'إشعارات جديدة' }).element()).toBeTruthy();
    await screen.unmount();
  });
});
