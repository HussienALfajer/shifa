// Combobox open at rest (OD-119): `defaultInputValue` puts typed text in the field at mount and
// `defaultOpen` shows the list, so the matches with the typed part in bold, or the empty message,
// show at rest as the canvas draws them; it still closes with Escape and with a press outside,
// focus staying in the field. Closed and empty by default, as before. The typed part is bold
// when typing as well (UI SDK's item text used to rewrite it as plain text).
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { patientsSharing } from '../../test/fixtures.ts';
import { renderDir, typeArabic } from '../../test/support/index.ts';
import { Combobox, type ComboboxItem } from './combobox.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const { query, matching, others } = patientsSharing();
const ITEMS: ComboboxItem[] = [...matching, ...others].map((p) => ({
  value: p.id,
  label: p.name,
}));
const EMPTY = 'لا يوجد مريض بهذا الاسم';

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });
const options = () => [...document.querySelectorAll('[role="option"]')];

async function setup(dir: 'rtl' | 'ltr', props: Partial<Parameters<typeof Combobox>[0]> = {}) {
  const screen = await renderDir(
    <div className="flex flex-col items-center gap-4 p-16">
      <button type="button">outside</button>
      <div className="w-72">
        <Combobox label="المريض" items={ITEMS} emptyMessage={EMPTY} {...props} />
      </div>
    </div>,
    { dir },
  );
  const input = screen.getByRole('combobox', { name: 'المريض' }).element() as HTMLInputElement;
  return { screen, input };
}

describe.each(DIRS)('Combobox open at rest in %s', (dir) => {
  it('is closed and empty by default', async () => {
    const { input } = await setup(dir);
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(options()).toHaveLength(0);
  });

  it('defaultInputValue with defaultOpen shows the matches, the typed part in bold', async () => {
    const { input } = await setup(dir, { defaultOpen: true, defaultInputValue: query });
    expect(input.value).toBe(query);
    await poll(() => options().length, 'three matches').toBe(matching.length);
    for (const option of options()) {
      expect(option.querySelector('strong')?.textContent).toBe(query);
    }
    expect(input.getAttribute('aria-expanded')).toBe('true');
    // The empty message's box is not drawn, empty, above the matches.
    const emptyBoxes = [...document.querySelectorAll('.shadow-dropdown')].filter(
      (box) => box.getBoundingClientRect().height > 0 && box.textContent.trim() === '',
    );
    expect(emptyBoxes).toHaveLength(0);
  });

  it('typing marks the typed part in bold too', async () => {
    const { input } = await setup(dir);
    input.focus();
    await typeArabic(input, query);
    await poll(() => options().length, 'three matches').toBe(matching.length);
    for (const option of options()) {
      expect(option.querySelector('strong')?.textContent).toBe(query);
    }
  });

  it('text that matches nothing shows the empty message', async () => {
    const { screen } = await setup(dir, { defaultOpen: true, defaultInputValue: 'زز' });
    await expect.element(screen.getByText(EMPTY)).toBeVisible();
    expect(options()).toHaveLength(0);
  });

  it('still closes with Escape, focus staying in the field', async () => {
    const onOpenChange = vi.fn();
    const { input } = await setup(dir, {
      defaultOpen: true,
      defaultInputValue: query,
      onOpenChange,
    });
    await poll(() => options().length, 'open').toBe(matching.length);
    input.focus();
    await userEvent.keyboard('{Escape}');
    await poll(() => input.getAttribute('aria-expanded'), 'closed').toBe('false');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(document.activeElement).toBe(input);
  });

  it('still closes with a press outside', async () => {
    const { screen, input } = await setup(dir, { defaultOpen: true, defaultInputValue: query });
    await poll(() => options().length, 'open').toBe(matching.length);
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    await poll(() => input.getAttribute('aria-expanded'), 'closed').toBe('false');
  });
});
