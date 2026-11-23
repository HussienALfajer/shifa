// Slices 0.4-03 and 0.4-09 (OD-65): one Icon component over a curated list: Solar's Broken
// style (CC BY 4.0, licence beside the files) and the Healthicons tooth (CC0), one tone in the
// text colour; icons that point a direction mirror under dir="rtl" and no other icon does.
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { DirectionProvider } from '../index.ts';
import healthLicence from './health/LICENSE.md?raw';
import {
  DIRECTIONAL_ICONS,
  HEALTH_ICONS,
  ICON_NAMES,
  Icon,
  type IconName,
  iconSource,
} from './icon.tsx';
import solarLicence from './solar/LICENSE.md?raw';

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

  it('keeps the medical keys callers use', () => {
    expect([...HEALTH_ICONS].sort()).toEqual(
      ['blood-drop', 'heart-organ', 'medicines', 'stethoscope', 'syringe', 'tooth'].sort(),
    );
  });

  it('keeps the licences beside the files: Solar credited (CC BY 4.0), Healthicons CC0', () => {
    expect(solarLicence).toMatch(/480 Design/);
    expect(solarLicence).toMatch(/CC BY 4\.0/);
    expect(solarLicence).toMatch(/creativecommons\.org\/licenses\/by\/4\.0/);
    expect(solarLicence).toMatch(/mirrored|flipped/);
    expect(healthLicence).toMatch(/CC0/);
  });
});

describe('Icon', () => {
  it.each(ICON_NAMES.filter((n) => n !== 'tooth'))(
    '%s is a Solar Broken glyph: a 1.5 stroke in currentColor, no fill',
    async (name) => {
      const screen = await render(<Icon name={name} />);
      const svg = svgOf(screen.container);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('data-shifa-icon')).toBe(name);
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg.innerHTML).toMatch(/Solar [\w-]+-broken by 480 Design/);
      const shapes = [...svg.querySelectorAll('path, circle')];
      expect(shapes.length).toBeGreaterThan(0);
      for (const shape of shapes) {
        const style = getComputedStyle(shape);
        expect(style.fill, name).toBe('none');
        expect(style.strokeWidth, name).toBe('1.5px');
        expect(style.stroke, name).toBe(getComputedStyle(svg).color);
      }
    },
  );

  it('draws the tooth from Healthicons, filled in currentColor (its outline is a shape)', async () => {
    const screen = await render(<Icon name="tooth" />);
    const svg = svgOf(screen.container);
    const shapes = [...svg.querySelectorAll('path')];
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) expect(shape.getAttribute('fill')).toBe('currentColor');
  });

  it('draws one tone: no translucent second shape anywhere', async () => {
    for (const name of ICON_NAMES) {
      const screen = await render(<Icon name={name} />);
      const svg = svgOf(screen.container);
      expect(svg.querySelector('[opacity], [fill-opacity], [stroke-opacity]'), name).toBeNull();
      await screen.unmount();
    }
  });

  it('takes the icon ink of the theme: the text colour', async () => {
    const screen = await render(
      <span className="text-icon-default">
        <Icon name="calendar-plus" />
      </span>,
    );
    const shape = svgOf(screen.container).querySelector('path');
    const host = screen.container.querySelector('span');
    if (shape === null || host === null) throw new Error('nothing drawn');
    expect(getComputedStyle(shape).stroke).toBe(getComputedStyle(host).color);
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
