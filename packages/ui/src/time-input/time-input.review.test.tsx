// Review fix for slice 0.4-13 (reviewer N5, 2026-11-23): the slot grid's footer counts minutes
// with Arabic and English plurals.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderDir } from '../../test/support/index.ts';
import { TimeInput } from './time-input.tsx';

const CASES: Record<'rtl' | 'ltr', [number, string][]> = {
  rtl: [
    [1, 'كل دقيقة'],
    [2, 'كل دقيقتين'],
    [10, 'كل 10 دقائق'],
    [15, 'كل 15 دقيقة'],
  ],
  ltr: [
    [1, 'Every minute'],
    [10, 'Every 10 minutes'],
  ],
};

describe.each(['rtl', 'ltr'] as const)('Time Input slot footer in %s', (dir) => {
  it.each(CASES[dir])('a step of %i reads «%s»', async (step, text) => {
    const screen = await renderDir(
      <TimeInput label="وقت الموعد" min="09:00" max="10:00" step={step} />,
      {
        dir,
      },
    );
    const name = dir === 'rtl' ? 'اختيار الوقت' : 'Choose a time';
    await userEvent.click(screen.getByRole('button', { name }));
    await expect.element(screen.getByText(`${text} · 09:00–10:00`)).toBeVisible();
    await screen.unmount();
  });
});
