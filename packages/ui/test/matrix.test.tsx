// Spec 0.4 criterion 9 (slice 0.4-03): every story renders in the eight combinations of
// direction × theme × density, each region carrying the right attributes.
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { MATRIX, Matrix } from '../.storybook/matrix.tsx';

const combo = (dir: string, theme: string, density: string) => `${dir} ${theme} ${density}`;

describe('the story matrix', () => {
  it('lists the eight combinations once each', () => {
    expect(MATRIX).toHaveLength(8);
    const all = MATRIX.map((m) => combo(m.dir, m.theme, m.density));
    expect(new Set(all).size).toBe(8);
    for (const dir of ['rtl', 'ltr']) {
      for (const theme of ['light', 'dark']) {
        for (const density of ['comfortable', 'compact']) {
          expect(all).toContain(combo(dir, theme, density));
        }
      }
    }
  });

  it('renders the story once per combination with dir, data-theme and data-density', async () => {
    const screen = await render(<Matrix>{() => <span data-probe="">نص</span>}</Matrix>);
    const cells = [...screen.container.querySelectorAll<HTMLElement>('[data-matrix-cell]')];
    expect(cells).toHaveLength(8);
    const seen = cells.map((cell) => {
      const probe = cell.querySelector('[data-probe]');
      expect(probe, 'the story renders inside every cell').not.toBeNull();
      const dir = probe?.closest('[dir]')?.getAttribute('dir');
      const theme = probe?.closest('[data-theme]')?.getAttribute('data-theme');
      const density = probe?.closest('[data-density]')?.getAttribute('data-density');
      expect(cell.getAttribute('data-matrix-cell')).toBe(
        combo(dir ?? '', theme ?? '', density ?? ''),
      );
      return combo(dir ?? '', theme ?? '', density ?? '');
    });
    expect(new Set(seen).size).toBe(8);
  });

  it('puts the language with the direction and names each cell', async () => {
    const screen = await render(<Matrix>{() => <span data-probe="">x</span>}</Matrix>);
    const cells = [...screen.container.querySelectorAll<HTMLElement>('[data-matrix-cell]')];
    for (const cell of cells) {
      const probe = cell.querySelector('[data-probe]');
      const region = probe?.closest('[dir]');
      expect(region?.getAttribute('lang')).toBe(
        region?.getAttribute('dir') === 'rtl' ? 'ar' : 'en',
      );
      expect(cell.textContent).toMatch(/RTL|LTR/);
    }
  });

  it('applies the dark tokens inside a dark cell', async () => {
    const screen = await render(<Matrix>{() => <span data-probe="">x</span>}</Matrix>);
    const surface = (theme: string) => {
      const cell = screen.container.querySelector(`[data-matrix-cell="rtl ${theme} comfortable"]`);
      const region = cell?.querySelector('[data-theme]');
      if (!region) throw new Error(`no ${theme} region`);
      return getComputedStyle(region).getPropertyValue('--shifa-color-bg-surface').trim();
    };
    expect(surface('dark')).not.toBe(surface('light'));
  });
});
