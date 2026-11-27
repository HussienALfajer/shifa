// MultiCombobox (A-02-01, sheet A02SheetMultiCombobox approved by the owner 2026-11-27): several
// choices found by typing. The chosen ones are chips inside the field, each with a remove button
// named by its choice; matching is Combobox's (a word starts with the typed text, through
// `foldArabic`); the list stays open after each pick, a chosen option shows a tick and is
// `aria-selected`; Backspace in the empty field removes the last chip; error and disabled as
// every field. The list opens below the field at its logical start.
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AHMAD, patientsSharing } from '../../test/fixtures.ts';
import {
  expectAxeClean,
  renderDir,
  typeArabic,
  waitForPopupSide,
} from '../../test/support/index.ts';
import type { ComboboxItem } from '../combobox/combobox.tsx';
import { MultiCombobox } from './multi-combobox.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const { query, matching, others } = patientsSharing();
const ITEMS: ComboboxItem[] = [...matching, ...others, AHMAD].map((p) => ({
  value: p.id,
  label: p.name,
}));
const [FIRST, SECOND] = ITEMS;
const EMPTY = 'لا عيادة بهذا الاسم';
const optionTexts = () =>
  [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent);
const chips = () =>
  [...document.querySelectorAll('[data-slot="multi-combobox-chip"]')].map((c) => c.textContent);
const removeName = (dir: 'rtl' | 'ltr', label: string) =>
  dir === 'rtl' ? `إزالة ${label}` : `Remove ${label}`;

function Picker({
  initial = [],
  onValueChange,
  error,
  disabled,
}: {
  initial?: string[];
  onValueChange?: (value: string[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex justify-center p-16">
      <div className="w-96">
        <MultiCombobox
          label="العيادات المختارة"
          items={ITEMS}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            onValueChange?.(next);
          }}
          emptyMessage={EMPTY}
          placeholder="ابحث عن عيادة"
          hint="ابحث بالاسم واختر عيادة أو أكثر."
          {...(error === undefined ? {} : { error })}
          {...(disabled === undefined ? {} : { disabled })}
        />
      </div>
    </div>
  );
}

async function setup(dir: 'rtl' | 'ltr', props: Parameters<typeof Picker>[0] = {}) {
  const screen = await renderDir(<Picker {...props} />, { dir });
  const input = screen
    .getByRole('combobox', { name: 'العيادات المختارة' })
    .element() as HTMLInputElement;
  return { screen, input };
}

describe.each(DIRS)('MultiCombobox in %s', (dir) => {
  it('shows the chosen ones as chips, each with a remove button named by its choice', async () => {
    const onValueChange = vi.fn();
    const { screen } = await setup(dir, {
      initial: [FIRST?.value ?? '', SECOND?.value ?? ''],
      onValueChange,
    });
    expect(chips()).toEqual([FIRST?.label, SECOND?.label]);
    await screen.getByRole('button', { name: removeName(dir, FIRST?.label ?? '') }).click();
    expect(onValueChange).toHaveBeenLastCalledWith([SECOND?.value]);
    expect(chips()).toEqual([SECOND?.label]);
    await screen.unmount();
  });

  it('narrows the list to the names with a word starting with the typed Arabic', async () => {
    const { screen, input } = await setup(dir);
    await typeArabic(input, query);
    await expect.poll(() => optionTexts().length).toBe(matching.length);
    for (const p of matching) expect(optionTexts().some((t) => t.includes(p.name))).toBe(true);
    await screen.unmount();
  });

  it('folds Arabic as Combobox does: «احمد» finds «أحمد»', async () => {
    const { screen, input } = await setup(dir);
    await typeArabic(input, 'احمد');
    await expect.poll(() => optionTexts()).toEqual([AHMAD.name]);
    await screen.unmount();
  });

  it('keeps the list open after each pick, ticks the chosen and lists it in the field', async () => {
    const onValueChange = vi.fn();
    const { screen, input } = await setup(dir, { onValueChange });
    await typeArabic(input, query);
    await expect.poll(() => optionTexts().length).toBe(matching.length);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onValueChange).toHaveBeenLastCalledWith([matching[0]?.id]);
    expect(chips()).toEqual([matching[0]?.name]);
    const listbox = screen.getByRole('listbox').element();
    expect(listbox.getAttribute('aria-multiselectable')).toBe('true');
    await expect.element(screen.getByRole('listbox')).toBeVisible();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await typeArabic(input, query);
    await expect.poll(() => optionTexts().length).toBe(matching.length);
    const chosen = screen.getByRole('option', { name: matching[0]?.name ?? '' }).element();
    expect(chosen.getAttribute('aria-selected')).toBe('true');
    expect(chosen.querySelector('[data-slot="multi-combobox-tick"] svg')).not.toBeNull();
    await screen.getByRole('option', { name: matching[1]?.name ?? '' }).click();
    expect(onValueChange).toHaveBeenLastCalledWith([matching[0]?.id, matching[1]?.id]);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    await screen.unmount();
  });

  it('Backspace in the empty field removes the last chip', async () => {
    const onValueChange = vi.fn();
    const { screen, input } = await setup(dir, {
      initial: [FIRST?.value ?? '', SECOND?.value ?? ''],
      onValueChange,
    });
    input.focus();
    await userEvent.keyboard('{Backspace}');
    expect(onValueChange).toHaveBeenLastCalledWith([FIRST?.value]);
    expect(chips()).toEqual([FIRST?.label]);
    await screen.unmount();
  });

  it('says when nothing matches', async () => {
    const { screen, input } = await setup(dir);
    await typeArabic(input, 'ظظظ');
    await expect.element(screen.getByText(EMPTY)).toBeVisible();
    expect(optionTexts()).toEqual([]);
    await screen.unmount();
  });

  it('opens the list below the field, at its logical start', async () => {
    const { screen, input } = await setup(dir);
    await typeArabic(input, query);
    await expect.element(screen.getByRole('listbox')).toBeVisible();
    const field = input.closest('[data-slot="multi-combobox-field"]') ?? input;
    await waitForPopupSide({
      dir,
      trigger: field,
      popup: screen.getByRole('listbox').element(),
      side: 'bottom',
      align: 'start',
    });
    await screen.unmount();
  });

  it('an error is announced with the field; disabled turns off typing and removing', async () => {
    const { screen, input } = await setup(dir, { error: 'اختر عيادة واحدة على الأقل.' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('اختر عيادة واحدة على الأقل.').element()).toBeTruthy();
    await screen.unmount();
    const disabled = await setup(dir, { initial: [FIRST?.value ?? ''], disabled: true });
    expect(disabled.input.disabled).toBe(true);
    const remove = disabled.screen
      .getByRole('button', { name: removeName(dir, FIRST?.label ?? '') })
      .element() as HTMLButtonElement;
    expect(remove.disabled || remove.getAttribute('aria-disabled') === 'true').toBe(true);
    await disabled.screen.unmount();
  });

  it.each(['light', 'dark'] as const)('is axe clean closed and open in %s', async (theme) => {
    const screen = await renderDir(<Picker initial={[FIRST?.value ?? '']} />, { dir, theme });
    await expectAxeClean(screen.container);
    const input = screen
      .getByRole('combobox', { name: 'العيادات المختارة' })
      .element() as HTMLInputElement;
    await typeArabic(input, query);
    await expect.element(screen.getByRole('listbox')).toBeVisible();
    await expectAxeClean(document.body);
    await screen.unmount();
  });
});
