// Toast (slice 0.4-06) in Arabic RTL and English LTR, as the owner approved the sheet on
// 2026-11-22 with OD-63: one region per app (ToastProvider) at the bottom, at the logical end
// (the bottom left in Arabic), three toasts at most with the newest at the bottom and the rest
// queued. Announced politely, errors assertively; timers pause while the pointer or focus is on
// the toasts. A status toast carries an icon and words, never colour alone. Messages are the
// caller's text. No motion under reduced motion.
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir } from '../../test/support/index.ts';
import { type ToastOptions, ToastProvider, useToast } from './toast.tsx';

const DIRS = ['rtl', 'ltr'] as const;

/** A page with a button that shows `options` (or each of `many`) as a toast. */
function Page({ options, many }: { options?: ToastOptions; many?: ToastOptions[] }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        for (const o of many ?? (options === undefined ? [] : [options])) toast.show(o);
      }}
    >
      إظهار
    </button>
  );
}

async function show(dir: 'rtl' | 'ltr', props: Parameters<typeof Page>[0], motion?: 'reduce') {
  const page = (
    <ToastProvider>
      <Page {...props} />
    </ToastProvider>
  );
  const screen = await renderDir(
    motion === undefined ? page : <div data-motion="reduce">{page}</div>,
    {
      dir,
    },
  );
  await userEvent.click(screen.getByRole('button', { name: 'إظهار' }));
  return screen;
}

const toasts = () => [...document.querySelectorAll<HTMLElement>('[data-slot="toast"]')];
const visible = () => toasts().filter((t) => !t.hasAttribute('data-ending-style'));
const poll = (fn: () => unknown, message: string, timeout = 2000) =>
  expect.poll(fn, { timeout, message });
const liveText = (politeness: 'polite' | 'assertive') =>
  [...document.querySelectorAll(`[aria-live="${politeness}"]`)]
    .map((el) => el.textContent)
    .join(' ');

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
});

describe.each(DIRS)('Toast in %s', (dir) => {
  it('shows a success toast with an icon and its words, in a named region', async () => {
    const screen = await show(dir, {
      options: { type: 'success', title: 'حُفظت الوصفة', description: 'ثلاثة أدوية' },
    });
    unmount = () => screen.unmount();
    await poll(() => visible().length, 'one toast').toBe(1);
    const toast = visible()[0];
    expect(toast?.textContent).toContain('حُفظت الوصفة');
    expect(toast?.textContent).toContain('ثلاثة أدوية');
    expect(toast?.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('region', { name: 'الإشعارات' }).element()).toBeTruthy();
  });

  it('announces politely, and an error assertively', async () => {
    const screen = await show(dir, {
      many: [
        { type: 'success', title: 'سُجّل الوصول' },
        { type: 'error', title: 'تعذّر حفظ الفاتورة' },
      ],
    });
    unmount = () => screen.unmount();
    await poll(() => liveText('polite').includes('سُجّل الوصول'), 'polite', 4000).toBe(true);
    await poll(() => liveText('assertive').includes('تعذّر حفظ الفاتورة'), 'assertive', 4000).toBe(
      true,
    );
  });

  it('sits at the bottom, at the logical end, the newest at the bottom', async () => {
    const screen = await show(dir, {
      many: [
        { title: 'الأول', duration: Infinity },
        { title: 'الثاني', duration: Infinity },
      ],
    });
    unmount = () => screen.unmount();
    await poll(() => visible().length, 'two toasts').toBe(2);
    const [first, second] = ['الأول', 'الثاني'].map((t) =>
      visible()
        .find((el) => el.textContent.includes(t))
        ?.getBoundingClientRect(),
    );
    if (first === undefined || second === undefined) throw new Error('toasts missing');
    expect(second.top).toBeGreaterThan(first.top);
    expect(window.innerHeight - second.bottom).toBeLessThanOrEqual(32);
    if (dir === 'rtl') expect(second.left).toBeLessThanOrEqual(32);
    else expect(window.innerWidth - second.right).toBeLessThanOrEqual(32);
  });

  it('shows three at most and queues the fourth until there is room', async () => {
    const screen = await show(dir, {
      many: ['١', '٢', '٣', '٤'].map((n) => ({ title: `إشعار ${n}`, duration: Infinity })),
    });
    unmount = () => screen.unmount();
    await poll(() => visible().length, 'three shown').toBe(3);
    expect(visible().some((t) => t.textContent.includes('إشعار ١'))).toBe(false);
    const close = visible()[0]?.querySelector<HTMLElement>('[data-slot="toast-close"]');
    close?.click();
    await poll(() => visible().some((t) => t.textContent.includes('إشعار ١')), 'fourth shown').toBe(
      true,
    );
  });

  it('pauses its timer while hovered and while focused', async () => {
    const screen = await show(dir, { options: { title: 'نُسخ الرابط', duration: 800 } });
    unmount = () => screen.unmount();
    await poll(() => visible().length, 'shown').toBe(1);
    const toast = visible()[0];
    if (toast === undefined) throw new Error('no toast');
    await userEvent.hover(toast);
    await new Promise((resolve) => setTimeout(resolve, 1300));
    expect(visible().length).toBe(1);
    const close = toast.querySelector<HTMLElement>('[data-slot="toast-close"]');
    close?.focus();
    await userEvent.unhover(toast);
    await new Promise((resolve) => setTimeout(resolve, 1300));
    expect(visible().length).toBe(1);
    (document.activeElement as HTMLElement | null)?.blur();
    await poll(() => visible().length, 'gone once nothing holds it', 3000).toBe(0);
  });

  it('runs its action and names its close button', async () => {
    let undone = false;
    const screen = await show(dir, {
      options: {
        type: 'info',
        title: 'نُقل الموعد إلى الخميس',
        duration: Infinity,
        action: {
          label: 'تراجع',
          onAction: () => {
            undone = true;
          },
        },
      },
    });
    unmount = () => screen.unmount();
    await poll(() => visible().length, 'shown').toBe(1);
    expect(screen.getByRole('button', { name: 'إغلاق الإشعار' }).element()).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'تراجع' }));
    expect(undone).toBe(true);
  });

  it('does not move under reduced motion', async () => {
    const screen = await show(
      dir,
      { options: { title: 'نُسخ الرابط', duration: Infinity } },
      'reduce',
    );
    unmount = () => screen.unmount();
    await poll(() => visible().length, 'shown').toBe(1);
    const toast = visible()[0];
    if (toast === undefined) throw new Error('no toast');
    expect(getComputedStyle(toast).transitionProperty).toBe('opacity');
  });

  it('is clean under axe with every status, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <ToastProvider>
          <Page
            many={(['success', 'info', 'warning'] as const).map((type) => ({
              type,
              title: `إشعار ${type}`,
              duration: Infinity,
            }))}
          />
        </ToastProvider>,
        { dir, theme },
      );
      await userEvent.click(screen.getByRole('button', { name: 'إظهار' }));
      await poll(() => visible().length, 'three shown').toBe(3);
      await expectAxeClean(document.body);
      await screen.unmount();
    }
  });
});
