// EditableList (A-03-01, sheet A03SheetEditableList approved by the owner 2026-11-27): a short list
// edited in place, such as a choice field's choices. A group named by its label, each row a list
// item numbered among the active ones; rename in place (Enter saves, Escape cancels) with its
// error; up and down named by the row (the ends kept focusable and marked disabled); archive and
// restore (never delete); how many charts hold each; the add line (Enter adds) with its error; the
// count against the maximum, the add line refused when full; a duplicate refused after Arabic
// folding; read-only shows no tools and no add line.
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { expectAxeClean, renderDir, tokenColor, typeArabic } from '../../test/support/index.ts';
import { EditableList, type EditableListItem } from './editable-list.tsx';

const DIRS = ['rtl', 'ltr'] as const;

/** `value`, or a failed test when it is missing. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing: ${what}`);
  return value;
}

const START: EditableListItem[] = [
  { id: 'a', label: 'طبيب آخر', use: 'في 41 ملفًا' },
  { id: 'b', label: 'صيدلية', use: 'في 12 ملفًا' },
  { id: 'c', label: 'الأهل والمعارف', use: 'في 96 ملفًا' },
  { id: 'd', label: 'جريدة', use: 'في ملفين', archived: true },
];

function Choices({
  max = 250,
  readOnly = false,
  onArchive,
}: {
  max?: number;
  readOnly?: boolean;
  onArchive?: (id: string) => void;
}) {
  const [items, setItems] = useState(START);
  const move = (id: string, by: -1 | 1) => {
    setItems((list) => {
      const active = list.filter((i) => !i.archived);
      const at = active.findIndex((i) => i.id === id);
      const to = at + by;
      const [x, y] = [active[at], active[to]];
      if (x === undefined || y === undefined) return list;
      active[at] = y;
      active[to] = x;
      return [...active, ...list.filter((i) => i.archived)];
    });
  };
  return (
    <EditableList
      label="خيارات «جهة الإحالة»"
      items={items}
      max={max}
      readOnly={readOnly}
      onMove={(id, direction) => {
        move(id, direction === 'up' ? -1 : 1);
      }}
      onRename={(id, label) => {
        setItems((list) => list.map((i) => (i.id === id ? { ...i, label } : i)));
      }}
      onArchive={(id) => {
        onArchive?.(id);
        setItems((list) => list.map((i) => (i.id === id ? { ...i, archived: true } : i)));
      }}
      onRestore={(id) => {
        setItems((list) => list.map((i) => (i.id === id ? { ...i, archived: false } : i)));
      }}
      onAdd={(label) => {
        setItems((list) => [...list, { id: label, label }]);
      }}
    />
  );
}

const rowTexts = () =>
  [...document.querySelectorAll('[role="listitem"]')].map(
    (r) => r.querySelector('[data-slot="editable-label"]')?.textContent,
  );

describe.each(DIRS)('EditableList in %s', (dir) => {
  it('a named group of numbered rows, uses shown, archived marked, the count against the max', async () => {
    const screen = await renderDir(<Choices />, { dir });
    const group = screen.getByRole('group', { name: 'خيارات «جهة الإحالة»' }).element();
    const rows = [...group.querySelectorAll('[role="listitem"]')];
    expect(rows).toHaveLength(4);
    expect(rows[0]?.querySelector('[data-slot="editable-number"]')?.textContent).toBe('1');
    expect(rows[2]?.querySelector('[data-slot="editable-number"]')?.textContent).toBe('3');
    expect(rows[3]?.querySelector('[data-slot="editable-number"]')?.textContent ?? '').toBe('');
    expect(rows[0]?.textContent).toContain('في 41 ملفًا');
    expect(rows[3]?.textContent).toContain(dir === 'rtl' ? 'مؤرشف' : 'Archived');
    expect(group.querySelector('[data-slot="editable-count"]')?.textContent).toBe(
      dir === 'rtl' ? '3 من 250' : '3 of 250',
    );
    await screen.unmount();
  });

  it('up and down named by the row; the ends stay focusable but disabled; focus follows the row', async () => {
    const screen = await renderDir(<Choices />, { dir });
    const up = (label: string) =>
      screen.getByRole('button', {
        name: dir === 'rtl' ? `نقل «${label}» للأعلى` : `Move “${label}” up`,
      });
    expect(up('طبيب آخر').element().getAttribute('aria-disabled')).toBe('true');
    await up('صيدلية').click();
    expect(rowTexts().slice(0, 2)).toEqual(['صيدلية', 'طبيب آخر']);
    const moved = up('صيدلية').element();
    expect(document.activeElement).toBe(moved);
    expect(moved.getAttribute('aria-disabled')).toBe('true');
    await userEvent.keyboard('{Enter}');
    expect(rowTexts().slice(0, 2)).toEqual(['صيدلية', 'طبيب آخر']);
    await screen.unmount();
  });

  it('rename in place: Enter saves, Escape cancels, a folded duplicate is refused', async () => {
    const screen = await renderDir(<Choices />, { dir });
    const rename = (label: string) =>
      screen.getByRole('button', {
        name: dir === 'rtl' ? `إعادة تسمية «${label}»` : `Rename “${label}”`,
      });
    await rename('صيدلية').click();
    const input = screen
      .getByRole('textbox', { name: dir === 'rtl' ? 'اسم الخيار' : 'Choice name' })
      .element() as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    await typeArabic(input, 'صيدليات');
    await userEvent.keyboard('{Escape}');
    expect(rowTexts()[1]).toBe('صيدلية');
    await rename('صيدلية').click();
    const again = screen
      .getByRole('textbox', { name: dir === 'rtl' ? 'اسم الخيار' : 'Choice name' })
      .element() as HTMLInputElement;
    // «الاهل والمعارف» folds to «الأهل والمعارف»: refused, the field keeps the text and its error.
    await typeArabic(again, 'الاهل والمعارف');
    await userEvent.keyboard('{Enter}');
    expect(again.getAttribute('aria-invalid')).toBe('true');
    expect(document.body.textContent).toContain('الأهل والمعارف');
    await typeArabic(again, 'صيدلية المدينة');
    await userEvent.keyboard('{Enter}');
    expect(rowTexts()[1]).toBe('صيدلية المدينة');
    await screen.unmount();
  });

  it('archive at once (never delete) and restore; the archived row is muted', async () => {
    const onArchive = vi.fn();
    const screen = await renderDir(<Choices onArchive={onArchive} />, { dir });
    await screen
      .getByRole('button', { name: dir === 'rtl' ? 'أرشفة «صيدلية»' : 'Archive “صيدلية”' })
      .click();
    expect(onArchive).toHaveBeenCalledWith('b');
    expect(document.querySelector('[data-slot="editable-count"]')?.textContent).toBe(
      dir === 'rtl' ? '2 من 250' : '2 of 250',
    );
    const archived = must(
      [...document.querySelectorAll<HTMLElement>('[role="listitem"]')].find((r) =>
        r.textContent.includes('جريدة'),
      ),
      'archived row',
    );
    const text = must(archived.querySelector('[data-slot="editable-label"]'), 'archived label');
    expect(getComputedStyle(text).color).toBe(tokenColor('--shifa-color-text-muted', text));
    await screen
      .getByRole('button', { name: dir === 'rtl' ? 'استعادة «جريدة»' : 'Restore “جريدة”' })
      .click();
    expect(document.querySelector('[data-slot="editable-count"]')?.textContent).toBe(
      dir === 'rtl' ? '3 من 250' : '3 of 250',
    );
    await screen.unmount();
  });

  it('the add line: Enter adds and clears; a duplicate is refused with its error', async () => {
    const screen = await renderDir(<Choices />, { dir });
    const add = screen
      .getByRole('textbox', { name: dir === 'rtl' ? 'خيار جديد' : 'New choice' })
      .element() as HTMLInputElement;
    await typeArabic(add, 'صيدليه');
    await userEvent.keyboard('{Enter}');
    expect(add.getAttribute('aria-invalid')).toBe('true');
    expect(add.value).toBe('صيدليه');
    await typeArabic(add, 'وسائل التواصل');
    await userEvent.keyboard('{Enter}');
    expect(add.value).toBe('');
    expect(rowTexts()).toContain('وسائل التواصل');
    await screen.unmount();
  });

  it('full: the count warns and the add button is disabled with the reason', async () => {
    const screen = await renderDir(<Choices max={3} />, { dir });
    const count = must(document.querySelector('[data-slot="editable-count"]'), 'count');
    expect(getComputedStyle(count).color).toBe(
      tokenColor('--shifa-color-status-warning-fg', count),
    );
    const button = screen
      .getByRole('button', { name: dir === 'rtl' ? 'إضافة' : 'Add' })
      .element() as HTMLButtonElement;
    expect(button.disabled || button.getAttribute('aria-disabled') === 'true').toBe(true);
    expect(document.body.textContent).toContain(dir === 'rtl' ? 'وصلت إلى 3' : 'reached 3');
    await screen.unmount();
  });

  it('read-only: no tools, no add line', async () => {
    const screen = await renderDir(<Choices readOnly />, { dir });
    expect(document.querySelectorAll('[role="listitem"] button')).toHaveLength(0);
    expect(document.querySelector('input')).toBeNull();
    await screen.unmount();
  });

  it('empty: the list says so and the add line stays', async () => {
    const screen = await renderDir(
      <EditableList
        label="خيارات «شركة التأمين»"
        items={[]}
        max={250}
        onAdd={() => undefined}
        addError="حقل الاختيار يحتاج خيارين على الأقل."
      />,
      { dir },
    );
    expect(document.querySelectorAll('[role="listitem"]')).toHaveLength(0);
    expect(document.body.textContent).toContain('حقل الاختيار يحتاج خيارين على الأقل.');
    expect(
      screen.getByRole('textbox', { name: dir === 'rtl' ? 'خيار جديد' : 'New choice' }).element(),
    ).toBeDefined();
    await screen.unmount();
  });

  it.each(['light', 'dark'] as const)('is axe clean in %s', async (theme) => {
    const screen = await renderDir(<Choices />, { dir, theme });
    await expectAxeClean(screen.container);
    await screen.unmount();
  });
});
