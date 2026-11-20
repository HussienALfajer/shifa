// Backlog "Compact density on touch devices" (slice 0.4-03), in a real browser: DensityProvider
// refuses compact on a coarse pointer, falls back to comfortable and warns once in development.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { DensityProvider, useDensity } from '../src/index.ts';

/** Makes `(pointer: coarse)` match or not, and lets the test flip it later. */
function stubPointer(coarse: boolean) {
  const listeners = new Set<() => void>();
  const real = window.matchMedia.bind(window);
  let matches = coarse;
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    if (query !== '(pointer: coarse)') return real(query);
    return {
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  });
  return (next: boolean) => {
    matches = next;
    for (const listener of listeners) listener();
  };
}

function Probe() {
  return <span data-testid="probe">{useDensity()}</span>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DensityProvider', () => {
  it('keeps compact on a fine pointer', async () => {
    stubPointer(false);
    const screen = await render(
      <DensityProvider density="compact">
        <Probe />
      </DensityProvider>,
    );
    await expect.element(screen.getByTestId('probe')).toHaveTextContent('compact');
    expect(screen.container.querySelector('[data-density]')?.getAttribute('data-density')).toBe(
      'compact',
    );
  });

  it('falls back to comfortable on a coarse pointer and warns once', async () => {
    stubPointer(true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const screen = await render(
      <DensityProvider density="compact">
        <Probe />
      </DensityProvider>,
    );
    await expect.element(screen.getByTestId('probe')).toHaveTextContent('comfortable');
    expect(screen.container.querySelector('[data-density]')?.getAttribute('data-density')).toBe(
      'comfortable',
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/compact/);
  });

  it('follows the pointer when it changes', async () => {
    const setCoarse = stubPointer(false);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const screen = await render(
      <DensityProvider density="compact">
        <Probe />
      </DensityProvider>,
    );
    await expect.element(screen.getByTestId('probe')).toHaveTextContent('compact');
    setCoarse(true);
    await expect.element(screen.getByTestId('probe')).toHaveTextContent('comfortable');
  });

  it('gives compact rows 32 px controls through the tokens', async () => {
    stubPointer(false);
    const screen = await render(
      <DensityProvider density="compact">
        <span data-testid="box" className="block h-(--shifa-size-control-md)" />
      </DensityProvider>,
    );
    const box = screen.getByTestId('box').element();
    expect(box.getBoundingClientRect().height).toBe(32);
  });
});
