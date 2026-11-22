// Review findings of slice 0.4-07 (reviewer agent, 2026-11-22), one test each:
// B2: select-all reads only the shown rows, and a selection outside them is kept and reported.
// B3: keyboard focus moving up never lands under the sticky header.
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { people } from '../../test/fixtures.ts';
import { renderDir } from '../../test/support/index.ts';
import { DataTable, type DataTableColumn } from './data-table.tsx';

interface Person {
  id: string;
  name: string;
}

const PEOPLE: Person[] = people(6, { seed: 61 });
const COLUMNS: DataTableColumn<Person>[] = [{ id: 'name', header: 'الاسم', value: (p) => p.name }];
const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1500, message });

describe('Data table review findings', () => {
  it('B2: rows narrowed away leave select-all false, and their selection is still reported', async () => {
    const onSelectedChange = vi.fn();
    function Narrowing() {
      const [rows, setRows] = useState(PEOPLE);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setRows(PEOPLE.slice(2));
            }}
          >
            تضييق
          </button>
          <DataTable
            aria-label="قائمة"
            columns={COLUMNS}
            rows={rows}
            getRowId={(p) => p.id}
            selectable
            onSelectedChange={onSelectedChange}
          />
        </>
      );
    }
    const screen = await renderDir(<Narrowing />);
    const first = PEOPLE[0]?.id ?? '';
    await userEvent.click(
      screen.getByRole('checkbox', { name: `تحديد ${PEOPLE[0]?.name ?? ''}` }),
      {
        force: true,
      },
    );
    await userEvent.click(screen.getByRole('button', { name: 'تضييق' }));
    const all = screen.getByRole('checkbox', { name: 'تحديد كل الصفوف' }).element();
    await poll(() => all.getAttribute('aria-checked'), 'none of the shown rows').toBe('false');
    await userEvent.click(
      screen.getByRole('checkbox', { name: `تحديد ${PEOPLE[2]?.name ?? ''}` }),
      {
        force: true,
      },
    );
    expect(onSelectedChange).toHaveBeenLastCalledWith([PEOPLE[2]?.id, first]);
    await screen.unmount();
  });

  it('B3: ArrowUp past the top of the view keeps the focused row below the header', async () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({
      id: String(i),
      name: PEOPLE[i % PEOPLE.length]?.name ?? '',
    }));
    const screen = await renderDir(
      <DataTable aria-label="قائمة طويلة" columns={COLUMNS} rows={rows} getRowId={(p) => p.id} />,
    );
    await userEvent.tab();
    for (let i = 0; i < 25; i++) await userEvent.keyboard('{ArrowDown}');
    for (let i = 0; i < 20; i++) await userEvent.keyboard('{ArrowUp}');
    const header = document.querySelector('[role="row"][aria-rowindex="1"]');
    if (header === null) throw new Error('no header row');
    await poll(() => {
      const row = document.activeElement?.closest('[role="row"]');
      return (row?.getBoundingClientRect().top ?? 0) >= header.getBoundingClientRect().bottom - 1;
    }, 'focused row below the header').toBe(true);
    await screen.unmount();
  });
});
