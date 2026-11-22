// Data table (slice 0.4-07), as the owner approved the sheet on 2026-11-22 (OD-64): a grid
// (role="grid") with one Tab stop on the active cell. The arrows move the active cell in the
// reading direction (Left is the next column in Arabic), Home and End reach the row's ends,
// Ctrl+Home and Ctrl+End the table's, PageUp and PageDown a visible page; Space selects the row,
// Enter runs the row action (or sorts on a sortable header, or enters a control in a cell, left
// with Escape). Sorting shows in aria-sort; select-all has a mixed state; a hidden column leaves
// the DOM; the first column is pinned on the logical start; numbers are end-aligned with tabular
// digits; loading shows skeleton rows and an empty table shows the empty state.
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { people } from '../../test/fixtures.ts';
import { arrows, expectAxeClean, renderDir } from '../../test/support/index.ts';
import { DataTable, type DataTableColumn, type DataTableSort } from './data-table.tsx';

const DIRS = ['rtl', 'ltr'] as const;

interface Patient {
  id: string;
  name: string;
  file: string;
  visit: string;
  balance: number;
}

const PATIENTS: Patient[] = people(8, { seed: 41 }).map((p, i) => ({
  id: p.id,
  name: p.name,
  file: `P-${String(10400 + i * 37)}`,
  visit: `${String(10 + i)}/11/2026`,
  balance: [0, 45000, 0, 120000, 0, 15500, 1250000, 0][i] ?? 0,
}));

const COLUMNS: DataTableColumn<Patient>[] = [
  { id: 'name', header: 'الاسم', value: (p) => p.name, sortable: true, hideable: false },
  { id: 'file', header: 'رقم الملف', value: (p) => p.file, kind: 'latin' },
  { id: 'visit', header: 'آخر زيارة', value: (p) => p.visit, sortable: true },
  {
    id: 'balance',
    header: 'الرصيد (ل.س)',
    value: (p) => p.balance,
    kind: 'number',
    sortable: true,
  },
  {
    id: 'open',
    header: 'الملف',
    cell: (p) => <a href={`#patient-${p.id}`}>فتح</a>,
  },
];

function Patients({
  onRowAction,
  onSortChange,
  onSelectedChange,
  rows = PATIENTS,
  loading,
  defaultHiddenColumns,
}: {
  onRowAction?: (row: Patient) => void;
  onSortChange?: (sort: DataTableSort | null) => void;
  onSelectedChange?: (ids: string[]) => void;
  rows?: Patient[];
  loading?: boolean;
  defaultHiddenColumns?: string[];
}) {
  const [sort, setSort] = useState<DataTableSort | null>(null);
  return (
    <DataTable
      aria-label="قائمة المرضى"
      columns={COLUMNS}
      rows={rows}
      getRowId={(p) => p.id}
      selectable
      sort={sort}
      onSortChange={(next) => {
        setSort(next);
        onSortChange?.(next);
      }}
      {...(onSelectedChange === undefined ? {} : { onSelectedChange })}
      {...(onRowAction === undefined ? {} : { onRowAction })}
      {...(loading === undefined ? {} : { loading })}
      {...(defaultHiddenColumns === undefined ? {} : { defaultHiddenColumns })}
      empty={{ title: 'لا مرضى بهذا الاسم', description: 'جرّب رقم الهاتف أو رقم الملف.' }}
    />
  );
}

const grid = () => {
  const el = document.querySelector('[role="grid"]');
  if (el === null) throw new Error('no grid');
  return el as HTMLElement;
};
/** The cell at (row, column) of the rendered rows, the header being row 0. */
const cell = (row: number, col: number): HTMLElement => {
  const rows = [...grid().querySelectorAll<HTMLElement>('[role="row"]')];
  const r = rows[row];
  const c = r?.querySelectorAll<HTMLElement>('[role="gridcell"], [role="columnheader"]')[col];
  if (c === undefined) throw new Error(`no cell ${String(row)},${String(col)}`);
  return c;
};
const active = () => document.activeElement;
const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 1000, message });
const rowOf = (el: Element | null) => el?.closest('[role="row"]');

