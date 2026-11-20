// OTP Input (slice 0.4-05, spec 0.4 criterion 8; OD-62): one field for screen readers named
// «رمز التحقق», six slots laid out left to right in both directions (numbers never mirror);
// Arabic-Indic and Western digits are accepted and kept as Western; a pasted full code fills
// every slot; the arrows move between slots on screen (Left goes to the slot on the left); a
// letter is ignored; the error is read with it; axe is clean, light and dark.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, expectFocusRing, renderDir } from '../../test/support/index.ts';
import { OtpInput } from './otp-input.tsx';

const described = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

const slots = (container: Element) => [
  ...container.querySelectorAll<HTMLElement>('[data-slot="otp-slot"]'),
];
const activeSlot = (container: Element) =>
  container.querySelector<HTMLElement>('[data-slot="otp-slot"][data-active]');

/** `value`, or a failed test when it is missing. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing: ${what}`);
  return value;
}

async function setup(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof OtpInput>[0]> = {}) {
  const onValueChange = vi.fn();
  const onComplete = vi.fn();
  const screen = await renderDir(
    <OtpInput
      label="رمز التحقق"
      onValueChange={onValueChange}
      onComplete={onComplete}
      {...props}
    />,
    { dir },
  );
  const input = screen.getByRole('textbox', { name: 'رمز التحقق' }).element() as HTMLInputElement;
  return { screen, input, onValueChange, onComplete };
}

describe.each(['rtl', 'ltr'] as const)('OTP Input in %s', (dir) => {
  it('is one field with six slots, left to right in both directions', async () => {
    const { screen, input } = await setup(dir, { defaultValue: '482071' });
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    const all = slots(screen.container);
    expect(all).toHaveLength(6);
    expect(all.map((s) => s.textContent)).toEqual(['4', '8', '2', '0', '7', '1']);
    const lefts = all.map((s) => s.getBoundingClientRect().left);
    expect([...lefts].sort((a, b) => a - b)).toEqual(lefts);
  });

  it('accepts Arabic-Indic digits and keeps Western ones; completes with the code', async () => {
    const { input, onValueChange, onComplete } = await setup(dir);
    input.focus();
    await userEvent.keyboard('٤٨٢٠٧١');
    await expect.poll(() => input.value, { timeout: 1000 }).toBe('482071');
    expect(onValueChange).toHaveBeenLastCalledWith('482071');
    expect(onComplete).toHaveBeenCalledWith('482071');
  });

  it('accepts Western digits and ignores letters', async () => {
    const { input } = await setup(dir);
    input.focus();
    await userEvent.keyboard('4a8ب2');
    await expect.poll(() => input.value, { timeout: 1000 }).toBe('482');
  });

  it('fills every slot from a pasted full code, Arabic-Indic or with a separator', async () => {
    for (const pasted of ['482-071', '٤٨٢٠٧١']) {
      const { screen, input, onComplete } = await setup(dir);
      input.focus();
      const data = new DataTransfer();
      data.setData('text/plain', pasted);
      input.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
      await expect.poll(() => input.value, { timeout: 1000 }).toBe('482071');
      expect(slots(screen.container).map((s) => s.textContent)).toEqual([
        '4',
        '8',
        '2',
        '0',
        '7',
        '1',
      ]);
      expect(onComplete).toHaveBeenCalledWith('482071');
      await screen.unmount();
    }
  });

  it('the arrows move between slots on screen: Left goes left in both directions', async () => {
    const { screen, input } = await setup(dir);
    input.focus();
    await userEvent.keyboard('482');
    await expect.poll(() => activeSlot(screen.container)).not.toBeNull();
    const before = must(activeSlot(screen.container), 'the active slot').getBoundingClientRect()
      .left;
    await userEvent.keyboard('{ArrowLeft}');
    await expect
      .poll(() => activeSlot(screen.container)?.getBoundingClientRect().left ?? before)
      .toBeLessThan(before);
    const middle = must(activeSlot(screen.container), 'the active slot').getBoundingClientRect()
      .left;
    await userEvent.keyboard('{ArrowRight}');
    await expect
      .poll(() => activeSlot(screen.container)?.getBoundingClientRect().left ?? middle)
      .toBeGreaterThan(middle);
  });

  it('shows the focus ring on the active slot', async () => {
    const { screen } = await setup(dir);
    await userEvent.tab();
    await expect.poll(() => activeSlot(screen.container)).not.toBeNull();
    await expectFocusRing(must(activeSlot(screen.container), 'the active slot'));
  });

  it('an error marks it invalid and is read with it; disabled takes no typing', async () => {
    const { screen, input } = await setup(dir, {
      error: 'الرمز غير صحيح',
      hint: 'أرسلناه برسالة',
    });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(described(input)).toContain('الرمز غير صحيح');
    expect(described(input)).toContain('أرسلناه برسالة');
    // Locators search the whole page: the first field goes before the second is drawn (owner
    // approved this fix, 2026-11-20).
    await screen.unmount();
    const off = await setup(dir, { disabled: true });
    expect(off.input.disabled).toBe(true);
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <div className="flex flex-col gap-4">
          <OtpInput label="رمز التحقق" hint="أرسلناه برسالة" />
          <OtpInput label="رمز الدخول" defaultValue="482075" error="الرمز غير صحيح" />
          <OtpInput label="رمز سابق" defaultValue="482071" disabled />
        </div>,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
