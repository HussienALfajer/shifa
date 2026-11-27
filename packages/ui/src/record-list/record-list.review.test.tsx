// RecordList review fixes (A-03-12 reviewer): a tool that moves its row keeps the keyboard's focus,
// also when it reaches an end; ↑ ↓ cross link, button and locked rows, landing on a button row's
// first enabled control; the footer is after the list, not in it.
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { people } from '../../test/fixtures.ts';
import { renderDir } from '../../test/support/index.ts';
import { RecordList, type RecordListItem } from './record-list.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const [A, B, C] = people(3, { seed: 52 }).map((p) => p.name);

function Fields() {
  const [order, setOrder] = useState(['f1', 'f2', 'f3']);
  const move = (id: string, by: -1 | 1) => {
    setOrder((list) => {
      const at = list.indexOf(id);
      const next = [...list];
      const other = next[at + by];
      if (other === undefined) return list;
      next[at + by] = id;
      next[at] = other;
      return next;
    });
  };
  const items: RecordListItem[] = order.map((id, i) => ({
    id,
    icon: 'pencil',
    title: `حقل ${id}`,
    tools: [
      {
        icon: 'caret-up',
        label: `نقل ${id} للأعلى`,
        disabled: i === 0,
        onClick: () => {
          move(id, -1);
        },
      },
      {
        icon: 'caret-down',
        label: `نقل ${id} للأسفل`,
        disabled: i === order.length - 1,
        onClick: () => {
          move(id, 1);
        },
      },
    ],
    action: { label: `تعديل ${id}`, onClick: () => undefined },
  }));
  return <RecordList aria-label="حقول" layout="stack" size="sm" items={items} footer="3 حقول" />;
}

describe.each(DIRS)('RecordList review fixes in %s', (dir) => {
  it('a tool that moves its row keeps the focus, at an end too', async () => {
    const screen = await renderDir(<Fields />, { dir });
    await screen.getByRole('button', { name: 'نقل f1 للأسفل' }).click();
    const rows = () =>
      [...document.querySelectorAll('[data-slot="record-row"]')].map((r) =>
        r.getAttribute('data-id'),
      );
    expect(rows()).toEqual(['f2', 'f1', 'f3']);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('نقل f1 للأسفل');
    await userEvent.keyboard('{Enter}');
    expect(rows()).toEqual(['f2', 'f3', 'f1']);
    // Now at the end: its «down» is disabled but keeps the focus.
    const down = document.activeElement;
    expect(down?.getAttribute('aria-label')).toBe('نقل f1 للأسفل');
    expect(down?.getAttribute('aria-disabled')).toBe('true');
    await userEvent.keyboard('{Enter}');
    expect(rows()).toEqual(['f2', 'f3', 'f1']);
    await screen.unmount();
  });

  it('↑ ↓ cross link, button and locked rows; a button row takes its first enabled control', async () => {
    const screen = await renderDir(
      <RecordList
        aria-label="مختلطة"
        layout="stack"
        items={[
          { id: 'a', title: A ?? '', href: '#a' },
          { id: 'locked', locked: true, title: 'ملف مخفي' },
          {
            id: 'b',
            title: B ?? '',
            tools: [
              { icon: 'caret-up', label: 'للأعلى', disabled: true, onClick: () => undefined },
            ],
            action: { label: 'فتح الملف', onClick: () => undefined },
          },
          { id: 'c', title: C ?? '', href: '#c' },
        ]}
      />,
      { dir },
    );
    const link = screen.getByRole('link', { name: new RegExp(A ?? '') }).element() as HTMLElement;
    link.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe('فتح الملف');
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement?.getAttribute('href')).toBe('#c');
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement?.textContent).toBe('فتح الملف');
    await screen.unmount();
  });

  it('the footer is after the list, not one of its items', async () => {
    const screen = await renderDir(<Fields />, { dir });
    const list = screen.getByRole('list', { name: 'حقول' }).element();
    expect(list.textContent).not.toContain('3 حقول');
    expect(list.parentElement?.textContent).toContain('3 حقول');
    await screen.unmount();
  });
});
