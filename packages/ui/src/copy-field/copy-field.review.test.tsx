// CopyField, the A-01-10 checkpoint 3 review: a new value was never copied, so the copied state of
// the last one goes (finding 2); the status region stays mounted so screen readers announce the
// copy (finding 9).
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { renderDir } from '../../test/support/index.ts';
import { CopyField } from './copy-field.tsx';

const A = 'https://clinic.shifa.example/setup#t=first';
const B = 'https://clinic.shifa.example/setup#t=second';

describe('CopyField review fixes', () => {
  it('a new value starts uncopied; the status region was there before the copy', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.resolve()) },
      configurable: true,
    });
    const screen = await renderDir(<CopyField value={A} label="رابط الإعداد" />);
    const status = screen.getByRole('status').element();
    expect(status.textContent).toBe('');
    await userEvent.click(screen.getByRole('button', { name: 'نسخ' }));
    await expect.poll(() => screen.getByRole('status').element()).toBe(status);
    expect(status.textContent).toBe('نُسخ');
    await screen.rerender(<CopyField value={B} label="رابط الإعداد" />);
    await expect.poll(() => screen.getByRole('button', { name: 'نسخ' }).query()).not.toBeNull();
    expect(screen.getByRole('status').element().textContent).toBe('');
    await screen.unmount();
  });
});