describe.each(DIRS)('Data table in %s', (dir) => {
  it('is a named grid with one Tab stop', async () => {
    const screen = await renderDir(<Patients />, { dir });
    expect(screen.getByRole('grid', { name: 'قائمة المرضى' }).element()).toBeTruthy();
    const stops = [...grid().querySelectorAll('[tabindex="0"]')];
    expect(stops).toHaveLength(1);
    await userEvent.tab();
    expect(grid().contains(active())).toBe(true);
    await userEvent.tab();
    expect(grid().contains(active())).toBe(false);
    await screen.unmount();
  });

  it('the arrows move the active cell in the reading direction', async () => {
    const screen = await renderDir(<Patients />, { dir });
    const { forward, backward } = arrows(dir);
    cell(1, 1).focus();
    await userEvent.keyboard(`{${forward}}`);
    await poll(active, 'next column').toBe(cell(1, 2));
    await userEvent.keyboard(`{${backward}}`);
    await poll(active, 'back').toBe(cell(1, 1));
    await userEvent.keyboard('{ArrowDown}');
    await poll(active, 'next row').toBe(cell(2, 1));
    await userEvent.keyboard('{ArrowUp}');
    await poll(active, 'previous row').toBe(cell(1, 1));
    // The next column is to the left in Arabic, to the right in English.
    const a = cell(1, 1).getBoundingClientRect();
    const b = cell(1, 2).getBoundingClientRect();
    if (dir === 'rtl') expect(b.left).toBeLessThan(a.left);
    else expect(b.left).toBeGreaterThan(a.left);
    // The moved-from cell leaves the Tab order.
    expect(cell(1, 2).getAttribute('tabindex')).toBe('-1');
    await screen.unmount();
  });

  it('Home and End reach the row’s ends; Ctrl+Home and Ctrl+End the table’s', async () => {
    const screen = await renderDir(<Patients />, { dir });
    const last = COLUMNS.length; // the selection column comes first
    cell(3, 2).focus();
    await userEvent.keyboard('{End}');
    await poll(active, 'End').toBe(cell(3, last));
    await userEvent.keyboard('{Home}');
    await poll(active, 'Home').toBe(cell(3, 0));
    await userEvent.keyboard('{Control>}{End}{/Control}');
    await poll(active, 'Ctrl+End').toBe(cell(PATIENTS.length, last));
    await userEvent.keyboard('{Control>}{Home}{/Control}');
    await poll(active, 'Ctrl+Home').toBe(cell(0, 0));
    await screen.unmount();
  });

  it('PageDown and PageUp move by a visible page, and stop at the ends', async () => {
    const screen = await renderDir(<Patients />, { dir });
    cell(1, 1).focus();
    await userEvent.keyboard('{PageDown}');
    await poll(() => rowOf(active()) !== rowOf(cell(1, 1)), 'moved down').toBe(true);
    await userEvent.keyboard('{PageDown}{PageDown}{PageDown}');
    await poll(active, 'last row').toBe(cell(PATIENTS.length, 1));
    await userEvent.keyboard('{PageUp}{PageUp}{PageUp}{PageUp}');
    await poll(active, 'first data row').toBe(cell(1, 1));
    await screen.unmount();
  });

  it('sorts from the header: aria-sort and the callback', async () => {
    const onSortChange = vi.fn();
    const screen = await renderDir(<Patients onSortChange={onSortChange} />, { dir });
    const header = screen.getByRole('columnheader', { name: /آخر زيارة/ }).element();
    expect(header.getAttribute('aria-sort')).toBe('none');
    await userEvent.click(screen.getByRole('button', { name: /آخر زيارة/ }));
    expect(onSortChange).toHaveBeenLastCalledWith({ columnId: 'visit', direction: 'ascending' });
    await poll(() => header.getAttribute('aria-sort'), 'ascending').toBe('ascending');
    // Enter on the header sorts the other way.
    (header as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    expect(onSortChange).toHaveBeenLastCalledWith({ columnId: 'visit', direction: 'descending' });
    await poll(() => header.getAttribute('aria-sort'), 'descending').toBe('descending');
    // A column that cannot sort has no aria-sort and no button.
    const file = screen.getByRole('columnheader', { name: 'رقم الملف' }).element();
    expect(file.hasAttribute('aria-sort')).toBe(false);
    expect(file.querySelector('button')).toBeNull();
    await screen.unmount();
  });

  it('sorts its own rows when the caller does not', async () => {
    const screen = await renderDir(<Patients />, { dir });
    await userEvent.click(screen.getByRole('button', { name: /الرصيد/ }));
    await userEvent.click(screen.getByRole('button', { name: /الرصيد/ }));
    await poll(() => cell(1, 4).textContent, 'largest first').toBe('1,250,000');
    await screen.unmount();
  });

  it('Space selects the row; select-all has a mixed state', async () => {
    const onSelectedChange = vi.fn();
    const screen = await renderDir(<Patients onSelectedChange={onSelectedChange} />, { dir });
    cell(2, 1).focus();
    await userEvent.keyboard(' ');
    expect(onSelectedChange).toHaveBeenLastCalledWith([PATIENTS[1]?.id]);
    await poll(() => rowOf(cell(2, 1))?.getAttribute('aria-selected'), 'selected').toBe('true');
    const all = screen.getByRole('checkbox', { name: 'تحديد كل الصفوف' }).element();
    await poll(() => all.getAttribute('aria-checked'), 'mixed').toBe('mixed');
    await userEvent.click(all, { force: true });
    await poll(() => all.getAttribute('aria-checked'), 'all').toBe('true');
    expect(onSelectedChange).toHaveBeenLastCalledWith(PATIENTS.map((p) => p.id));
    await userEvent.click(all, { force: true });
    await poll(() => all.getAttribute('aria-checked'), 'none').toBe('false');
    await screen.unmount();
  });

  it('Enter and a press on the row run the row action', async () => {
    const onRowAction = vi.fn();
    const screen = await renderDir(<Patients onRowAction={onRowAction} />, { dir });
    cell(3, 2).focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowAction).toHaveBeenLastCalledWith(PATIENTS[2]);
    await userEvent.click(cell(4, 3));
    expect(onRowAction).toHaveBeenLastCalledWith(PATIENTS[3]);
    await screen.unmount();
  });

  it('a control in a cell: Enter goes in, Escape comes back', async () => {
    const onRowAction = vi.fn();
    const screen = await renderDir(<Patients onRowAction={onRowAction} />, { dir });
    const linkCell = cell(1, 5);
    const link = linkCell.querySelector('a');
    if (link === null) throw new Error('no link');
    // The link is not a second Tab stop.
    expect(link.getAttribute('tabindex')).toBe('-1');
    linkCell.focus();
    await userEvent.keyboard('{Enter}');
    await poll(active, 'inside the cell').toBe(link);
    expect(onRowAction).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await poll(active, 'back on the cell').toBe(linkCell);
    await screen.unmount();
  });

  it('a hidden column leaves the DOM; the columns menu brings it back', async () => {
    const screen = await renderDir(<Patients defaultHiddenColumns={['file']} />, { dir });
    expect(document.body.textContent.includes('رقم الملف')).toBe(false);
    expect(grid().getAttribute('aria-colcount')).toBe(String(COLUMNS.length));
    await userEvent.click(screen.getByRole('button', { name: 'الأعمدة' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'رقم الملف' }));
    await poll(
      () => document.querySelector('[role="grid"]')?.textContent.includes('رقم الملف'),
      'shown again',
    ).toBe(true);
    // A column that cannot hide is not offered.
    expect(document.querySelector('[role="checkbox"][aria-label="الاسم"]')).toBeNull();
    await screen.unmount();
  });

  it('the first column is pinned on the logical start', async () => {
    const screen = await renderDir(
      <div className="w-(--shifa-size-popover)">
        <Patients />
      </div>,
      { dir },
    );
    const nameCell = cell(1, 1);
    expect(getComputedStyle(nameCell).position).toBe('sticky');
    const box = grid().getBoundingClientRect();
    const scroller = grid().closest<HTMLElement>('[data-slot="data-table-scroll"]');
    if (scroller === null) throw new Error('no scroll box');
    scroller.scrollLeft = dir === 'rtl' ? -400 : 400;
    await poll(() => {
      const r = nameCell.getBoundingClientRect();
      return dir === 'rtl'
        ? r.right <= box.right + 1 && r.right > box.left
        : r.left >= box.left - 1;
    }, 'still at the start edge').toBe(true);
    await screen.unmount();
  });

  it('numbers are end-aligned with tabular digits; Latin cells are isolated', async () => {
    const screen = await renderDir(<Patients />, { dir });
    const balance = cell(2, 4);
    expect(balance.textContent).toBe('45,000');
    const style = getComputedStyle(balance);
    expect(style.fontVariantNumeric).toContain('tabular-nums');
    expect(style.justifyContent === 'flex-end' || style.textAlign === 'end').toBe(true);
    expect(cell(1, 2).querySelector('bdi')?.textContent).toBe(PATIENTS[0]?.file);
    await screen.unmount();
  });

  it('loading: busy with skeleton rows; empty: the empty state under the header', async () => {
    const loading = await renderDir(<Patients loading />, { dir });
    expect(grid().getAttribute('aria-busy')).toBe('true');
    expect(grid().querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    await loading.unmount();
    const empty = await renderDir(<Patients rows={[]} />, { dir });
    expect(empty.getByRole('heading', { name: 'لا مرضى بهذا الاسم' }).element()).toBeTruthy();
    expect(empty.getByRole('columnheader', { name: /الاسم/ }).element()).toBeTruthy();
    await empty.unmount();
  });

  it('is clean under axe, light and dark, both densities', async () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const density of ['comfortable', 'compact'] as const) {
        const screen = await renderDir(<Patients />, { dir, theme, density });
        await expectAxeClean(document.body);
        await screen.unmount();
      }
    }
  });
});
