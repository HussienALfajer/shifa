// Slice 0.4-03 (backlog "Icons are not in the design system yet"): one Icon component over a
// curated list (Phosphor duotone and a small Healthicons set); icons that point a direction
// mirror under dir="rtl" and no other icon does.
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { DirectionProvider } from '../index.ts';
import licence from './health/LICENSE.md?raw';
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

  it('keeps the Healthicons licence beside the files', () => {
    expect(licence).toMatch(/CC0/);
    expect(licence).toMatch(/healthicons/i);
  });
});

describe('Icon', () => {
  it.each(ICON_NAMES)('%s renders an svg in currentColor', async (name) => {
    const screen = await render(<Icon name={name} />);
    const svg = svgOf(screen.container);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.innerHTML).toMatch(/currentColor|<path/);
  });

  it('draws Phosphor icons duotone, the second tone at 20 % of the stroke', async () => {
    const screen = await render(<Icon name="calendar-plus" />);
    expect(svgOf(screen.container).querySelector('[opacity="0.2"]')).not.toBeNull();
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
