// Password Input (slice 0.4-05, spec 0.4 criterion 8), as on the approved sheet: hidden by
// default; the show toggle sits inside the field at its logical end, keeps one name and reports
// its state with aria-pressed; Tab goes from the field to the toggle; a submit hides the
// password again; an error is read with the field; axe is clean, light and dark.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, expectFocusRing, renderDir } from '../../test/support/index.ts';
import { PasswordInput } from './password-input.tsx';

const described = (el: Element) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

const field = (container: Element) => {
  const input = container.querySelector<HTMLInputElement>(
    'input[name="password"], input:not([type="hidden"])',
  );
  if (input === null) throw new Error('missing: the password field');
  return input;
};

describe.each(['rtl', 'ltr'] as const)('Password Input in %s', (dir) => {
  it('is hidden, named by its label, and shown by the toggle', async () => {
    const screen = await renderDir(<PasswordInput label="كلمة المرور" name="password" />, {
      dir,
    });
    const input = screen
      .getByLabelText('كلمة المرور', { exact: true })
      .element() as HTMLInputElement;
    expect(input.type).toBe('password');
    const toggle = screen.getByRole('button', { name: 'إظهار كلمة المرور' });
    await expect.element(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(input.type).toBe('text');
    await expect.element(toggle).toHaveAttribute('aria-pressed', 'true');
    // The name stays the same; aria-pressed carries the state.
    expect(screen.getByRole('button', { name: 'إظهار كلمة المرور' }).element()).toBe(
      toggle.element(),
    );
  });

  it('Tab goes from the field to the toggle; Space toggles from the keyboard', async () => {
    const screen = await renderDir(<PasswordInput label="كلمة المرور" />, { dir });
    const input = field(screen.container);
    await userEvent.tab();
    expect(document.activeElement).toBe(input);
    await expectFocusRing(input);
    await userEvent.tab();
    const toggle = screen.getByRole('button', { name: 'إظهار كلمة المرور' }).element();
    expect(document.activeElement).toBe(toggle);
    await expectFocusRing(toggle);
    await userEvent.keyboard(' ');
    expect(input.type).toBe('text');
  });

  it('puts the toggle inside the field at its logical end', async () => {
    const screen = await renderDir(<PasswordInput label="كلمة المرور" />, { dir });
    const input = field(screen.container).getBoundingClientRect();
    const toggle = screen
      .getByRole('button', { name: 'إظهار كلمة المرور' })
      .element()
      .getBoundingClientRect();
    if (dir === 'rtl') expect(toggle.right).toBeLessThanOrEqual(input.left + 1);
    else expect(toggle.left).toBeGreaterThanOrEqual(input.right - 1);
    expect(Math.abs(toggle.top + toggle.height / 2 - (input.top + input.height / 2))).toBeLessThan(
      2,
    );
  });

  it('a submit hides the password again', async () => {
    const screen = await renderDir(
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <PasswordInput label="كلمة المرور" defaultValue="Shifa-2026" />
        <button type="submit">دخول</button>
      </form>,
      { dir },
    );
    const input = field(screen.container);
    await userEvent.click(screen.getByRole('button', { name: 'إظهار كلمة المرور' }));
    expect(input.type).toBe('text');
    await userEvent.click(screen.getByRole('button', { name: 'دخول' }));
    await expect.poll(() => input.type, { timeout: 500 }).toBe('password');
  });

  it('an error marks it invalid and is read with it; disabled disables the toggle too', async () => {
    const screen = await renderDir(
      <>
        <PasswordInput label="كلمة المرور" error="8 أحرف على الأقل" />
        <PasswordInput label="كلمة السر القديمة" disabled />
      </>,
      { dir },
    );
    const [first, second] = [...screen.container.querySelectorAll('input:not([type="hidden"])')];
    expect(first?.getAttribute('aria-invalid')).toBe('true');
    if (first === undefined || !(second instanceof HTMLInputElement)) {
      throw new Error('missing: the two password fields');
    }
    expect(described(first)).toContain('8 أحرف على الأقل');
    expect(second.disabled).toBe(true);
    const toggle = screen.getByRole('button', { name: 'إظهار كلمة المرور' }).all().at(-1);
    if (toggle === undefined) throw new Error('missing: the second toggle');
    await expect.element(toggle).toBeDisabled();
  });

  it('is clean under axe, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <div className="flex flex-col gap-4">
          <PasswordInput label="كلمة المرور" defaultValue="Shifa-2026" />
          <PasswordInput
            label="كلمة المرور الجديدة"
            error="8 أحرف على الأقل"
            autoComplete="new-password"
          />
          <PasswordInput label="كلمة المرور" disabled />
        </div>,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await screen.unmount();
    }
  });
});
