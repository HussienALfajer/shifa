// Command palette (slice 0.4-06) in Arabic RTL and English LTR, as the owner approved the sheet
// on 2026-11-22 with OD-63: one search over patients and actions in a modal dialog. Focus stays
// in the search field; the up and down arrows move the active option and Enter runs it; Escape
// closes it and focus returns. An Arabic query finds a name whatever its diacritics, tatweel or
// alef form, through `normalise` (a simple default; Phase A passes the name normaliser,
// ADR-0034); the matched part is marked. No match shows the empty state.
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AHMAD, people } from '../../test/fixtures.ts';
import { expectAxeClean, renderDir, typeArabic } from '../../test/support/index.ts';
import {
  CommandPalette,
  type CommandPaletteGroup,
  normaliseForSearch,
} from './command-palette.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const [p1, p2, p3] = people(3, { seed: 11 });
if (p1 === undefined || p2 === undefined || p3 === undefined) throw new Error('fixtures');

const GROUPS: CommandPaletteGroup[] = [
  {
    label: 'المرضى',
    items: [
      { value: 'p-ahmad', label: AHMAD.name, description: 'ملف 1187', icon: 'user' },
      { value: 'p-1', label: p1.name, description: `ملف ${p1.id}`, icon: 'user' },
      { value: 'p-2', label: p2.name, description: `ملف ${p2.id}`, icon: 'user' },
      { value: 'p-3', label: p3.name, icon: 'user' },
    ],
  },
  {
    label: 'إجراءات',
    items: [
      { value: 'new-appointment', label: 'موعد جديد', icon: 'calendar-plus' },
      { value: 'new-patient', label: 'تسجيل مريض جديد', icon: 'plus' },
    ],
  },
];

function Palette({
  onAction = () => undefined,
  normalise,
}: {
  onAction?: (value: string) => void;
  normalise?: (text: string) => string;
}) {
  return (
    <CommandPalette
      triggerLabel="بحث"
      title="بحث وأوامر"
      inputLabel="ابحث عن مريض أو إجراء"
      groups={GROUPS}
      onAction={onAction}
      emptyText={(query) => `لا نتائج لـ «${query}»`}
      {...(normalise === undefined ? {} : { normalise })}
    />
  );
}

const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1500, message });

async function open(dir: 'rtl' | 'ltr', ui = <Palette />) {
  const screen = await renderDir(ui, { dir });
  const trigger = screen.getByRole('button', { name: 'بحث' }).element() as HTMLElement;
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  await expect.element(screen.getByRole('dialog', { name: 'بحث وأوامر' })).toBeVisible();
  const input = screen.getByRole('combobox', { name: 'ابحث عن مريض أو إجراء' }).element();
  return { screen, trigger, input: input as HTMLInputElement };
}

const optionLabels = () =>
  [...document.querySelectorAll('[role="option"]')]
    .filter((el) => !(el as HTMLElement).hidden && el.closest('[hidden]') === null)
    .map((el) => el.textContent);

describe.each(DIRS)('Command palette in %s', (dir) => {
  it('opens a named dialog with focus in the search field over a listbox', async () => {
    const { screen, input } = await open(dir);
    await poll(() => document.activeElement, 'focus in the field').toBe(input);
    expect(input.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').element().id);
    expect(screen.getByRole('option').elements().length).toBe(6);
    await screen.unmount();
  });

  it('finds a name typed with another alef form, and marks the match', async () => {
    const { screen, input } = await open(dir);
    await typeArabic(input, 'احمد');
    await poll(() => optionLabels().length, 'one match').toBe(1);
    const option = screen.getByRole('option').element();
    expect(option.textContent).toContain(AHMAD.name);
    expect(option.querySelector('mark')?.textContent).toBe('أحمد');
    await screen.unmount();
  });

  it('finds a name typed with diacritics and tatweel', async () => {
    const { input, screen } = await open(dir);
    await typeArabic(input, 'أَحْمـد');
    await poll(() => optionLabels().length, 'one match').toBe(1);
    expect(optionLabels()[0]).toContain(AHMAD.name);
    expect(normaliseForSearch('إِسْـراء')).toBe(normaliseForSearch('اسراء'));
    await screen.unmount();
  });

  it('uses a custom normalise when given one', async () => {
    // A rule only the custom normaliser knows: «حجز» and «موعد» are the same word here.
    const normalise = vi.fn((text: string) => normaliseForSearch(text).replaceAll('حجز', 'موعد'));
    const { input, screen } = await open(dir, <Palette normalise={normalise} />);
    await typeArabic(input, 'حجز جديد');
    await poll(() => optionLabels().length, 'one match through the custom rule').toBe(1);
    expect(optionLabels()[0]).toContain('موعد جديد');
    expect(normalise).toHaveBeenCalled();
    await screen.unmount();
  });

  it('moves the active option with the arrows and runs it with Enter, then closes', async () => {
    const onAction = vi.fn();
    const { input, screen, trigger } = await open(dir, <Palette onAction={onAction} />);
    await poll(() => document.activeElement, 'focus in the field').toBe(input);
    await userEvent.keyboard('{ArrowDown}');
    const active = () =>
      document.getElementById(input.getAttribute('aria-activedescendant') ?? '')?.textContent;
    await poll(active, 'second option active').toContain(p1.name);
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledWith('p-1');
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'focus back on the trigger').toBe(trigger);
    await screen.unmount();
  });

  it('shows the empty state when nothing matches', async () => {
    const { input, screen } = await open(dir);
    await typeArabic(input, 'زينب');
    await poll(() => optionLabels().length, 'no match').toBe(0);
    await expect.element(screen.getByText('لا نتائج لـ «زينب»')).toBeVisible();
    await screen.unmount();
  });

  it('Escape closes it and focus returns to the trigger', async () => {
    const { screen, trigger } = await open(dir);
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await poll(() => document.activeElement, 'focus back on the trigger').toBe(trigger);
    await screen.unmount();
  });

  it('is clean under axe while open, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const screen = await renderDir(<Palette />, { dir, theme });
      await userEvent.click(screen.getByRole('button', { name: 'بحث' }));
      await expect.element(screen.getByRole('dialog')).toBeVisible();
      await expectAxeClean(document.body);
      await userEvent.keyboard('{Escape}');
      await userEvent.keyboard('{Escape}');
      await screen.unmount();
    }
  });
});
