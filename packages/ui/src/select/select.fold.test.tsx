// Select typeahead folds Arabic (slice 0.4-12, criterion 5, OD-40): typing «ا» then «ح» reaches a
// name written «أح…», typing «أ» still does, and the option shows its label as written.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { people, personWhere } from '../../test/fixtures.ts';
import { pressKeys, renderDir } from '../../test/support/index.ts';
import { Select, type SelectItem } from './select.tsx';

const target = personWhere((given) => given.startsWith('أح'), { id: '3001' });
// Another alef form, before the target in the list: «ا» alone reaches it first, «اح» does not.
const decoy = personWhere((given) => /^[أإآ]/u.test(given) && !given.startsWith('أح'), {
  id: '3002',
  seed: 42,
});
const rest = people(3, { seed: 43 }).filter(
  (p) => !/^[اأإآ]/u.test(p.name) && p.name !== target.name,
);
const ITEMS: SelectItem[] = [decoy, ...rest, target].map((p) => ({ value: p.id, label: p.name }));

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });

/** The option a keyboard user is on. */
function current(): HTMLElement | null {
  const active = document.activeElement;
  const id = active?.getAttribute('aria-activedescendant');
  const el = id ? document.getElementById(id) : active;
  return (
    el?.closest('[role="option"]') ?? document.querySelector('[role="option"][data-highlighted]')
  );
}

async function open(dir: 'rtl' | 'ltr') {
  const screen = await renderDir(
    <div className="w-64 p-16">
      <Select label="المريض" items={ITEMS} placeholder="اختر" onValueChange={() => undefined} />
    </div>,
    { dir },
  );
  const field = screen.getByRole('combobox', { name: 'المريض' }).element() as HTMLElement;
  field.focus();
  await userEvent.keyboard('{ArrowDown}');
  await expect.element(screen.getByRole('listbox')).toBeVisible();
  return screen;
}

describe.each(['rtl', 'ltr'] as const)('Select typeahead in %s', (dir) => {
  it('«ا» then «ح» reaches the name written with «أ»', async () => {
    const screen = await open(dir);
    await pressKeys('اح');
    await poll(
      () => current()?.getAttribute('data-value') ?? current()?.textContent,
      'on it',
    ).toSatisfy(
      (v: unknown) => v === target.id || (typeof v === 'string' && v.includes(target.name)),
    );
    // The option still shows the label as written, hamza included.
    expect(current()?.textContent).toContain(target.name);
    await screen.unmount();
  });

  it('typing «أ» then «ح» still reaches it', async () => {
    const screen = await open(dir);
    await pressKeys('أح');
    await poll(() => current()?.textContent.includes(target.name), 'on it').toBe(true);
    await screen.unmount();
  });
});
