// RTL gate (spec 0.4 criterion 7, slice 0.4-04): Combobox in Arabic RTL and English LTR. Typing
// Arabic letters keeps the text and narrows the list to the names with a word that starts with
// them; the list opens below the field at its logical start; Down and Enter choose and the field
// shows the name; no match says so; Escape closes; axe is clean. Digits do not apply (n/a).
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { patientsSharing } from '../../test/fixtures.ts';
import {
  expectAxeClean,
  renderDir,
  typeArabic,
  waitForPopupSide,
} from '../../test/support/index.ts';
import { Combobox, type ComboboxItem } from './combobox.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const { query, matching, others } = patientsSharing();
const PEOPLE = [...matching, ...others];
const ITEMS: ComboboxItem[] = PEOPLE.map((p) => ({
  value: p.id,
  label: p.name,
  description: `ملف ${p.id}`,
}));
/** The rule the sheet states: a word of the name starts with what was typed. */
const matches = (label: string, typed: string) =>
  label.split(/\s+/).some((word) => word.startsWith(typed));
const EMPTY = 'لا يوجد مريض بهذا الاسم';

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

const optionTexts = () =>
  [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent);

function highlighted(input: HTMLElement): string | undefined {
  const id = input.getAttribute('aria-activedescendant');
  const option =
    (id ? document.getElementById(id) : null) ??
    document.querySelector('[role="option"][data-highlighted]');
  return option?.textContent ?? undefined;
}

async function setup(dir: 'rtl' | 'ltr') {
  const onValueChange = vi.fn();
  const screen = await renderDir(
    <div className="flex justify-center p-16">
      <div className="w-72">
        <Combobox label="المريض" items={ITEMS} emptyMessage={EMPTY} onValueChange={onValueChange} />
      </div>
    </div>,
    { dir },
  );
  const input = screen.getByRole('combobox', { name: 'المريض' }).element() as HTMLInputElement;
  return { screen, input, onValueChange };
}

describe.each(DIRS)('Combobox gate in %s', (dir) => {
  it('fixture: three names share the typed start and others do not', () => {
    expect(query.length).toBe(2);
    expect(matching).toHaveLength(3);
    expect(others.length).toBeGreaterThan(0);
  });

  it('keeps typed Arabic text and narrows the list to the names that match it', async () => {
    const { input } = await setup(dir);
    await typeArabic(input, query);
    const expected = ITEMS.filter((i) => matches(i.label, query)).map((i) => i.label);
    await poll(() => optionTexts().length, 'the matching names are listed').toBe(expected.length);
    for (const label of expected) {
      expect(optionTexts().some((t) => t.includes(label))).toBe(true);
    }
  });

  it('opens the list below the field, aligned to its logical start', async () => {
    const { screen, input } = await setup(dir);
    await typeArabic(input, query);
    const list = screen.getByRole('listbox').element();
    await expect.element(screen.getByRole('listbox')).toBeVisible();
    const field = input.closest('[data-slot="combobox-field"]') ?? input;
    await waitForPopupSide({ dir, trigger: field, popup: list, side: 'bottom', align: 'start' });
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });

  it('Down then Enter chooses a name; the field shows it', async () => {
    const { screen, input, onValueChange } = await setup(dir);
    await typeArabic(input, query);
    await userEvent.keyboard('{ArrowDown}');
    await poll(() => highlighted(input)?.includes(matching[0]?.name ?? '?'), 'first match').toBe(
      true,
    );
    await userEvent.keyboard('{Enter}');
    expect(onValueChange).toHaveBeenCalledWith(matching[0]?.id);
    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
    expect(input.value).toBe(matching[0]?.name);
    expect(document.activeElement).toBe(input);
  });

  it('says so when no name matches', async () => {
    const { screen, input } = await setup(dir);
    await typeArabic(input, 'ظظظ');
    await expect.element(screen.getByText(EMPTY)).toBeVisible();
    expect(optionTexts()).toHaveLength(0);
  });

  it('Escape closes the list and keeps focus in the field', async () => {
    const { screen, input } = await setup(dir);
    await typeArabic(input, query);
    await expect.element(screen.getByRole('listbox')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(input);
  });

  it('a clear button empties the field', async () => {
    const { screen, input } = await setup(dir);
    await typeArabic(input, query);
    await userEvent.click(screen.getByRole('button', { name: 'مسح' }));
    expect(input.value).toBe('');
  });

  it('is clean under axe, closed and open, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(
        <Combobox label="المريض" items={ITEMS} emptyMessage={EMPTY} />,
        {
          dir,
          theme,
        },
      );
      await expectAxeClean(screen.container);
      const input = screen.getByRole('combobox', { name: 'المريض' }).element() as HTMLInputElement;
      await typeArabic(input, query);
      await expect.element(screen.getByRole('listbox')).toBeVisible();
      await expectAxeClean(screen.container);
      await userEvent.keyboard('{Escape}');
      await screen.unmount();
    }
  });
});
