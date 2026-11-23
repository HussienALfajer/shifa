// Combobox beyond the gate (slice 0.4-04 review): reopening after a choice or with a value shows
// every name, and a query with a space matches at the start of a word.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { patientsSharing, people } from '../../test/fixtures.ts';
import { renderDir, typeArabic } from '../../test/support/index.ts';
import { Combobox, type ComboboxItem, matchesWordStart } from './combobox.tsx';

const { query, matching, others } = patientsSharing();
const ITEMS: ComboboxItem[] = [...matching, ...others].map((p) => ({ value: p.id, label: p.name }));
const optionCount = () => document.querySelectorAll('[role="option"]').length;
const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

/** A generated name whose family name starts with «ال», so a query can start either word. */
const WORDY = people(8, { seed: 83 }).find((p) => p.name.split(' ')[1]?.startsWith('ال'));
const [GIVEN = '', FAMILY = ''] = WORDY?.name.split(' ') ?? [];

describe('matchesWordStart', () => {
  it('matches a query that starts a word, spaces included', () => {
    const name = `${GIVEN} ${FAMILY}`;
    expect(matchesWordStart(name, GIVEN.slice(0, 2))).toBe(true);
    expect(matchesWordStart(name, FAMILY.slice(0, 3))).toBe(true);
    expect(matchesWordStart(name, `${GIVEN} ال`)).toBe(true);
    expect(matchesWordStart(`${GIVEN}  ${FAMILY}`, name)).toBe(true);
    expect(matchesWordStart(name, GIVEN.slice(1))).toBe(false);
    expect(matchesWordStart(name, `${GIVEN} ب`)).toBe(false);
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
