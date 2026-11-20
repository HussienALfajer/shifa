// RTL gate (spec 0.4 criterion 7, slice 0.4-04): Select in Arabic RTL and English LTR. A labelled
// field opens a list below it, aligned to its logical start and at least as wide; Up and Down
// move; typing an Arabic letter finds a doctor by the given name (the «د.» title is not matched);
// Enter chooses and focus returns to the field; Escape keeps the value; invalid and disabled say
// so; axe is clean. Digits do not apply (n/a).
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { DOCTORS } from '../../test/fixtures.ts';
import { expectAxeClean, expectPopupSide, renderDir } from '../../test/support/index.ts';
import { Select, type SelectItem } from './select.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const [first, second, third, away] = DOCTORS as [
  (typeof DOCTORS)[0],
  (typeof DOCTORS)[0],
  (typeof DOCTORS)[0],
  (typeof DOCTORS)[0],
];
const ITEMS: SelectItem[] = [
  { value: first.id, label: first.name },
  { value: second.id, label: second.name },
  { value: third.id, label: third.name },
  { value: away.id, label: away.name, disabled: true, hint: 'في إجازة' },
];
/** The given name's first letter, after the «د. » title. */
const firstLetter = (name: string) => name.replace(/^د\.\s*/, '').charAt(0);

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

/** The option a keyboard user is on: focused, aria-activedescendant, or marked highlighted. */
function current(): string | undefined {
  const active = document.activeElement;
  const id = active?.getAttribute('aria-activedescendant');
  const el = id ? document.getElementById(id) : active;
  const option =
    el?.closest('[role="option"]') ?? document.querySelector('[role="option"][data-highlighted]');
  return option?.getAttribute('data-value') ?? option?.textContent?.trim();
}
const isOn = (label: string) => current()?.includes(label) ?? false;

async function setup(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof Select>[0]> = {}) {
  const onValueChange = vi.fn();
  const screen = await renderDir(
    <div className="flex justify-center p-16">
      <div className="w-64">
        <Select
          label="الطبيب"
          items={ITEMS}
          placeholder="اختر الطبيب"
          onValueChange={onValueChange}
          {...props}
        />
      </div>
    </div>,
    { dir },
  );
  const field = screen.getByRole('combobox', { name: 'الطبيب' }).element() as HTMLElement;
  return { screen, field, onValueChange };
}

async function open(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof Select>[0]> = {}) {
  const s = await setup(dir, props);
  s.field.focus();
  await userEvent.keyboard('{ArrowDown}');
  const list = s.screen.getByRole('listbox');
  await expect.element(list).toBeVisible();
  return { ...s, list: list.element() as HTMLElement };
}

describe.each(DIRS)('Select gate in %s', (dir) => {
  it('is a labelled field that shows its placeholder', async () => {
    const { field } = await setup(dir);
    expect(field.textContent).toContain('اختر الطبيب');
    expect(field.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the list below the field, at its logical start and at least as wide', async () => {
    const { field, list } = await open(dir);
    expect(field.getAttribute('aria-expanded')).toBe('true');
    expectPopupSide({ dir, trigger: field, popup: list, side: 'bottom', align: 'start' });
    expect(list.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      field.getBoundingClientRect().width - 1,
    );
  });

  it('Down and Up move between the options', async () => {
    await open(dir);
    await poll(() => isOn(first.name), 'opens on the first option').toBe(true);
    await userEvent.keyboard('{ArrowDown}');
    await poll(() => isOn(second.name), 'down').toBe(true);
    await userEvent.keyboard('{ArrowUp}');
    await poll(() => isOn(first.name), 'up').toBe(true);
  });

  it('typing an Arabic letter finds the doctor by the given name, not the title', async () => {
    await open(dir);
    await userEvent.keyboard(firstLetter(third.name));
    await poll(() => isOn(third.name), `«${firstLetter(third.name)}» finds ${third.name}`).toBe(
      true,
    );
  });

  it('Enter chooses the option, closes the list and returns focus to the field', async () => {
    const { screen, field, onValueChange } = await open(dir);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onValueChange).toHaveBeenCalledWith(second.id);
    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'focus back on the field').toBe(field);
    expect(field.textContent).toContain(second.name);
  });

  it('marks the chosen option by a check, not by colour alone', async () => {
    const { screen } = await open(dir, { defaultValue: first.id });
    const chosen = screen.getByRole('option', { name: first.name }).element();
    expect(chosen.getAttribute('aria-selected')).toBe('true');
    expect(chosen.querySelector('[data-slot="select-check"] svg')).not.toBeNull();
  });

  it('Escape closes the list and keeps the value', async () => {
    const { screen, field, onValueChange } = await open(dir, { defaultValue: first.id });
    await userEvent.keyboard('{ArrowDown}{Escape}');
    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(field.textContent).toContain(first.name);
    await poll(() => document.activeElement, 'focus stays on the field').toBe(field);
  });

  it('the unavailable doctor shows the reason and cannot be chosen', async () => {
    const { screen, onValueChange } = await open(dir);
    const option = screen.getByRole('option', { name: new RegExp(away.name) }).element();
    expect(option.getAttribute('aria-disabled')).toBe('true');
    expect(option.textContent).toContain('في إجازة');
    await userEvent.click(option, { force: true });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('invalid: the field is marked and its message is read with it', async () => {
    const { field } = await setup(dir, { error: 'اختر طبيباً قبل الحفظ' });
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const ids = (field.getAttribute('aria-describedby') ?? '').split(' ');
    const text = ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    expect(text).toContain('اختر طبيباً قبل الحفظ');
  });

  it('disabled: cannot be opened', async () => {
    const { screen, field } = await setup(dir, { disabled: true });
    await userEvent.click(field, { force: true });
    expect(screen.getByRole('listbox').query()).toBeNull();
  });

  it('is clean under axe, closed and open, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <Select label="الطبيب" items={ITEMS} placeholder="اختر الطبيب" />,
        { dir, theme },
      );
      await expectAxeClean(screen.container);
      await userEvent.click(screen.getByRole('combobox', { name: 'الطبيب' }));
      await expect.element(screen.getByRole('listbox')).toBeVisible();
      await expectAxeClean(screen.container);
      await userEvent.keyboard('{Escape}');
      await screen.unmount();
    }
  });
});
