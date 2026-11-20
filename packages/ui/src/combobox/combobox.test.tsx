// Combobox beyond the gate (slice 0.4-04 review): reopening after a choice or with a value shows
// every name, and a query with a space matches at the start of a word.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { patientsSharing } from '../../test/fixtures.ts';
import { renderDir, typeArabic } from '../../test/support/index.ts';
import { Combobox, type ComboboxItem, matchesWordStart } from './combobox.tsx';

const { query, matching, others } = patientsSharing();
const ITEMS: ComboboxItem[] = [...matching, ...others].map((p) => ({ value: p.id, label: p.name }));
const optionCount = () => document.querySelectorAll('[role="option"]').length;
const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

describe('matchesWordStart', () => {
  it('matches a query that starts a word, spaces included', () => {
    expect(matchesWordStart('سامر الحلبي', 'سا')).toBe(true);
    expect(matchesWordStart('سامر الحلبي', 'الح')).toBe(true);
    expect(matchesWordStart('سامر الحلبي', 'سامر ال')).toBe(true);
    expect(matchesWordStart('سامر  الحلبي', 'سامر الحلبي')).toBe(true);
    expect(matchesWordStart('سامر الحلبي', 'امر')).toBe(false);
    expect(matchesWordStart('سامر الحلبي', 'سامر ب')).toBe(false);
  });
});

describe.each(['rtl', 'ltr'] as const)('Combobox in %s', (dir) => {
  it('shows every name when reopened after a choice', async () => {
    const screen = await renderDir(<Combobox label="المريض" items={ITEMS} emptyMessage="لا" />, {
      dir,
    });
    const input = screen.getByRole('combobox').element() as HTMLInputElement;
    await typeArabic(input, query);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await poll(() => input.value, 'chosen').toBe(matching[0]?.name);
    await userEvent.keyboard('{ArrowDown}');
    await poll(optionCount, 'all names').toBe(ITEMS.length);
  });

  it('shows every name on first open with a value', async () => {
    const screen = await renderDir(
      <Combobox
        label="المريض"
        items={ITEMS}
        emptyMessage="لا"
        defaultValue={others[0]?.id ?? null}
      />,
      { dir },
    );
    const input = screen.getByRole('combobox').element() as HTMLInputElement;
    expect(input.value).toBe(others[0]?.name);
    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    await poll(optionCount, 'all names').toBe(ITEMS.length);
  });

  it('finds a name typed with a space', async () => {
    const screen = await renderDir(<Combobox label="المريض" items={ITEMS} emptyMessage="لا" />, {
      dir,
    });
    const input = screen.getByRole('combobox').element() as HTMLInputElement;
    const name = matching[1]?.name ?? '';
    await typeArabic(input, name.slice(0, name.indexOf(' ') + 3));
    await poll(
      () =>
        [...document.querySelectorAll('[role="option"]')].some((o) => o.textContent.includes(name)),
      'two-word query',
    ).toBe(true);
  });
});
