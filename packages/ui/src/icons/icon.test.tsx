// Slices 0.4-03 and 0.4-09 (OD-65): one Icon component over a curated list of Tabler Icons,
// outline with no second tone, the stroke in the text colour; icons that point a direction
// mirror under dir="rtl" and no other icon does.
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { DirectionProvider } from '../index.ts';
import {
  DIRECTIONAL_ICONS,
  HEALTH_ICONS,
  ICON_NAMES,
  Icon,
  type IconName,
  iconSource,
} from './icon.tsx';

const svgOf = (container: HTMLElement) => {
  const svg = container.querySelector('svg');
  if (!svg) throw new Error('no svg rendered');
  return svg;
};

describe('the icon list', () => {
  it('is curated: unique kebab-case names, health icons included', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
    for (const name of ICON_NAMES) expect(name).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    for (const name of HEALTH_ICONS) expect(ICON_NAMES).toContain(name);
    expect(HEALTH_ICONS.length).toBeGreaterThanOrEqual(4);
  });

  it('names exactly the directional icons', () => {
    expect([...DIRECTIONAL_ICONS].sort()).toEqual(
      ['arrow-back', 'arrow-forward', 'caret-back', 'caret-forward', 'sign-out'].sort(),
    );
  });

  it('refuses a name outside the list', () => {
    expect(() => iconSource('heart-eyes' as IconName)).toThrow(/heart-eyes/);
    // @ts-expect-error a name outside the curated list is a type error too
    const unknown: IconName = 'heart-eyes';
    expect(unknown).toBe('heart-eyes');
  });

  it('keeps the medical keys callers use, drawn by Tabler too', () => {
    expect([...HEALTH_ICONS].sort()).toEqual(
      ['blood-drop', 'heart-organ', 'medicines', 'stethoscope', 'syringe', 'tooth'].sort(),
    );
  });
});

describe('Icon', () => {
  it.each(ICON_NAMES)('%s is a Tabler outline glyph stroked in currentColor', async (name) => {
    const screen = await render(<Icon name={name} />);
    const svg = svgOf(screen.container);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.classList.contains('tabler-icon')).toBe(true);
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('stroke-width')).toBe('2');
    expect(svg.querySelectorAll('path, circle, rect, line, polyline').length).toBeGreaterThan(0);
  });

  it('draws one tone: no inner fill and no translucent second shape', async () => {
    for (const name of ICON_NAMES) {
      const screen = await render(<Icon name={name} />);
      const svg = svgOf(screen.container);
      expect(svg.querySelector('[opacity], [fill-opacity]'), name).toBeNull();
      for (const shape of svg.querySelectorAll('[fill]')) {
        expect(shape.getAttribute('fill'), name).toBe('none');
      }
      await screen.unmount();
    }
  });

  it('takes the icon ink of the theme: the text colour', async () => {
    const screen = await render(
      <span className="text-icon-default">
        <Icon name="calendar-plus" />
      </span>,
    );
    const svg = svgOf(screen.container);
    const host = screen.container.querySelector('span');
    expect(getComputedStyle(svg).stroke).toBe(getComputedStyle(host as Element).color);
  });

  it('is 20 px at sm (default) and 24 px at md, the icon size tokens', async () => {
    const sm = await render(<Icon name="printer" />);
    expect(svgOf(sm.container).getBoundingClientRect().width).toBe(20);
    const md = await render(<Icon name="printer" size="md" />);
    expect(svgOf(md.container).getBoundingClientRect().width).toBe(24);
  });

  it('is named for screen readers only when given a label', async () => {
    const screen = await render(<Icon name="warning" label="تنبيه" />);
    const svg = svgOf(screen.container);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('تنبيه');
    expect(svg.hasAttribute('aria-hidden')).toBe(false);
  });

  it.each(['rtl', 'ltr'] as const)('mirrors only the directional icons in %s', async (dir) => {
    for (const name of ICON_NAMES) {
      const screen = await render(
        <DirectionProvider dir={dir}>
          <Icon name={name} />
        </DirectionProvider>,
      );
      const scale = getComputedStyle(svgOf(screen.container)).scale;
      const mirrored = scale.startsWith('-1');
      expect(mirrored, `${name} in ${dir}`).toBe(dir === 'rtl' && DIRECTIONAL_ICONS.includes(name));
      await screen.unmount();
    }
  });
});
