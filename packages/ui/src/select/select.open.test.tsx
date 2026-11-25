// Select open at rest (OD-119): `defaultOpen` shows the list at mount, as the canvas draws it; it
// still closes with Escape (focus on the field) and with a press outside; `open` and
// `onOpenChange` control it. Closed by default, as before.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { DOCTORS } from '../../test/fixtures.ts';
import { renderDir } from '../../test/support/index.ts';
import { Select, type SelectItem } from './select.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const [first, second] = DOCTORS as [(typeof DOCTORS)[0], (typeof DOCTORS)[0]];
const ITEMS: SelectItem[] = [
  { value: first.id, label: first.name },
  { value: second.id, label: second.name, disabled: true, hint: 'في إجازة' },
];

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

async function setup(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof Select>[0]> = {}) {
  const screen = await renderDir(
    <div className="flex flex-col items-center gap-4 p-16">
      <button type="button">outside</button>
      <div className="w-64">
        <Select label="الطبيب" items={ITEMS} placeholder="اختر الطبيب" {...props} />
      </div>
    </div>,
    { dir },
  );
  const field = screen.getByRole('combobox', { name: 'الطبيب' }).element() as HTMLElement;
  return { screen, field };
}

describe.each(DIRS)('Select open at rest in %s', (dir) => {
  it('is closed by default', async () => {
    const { screen, field } = await setup(dir);
    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('listbox').query()).toBeNull();
  });

  it('defaultOpen shows the list at mount, the chosen row checked', async () => {
    const { screen, field } = await setup(dir, { defaultOpen: true, defaultValue: first.id });
    await expect.element(screen.getByRole('listbox')).toBeVisible();
    expect(field.getAttribute('aria-expanded')).toBe('true');
    const chosen = screen.getByRole('option', { name: first.name }).element();
    expect(chosen.getAttribute('aria-selected')).toBe('true');
  });

  it('still closes with Escape, focus on the field', async () => {
    const onOpenChange = vi.fn();
    const { screen, field } = await setup(dir, { defaultOpen: true, onOpenChange });
    await expect.element(screen.getByRole('listbox')).toBeVisible();
    field.focus();
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    await poll(() => document.activeElement, 'focus on the field').toBe(field);
  });

  it('still closes with a press outside', async () => {
    const { screen } = await setup(dir, { defaultOpen: true });
    await expect.element(screen.getByRole('listbox')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
  });

  it('open controls it', async () => {
    const { screen, field } = await setup(dir, { open: true });
    await expect.element(screen.getByRole('listbox')).toBeVisible();
    expect(field.getAttribute('aria-expanded')).toBe('true');
  });
});
