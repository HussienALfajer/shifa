// QrCode (slice A-01-07), as the owner approved the sheet on 2026-11-24 (`QrCodeSheet`): the
// otpauth URI drawn in the page as a code a camera reads, light plate and dark modules in both
// themes, never mirrored, error correction M with a quiet zone of four modules; without a value
// the loading state at the same size.
import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import { expectAxeClean, renderDir, tokenColor } from '../../test/support/index.ts';
import { QrCode } from './qr-code.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const URI =
  'otpauth://totp/Shifa:%2B963930012345?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Shifa&algorithm=SHA1&digits=6&period=30';
const LABEL = 'رمز QR لإضافة حساب شفاء إلى تطبيق المصادقة';

function plate(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[data-slot="qr-code"]');
  if (el === null) throw new Error('no qr code');
  return el;
}

/** The dark modules the SVG draws, read back from its path. */
function drawnModules(): Set<string> {
  const d = plate().querySelector('path')?.getAttribute('d') ?? '';
  return new Set([...d.matchAll(/M(\d+) (\d+)/g)].map((m) => `${m[1] ?? ''},${m[2] ?? ''}`));
}

describe.each(DIRS)('QrCode in %s', (dir) => {
  it('draws exactly the modules of the URI at level M with a four-module quiet zone', async () => {
    const screen = await renderDir(<QrCode value={URI} label={LABEL} />, { dir });
    const expected = encode(URI, { ecc: 'M', border: 4 });
    const dark = new Set<string>();
    expected.data.forEach((row, y) => {
      row.forEach((on, x) => {
        if (on) dark.add(`${String(x)},${String(y)}`);
      });
    });
    expect(drawnModules()).toEqual(dark);
    expect(plate().querySelector('svg')?.getAttribute('viewBox')).toBe(
      `0 0 ${String(expected.size)} ${String(expected.size)}`,
    );
    // The quiet zone: no dark module in the four outer rows and columns.
    for (const key of drawnModules()) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      expect(Math.min(x, y)).toBeGreaterThanOrEqual(4);
      expect(Math.max(x, y)).toBeLessThan(expected.size - 4);
    }
    await screen.unmount();
  });

  it('is one image named by its label; the URI is never text on the page', async () => {
    const screen = await renderDir(<QrCode value={URI} label={LABEL} />, { dir });
    expect(screen.getByRole('img', { name: LABEL }).element()).toBe(plate());
    expect(document.body.textContent).not.toContain('JBSWY3DP');
    expect(document.body.innerHTML).not.toContain('otpauth');
    await screen.unmount();
  });

  it.each(['light', 'dark'] as const)(
    'keeps the light plate and dark modules in %s',
    async (theme) => {
      const screen = await renderDir(<QrCode value={URI} label={LABEL} />, { dir, theme });
      const el = plate();
      expect(getComputedStyle(el).backgroundColor).toBe(tokenColor('--shifa-color-scan-bg', el));
      const path = el.querySelector('path');
      expect(path).not.toBeNull();
      if (path) expect(getComputedStyle(path).fill).toBe(tokenColor('--shifa-color-scan-fg', el));
      expect(tokenColor('--shifa-color-scan-bg', el)).toBe('rgb(255, 255, 255)');
      await screen.unmount();
    },
  );

  it('is never mirrored: the same picture in both directions', async () => {
    const screen = await renderDir(<QrCode value={URI} label={LABEL} />, { dir });
    expect(plate().dir).toBe('ltr');
    expect(getComputedStyle(plate().querySelector('svg') as SVGElement).transform).toBe('none');
    await screen.unmount();
  });

  it('without a value shows a spinner at the code’s size, named by the label', async () => {
    const ready = await renderDir(<QrCode value={URI} label={LABEL} />, { dir });
    const size = plate().getBoundingClientRect();
    await ready.unmount();
    const screen = await renderDir(<QrCode label={LABEL} />, { dir });
    expect(plate().dataset['state']).toBe('loading');
    expect(screen.getByRole('status', { name: LABEL }).element()).toBeTruthy();
    const box = plate().getBoundingClientRect();
    expect(box.width).toBeCloseTo(size.width, 0);
    expect(box.height).toBeCloseTo(size.height, 0);
    expect(box.width).toBeCloseTo(150, 0);
    await screen.unmount();
  });

  it.each(['light', 'dark'] as const)('is axe-clean in %s, ready and loading', async (theme) => {
    const screen = await renderDir(
      <div className="flex gap-4">
        <QrCode value={URI} label={LABEL} />
        <QrCode label={LABEL} />
      </div>,
      { dir, theme },
    );
    await expectAxeClean(document.body);
    await screen.unmount();
  });
});
