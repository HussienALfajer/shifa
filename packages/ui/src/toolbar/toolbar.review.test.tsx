// Review finding B1 of slice 0.4-07 (reviewer agent, 2026-11-22): in a flex row (the data table's
// tool bar is one) the toolbar keeps every button that fits, and buttons come back from «المزيد»
// when the row grows again.
import { describe, expect, it } from 'vitest';
import { renderDir } from '../../test/support/index.ts';
import { Toolbar, ToolbarButton } from './toolbar.tsx';

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1500, message });
const more = () => document.querySelector('[aria-label="المزيد"]');

describe('Toolbar in a flex row', () => {
  it('B1: fits all when there is room, and recovers after being narrow', async () => {
    const screen = await renderDir(
      <div data-testid="row" className="flex items-center gap-2">
        <Toolbar aria-label="أدوات">
          <ToolbarButton>طباعة</ToolbarButton>
          <ToolbarButton>تصدير</ToolbarButton>
        </Toolbar>
      </div>,
    );
    const row = document.querySelector<HTMLElement>('[data-testid="row"]');
    if (row === null) throw new Error('no row');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(more(), 'two buttons fit in a wide row').toBeNull();
    row.style.width = '120px';
    await poll(() => more() !== null, 'narrow: «المزيد» appears').toBe(true);
    row.style.width = '900px';
    await poll(() => more(), 'wide again: every button back').toBeNull();
    await screen.unmount();
  });
});
