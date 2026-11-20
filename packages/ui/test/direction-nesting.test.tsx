// An LTR region inside an RTL page (an English name block, a Latin form inside an Arabic screen)
// follows its own direction: found in the design-system preview of slice 0.4-03, where Tailwind's
// default `rtl:` variant (`[dir="rtl"] *`) mirrored icons inside a nested dir="ltr" region.
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { DirectionProvider, Icon } from '../src/index.ts';

function mirrored(svg: Element | null): boolean {
  if (svg === null) throw new Error('no icon rendered');
  return getComputedStyle(svg).scale.startsWith('-1');
}

describe('nested directions', () => {
  it('does not mirror a directional icon in an LTR region inside an RTL page', async () => {
    const screen = await render(
      <DirectionProvider dir="rtl">
        <span data-testid="outer">
          <Icon name="arrow-forward" />
        </span>
        <DirectionProvider dir="ltr">
          <span data-testid="inner">
            <Icon name="arrow-forward" />
          </span>
        </DirectionProvider>
      </DirectionProvider>,
    );
    expect(mirrored(screen.getByTestId('outer').element().querySelector('svg'))).toBe(true);
    expect(mirrored(screen.getByTestId('inner').element().querySelector('svg'))).toBe(false);
  });

  it('mirrors in an RTL region inside an LTR page', async () => {
    const screen = await render(
      <DirectionProvider dir="ltr">
        <DirectionProvider dir="rtl">
          <span data-testid="inner">
            <Icon name="arrow-forward" />
          </span>
        </DirectionProvider>
      </DirectionProvider>,
    );
    expect(mirrored(screen.getByTestId('inner').element().querySelector('svg'))).toBe(true);
  });
});
