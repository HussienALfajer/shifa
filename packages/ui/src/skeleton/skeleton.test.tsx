// Skeleton (slice 0.4-07), as the owner approved the sheet on 2026-11-22: blocks, text lines and a
// circle on the raised surface, for content whose shape is known. The pieces are hidden from
// assistive technology; the container carries the busy state and its name. A soft pulse that
// stops under reduced motion.
import { describe, expect, it } from 'vitest';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { Skeleton, SkeletonGroup, SkeletonText } from './skeleton.tsx';

const DIRS = ['rtl', 'ltr'] as const;

/** The one element matching `selector`; fails the test when there is none. */
function one(selector: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(selector);
  if (el === null) throw new Error(`no ${selector}`);
  return el;
}

function PatientCardLoading() {
  return (
    <SkeletonGroup label="جارٍ تحميل بطاقة المريض">
      <Skeleton shape="circle" className="size-10" />
      <SkeletonText lines={3} />
      <Skeleton className="h-20 w-full" />
    </SkeletonGroup>
  );
}

describe.each(DIRS)('Skeleton in %s', (dir) => {
  it('the group is busy and named; the pieces are hidden', async () => {
    const screen = await renderDir(<PatientCardLoading />, { dir });
    const group = screen.getByRole('status', { name: 'جارٍ تحميل بطاقة المريض' }).element();
    expect(group.getAttribute('aria-busy')).toBe('true');
    const pieces = [...group.querySelectorAll('[data-slot="skeleton"]')];
    expect(pieces.length).toBe(5);
    for (const piece of pieces) expect(piece.closest('[aria-hidden="true"]')).not.toBeNull();
    await screen.unmount();
  });

  it('draws lines with the last one shorter, on the raised surface', async () => {
    const screen = await renderDir(<SkeletonText lines={3} />, { dir });
    const lines = [...document.querySelectorAll('[data-slot="skeleton"]')];
    expect(lines).toHaveLength(3);
    const widths = lines.map((l) => l.getBoundingClientRect().width);
    expect(widths[2]).toBeLessThan(widths[0] ?? 0);
    const first = lines[0] as HTMLElement;
    expect(getComputedStyle(first).backgroundColor).toBe(
      tokenColor('--shifa-color-bg-surface-raised', first),
    );
    await screen.unmount();
  });

  it('a short line starts at the logical start', async () => {
    const screen = await renderDir(
      <div className="w-80">
        <SkeletonText lines={2} />
      </div>,
      { dir },
    );
    const [full, short] = [...document.querySelectorAll('[data-slot="skeleton"]')].map((l) =>
      l.getBoundingClientRect(),
    );
    if (full === undefined || short === undefined) throw new Error('two lines');
    if (dir === 'rtl') expect(short.right).toBe(full.right);
    else expect(short.left).toBe(full.left);
    await screen.unmount();
  });

  it('a circle is round', async () => {
    const screen = await renderDir(<Skeleton shape="circle" className="size-10" />, { dir });
    const circle = one('[data-slot="skeleton"]');
    expect(getComputedStyle(circle).borderRadius).toMatch(/^(50%|9999px|20px)$/);
    await screen.unmount();
  });

  it('pulses, and is still under reduced motion', async () => {
    const screen = await renderDir(<Skeleton className="h-4 w-20" />, { dir });
    const piece = one('[data-slot="skeleton"]');
    expect(getComputedStyle(piece).animationName).not.toBe('none');
    await screen.unmount();
    const still = await renderDir(
      <div data-motion="reduce">
        <Skeleton className="h-4 w-20" />
      </div>,
      { dir },
    );
    const quiet = one('[data-slot="skeleton"]');
    expect(getComputedStyle(quiet).animationName).toBe('none');
    await still.unmount();
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<PatientCardLoading />, { dir, theme });
      await expectAxeClean(document.body);
      await screen.unmount();
    }
  });
});
