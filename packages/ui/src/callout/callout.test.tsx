// Callout (slice A-01-07), as the owner approved the sheet on 2026-11-24 ("Shifa Screens · Clinic
// web", page "A-01-07 Sign-in batch", `CalloutSheet`): a message that stays on the page while its
// cause holds. Four tones in the locked status colours, each with its icon (replaceable), an
// optional title, the text and at most one action at the end of the line; no close button.
// warning and danger are announced as an alert, info and success as a status.
import { describe, expect, it } from 'vitest';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { Button } from '../button/button.tsx';
import { Callout, type CalloutTone } from './callout.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const TONES: CalloutTone[] = ['info', 'success', 'warning', 'danger'];

function box(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[data-slot="callout"]');
  if (el === null) throw new Error('no callout');
  return el;
}

describe.each(DIRS)('Callout in %s', (dir) => {
  it.each([
    ['info', 'status'],
    ['success', 'status'],
    ['warning', 'alert'],
    ['danger', 'alert'],
  ] as const)('%s is announced as %s', async (tone, role) => {
    const screen = await renderDir(
      <Callout tone={tone} title="خرجت تلقائياً">
        ادخل من جديد لتتابع.
      </Callout>,
      { dir },
    );
    const el = screen.getByRole(role).element();
    expect(el.textContent).toContain('خرجت تلقائياً');
    expect(el.textContent).toContain('ادخل من جديد لتتابع.');
    await screen.unmount();
  });

  it('info is the default tone', async () => {
    const screen = await renderDir(<Callout>نص فقط.</Callout>, { dir });
    expect(box().dataset['tone']).toBe('info');
    expect(screen.getByRole('status').element()).toBeTruthy();
    await screen.unmount();
  });

  it.each(TONES)('%s takes the locked status colours', async (tone) => {
    const screen = await renderDir(<Callout tone={tone}>نص.</Callout>, { dir });
    const el = box();
    const style = getComputedStyle(el);
    expect(style.backgroundColor).toBe(tokenColor(`--shifa-color-status-${tone}-bg`, el));
    expect(style.borderTopColor).toBe(tokenColor(`--shifa-color-status-${tone}-border`, el));
    expect(style.color).toBe(tokenColor('--shifa-color-text-default', el));
    const icon = el.querySelector('svg');
    expect(icon).not.toBeNull();
    if (icon) {
      expect(getComputedStyle(icon).color).toBe(tokenColor(`--shifa-color-status-${tone}-fg`, el));
    }
    await screen.unmount();
  });

  it('the icon is decoration, hidden from screen readers; the caller may replace it', async () => {
    const screen = await renderDir(
      <Callout tone="warning" icon="clock" title="توقّف الدخول بهذا الرقم مؤقتاً">
        يمكنك المحاولة بعد 14:59.
      </Callout>,
      { dir },
    );
    const icon = box().querySelector('svg');
    expect(icon?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(box().querySelector('[data-shifa-icon="clock"]')).not.toBeNull();
    await screen.unmount();
  });

  it('each tone has its own icon by default', async () => {
    const names: string[] = [];
    for (const tone of TONES) {
      const screen = await renderDir(<Callout tone={tone}>نص.</Callout>, { dir });
      names.push(box().querySelector('[data-shifa-icon]')?.getAttribute('data-shifa-icon') ?? '');
      await screen.unmount();
    }
    expect(names).toEqual(['info', 'check-circle', 'warning', 'x-circle']);
  });

  it('without a title only the text shows', async () => {
    const screen = await renderDir(<Callout>نص طويل يلتف.</Callout>, { dir });
    expect(box().querySelector('[data-slot="callout-title"]')).toBeNull();
    expect(box().textContent).toBe('نص طويل يلتف.');
    await screen.unmount();
  });

  it('one action sits at the end of the line, after the text', async () => {
    const screen = await renderDir(
      <Callout
        tone="danger"
        icon="wifi-slash"
        title="تعذّر الوصول إلى الخادم"
        action={<Button size="sm">إعادة المحاولة</Button>}
      >
        تأكد من الاتصال بالإنترنت.
      </Callout>,
      { dir },
    );
    const button = screen.getByRole('button', { name: 'إعادة المحاولة' }).element();
    const text = screen.getByText('تأكد من الاتصال بالإنترنت.').element();
    const b = button.getBoundingClientRect();
    const t = text.getBoundingClientRect();
    if (dir === 'rtl') expect(b.right).toBeLessThanOrEqual(t.left + 1);
    else expect(b.left).toBeGreaterThanOrEqual(t.right - 1);
    // No close button: the message goes when its cause does.
    expect(box().querySelectorAll('button')).toHaveLength(1);
    await screen.unmount();
  });

  it('the icon sits at the start of the line', async () => {
    const screen = await renderDir(<Callout title="عنوان">نص.</Callout>, { dir });
    const icon = box().querySelector('svg')?.getBoundingClientRect();
    const title = screen.getByText('عنوان').element().getBoundingClientRect();
    expect(icon).toBeDefined();
    if (icon) {
      if (dir === 'rtl') expect(icon.left).toBeGreaterThanOrEqual(title.right - 1);
      else expect(icon.right).toBeLessThanOrEqual(title.left + 1);
    }
    await screen.unmount();
  });

  it('the compact density is tighter than the comfortable one', async () => {
    const roomy = await renderDir(<Callout>نص.</Callout>, { dir });
    const a = Number.parseFloat(getComputedStyle(box()).paddingInlineStart);
    await roomy.unmount();
    const tight = await renderDir(<Callout>نص.</Callout>, { dir, density: 'compact' });
    const b = Number.parseFloat(getComputedStyle(box()).paddingInlineStart);
    await tight.unmount();
    expect(b).toBeLessThan(a);
  });

  it.each(['light', 'dark'] as const)('is axe-clean in %s with every tone', async (theme) => {
    const screen = await renderDir(
      <div className="flex flex-col gap-4">
        {TONES.map((tone) => (
          <Callout
            key={tone}
            tone={tone}
            title="عنوان الرسالة"
            action={tone === 'danger' ? <Button size="sm">إعادة المحاولة</Button> : undefined}
          >
            نص الرسالة بجملة أو جملتين.
          </Callout>
        ))}
      </div>,
      { dir, theme },
    );
    await expectAxeClean(document.body);
    await screen.unmount();
  });
});
