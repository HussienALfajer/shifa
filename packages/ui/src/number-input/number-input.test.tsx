// Number Input beyond the gate (slice 0.4-04 review): the steppers are out of the tab order, so
// Tab goes from the number to the next field.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderDir } from '../../test/support/index.ts';
import { NumberInput } from './number-input.tsx';

describe.each(['rtl', 'ltr'] as const)('Number Input in %s', (dir) => {
  it('keeps the steppers out of the tab order', async () => {
    const screen = await renderDir(
      <>
        <NumberInput label="عدد الجلسات" defaultValue={3} />
        <button type="button">التالي</button>
      </>,
      { dir },
    );
    (screen.getByRole('spinbutton').element() as HTMLElement).focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'التالي' }).element());
  });
});
