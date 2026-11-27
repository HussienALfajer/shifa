// Data table: a wrapping column (A-02-01, component change 1, sheet A02SheetDataTableWrap approved
// by the owner 2026-11-27). A column with `wrap: true` shows its whole text on as many lines as it
// needs and the row grows to fit; the other cells of the row stay at its top; rows keep the 48 px
// minimum (32 compact); a column without `wrap` keeps one line with an ellipsis. Sorting, selection,
// the keyboard and virtualisation behave as before, and a virtualised row's height is measured, so
// rows never overlap.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { people } from '../../test/fixtures.ts';
import { arrows, expectAxeClean, renderDir } from '../../test/support/index.ts';
import { DataTable, type DataTableColumn } from './data-table.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const NAMES = people(6, { seed: 61 }).map((p) => p.name);

interface Grant {
  id: string;
  who: string;
  reason: string;
  start: string;
  status: string;
}

const LONG =
  'المالك لا يرى موعدًا حجزه السكرتير صباح الأحد في فرع الجميلية، بينما يظهر الموعد في شاشة السكرتير ولا يظهر في تقويم الطبيب. نريد أن نرى ما يراه المالك قبل أن نطلب منه تصوير الشاشة.';
const SHORT = 'مراجعة إعداد الفروع بعد النقل';

const GRANTS: Grant[] = [
  { id: 'a', who: NAMES[0] ?? '', reason: SHORT, start: '26/11/2026 13:12', status: 'مفتوح' },
  { id: 'b', who: NAMES[1] ?? '', reason: LONG, start: '24/11/2026 09:10', status: 'انتهت المدة' },
  {
    id: 'c',
    who: NAMES[2] ?? '',
    reason: SHORT,
    start: '18/11/2026 16:02',
    status: 'أنهاه المالك',
  },
];

const COLUMNS: DataTableColumn<Grant>[] = [
  { id: 'who', header: 'من', value: (g) => g.who, sortable: true },
  { id: 'reason', header: 'السبب', value: (g) => g.reason, wrap: true },
  { id: 'start', header: 'البداية', value: (g) => g.start, sortable: true },
  { id: 'status', header: 'الحالة', value: (g) => g.status },
];

const rowOf = (index: number) =>
  document.querySelector<HTMLElement>(
    `[role="grid"] [role="row"][aria-rowindex="${String(index)}"]`,
  );
const cellsOf = (row: HTMLElement | null) => [
  ...(row?.querySelectorAll<HTMLElement>('[role="gridcell"]') ?? []),
];
const reasonCell = (row: HTMLElement | null) =>
  cellsOf(row).find((c) => c.textContent === LONG || c.textContent === SHORT) ?? null;
const height = (el: Element | null) => el?.getBoundingClientRect().height ?? 0;
const poll = (fn: () => unknown, message: string) => expect.poll(fn, { timeout: 2000, message });

function Log({ selectable = false, rows = GRANTS }: { selectable?: boolean; rows?: Grant[] }) {
  return (
    <div style={{ width: 900 }}>
      <DataTable
        aria-label="سجل دخول الدعم"
        columns={COLUMNS}
        rows={rows}
        getRowId={(g) => g.id}
        selectable={selectable}
      />
    </div>
  );
}

describe.each(DIRS)('Data table wrapping column in %s', (dir) => {
  it('shows the whole text on several lines, the row grows to fit', async () => {
    const screen = await renderDir(<Log />, { dir });
    await poll(() => rowOf(3) !== null, 'rows drawn').toBe(true);
    const cell = reasonCell(rowOf(3));
    if (cell === null) throw new Error('no reason cell');
    expect(getComputedStyle(cell).whiteSpace).toBe('normal');
    expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth + 1);
    expect(cell.scrollHeight).toBeLessThanOrEqual(cell.clientHeight + 1);
    expect(height(rowOf(3))).toBeGreaterThan(48 * 1.5);
    await screen.unmount();
  });

  it('a short row keeps the 48 px minimum, and rows follow each other without overlap', async () => {
    const screen = await renderDir(<Log />, { dir });
    await poll(() => rowOf(4) !== null, 'rows drawn').toBe(true);
    expect(Math.round(height(rowOf(2)))).toBe(48);
    await poll(() => {
      const long = rowOf(3)?.getBoundingClientRect();
      const next = rowOf(4)?.getBoundingClientRect();
      return long !== undefined && next !== undefined && Math.abs(next.top - long.bottom) < 1;
    }, 'the row after the long one starts at its bottom').toBe(true);
    await screen.unmount();
  });

  it('keeps the 32 px minimum in compact', async () => {
    const screen = await renderDir(<Log />, { dir, density: 'compact' });
    await poll(() => rowOf(2) !== null, 'rows drawn').toBe(true);
    expect(Math.round(height(rowOf(2)))).toBe(32);
    expect(height(rowOf(3))).toBeGreaterThan(32 * 1.5);
    await screen.unmount();
  });

  it('the other cells stay at the top of the row, filling its height', async () => {
    const screen = await renderDir(<Log selectable />, { dir });
    await poll(() => rowOf(3) !== null, 'rows drawn').toBe(true);
    const row = rowOf(3);
    const rowBox = row?.getBoundingClientRect();
    const reason = reasonCell(row);
    for (const cell of cellsOf(row)) {
      const box = cell.getBoundingClientRect();
      // Every cell fills the row, so hover and selection tint the whole row.
      expect(Math.round(box.height)).toBe(Math.round(rowBox?.height ?? 0));
      if (cell === reason) continue;
      const content = cell.firstElementChild ?? cell;
      const range = document.createRange();
      range.selectNodeContents(content);
      const top = range.getBoundingClientRect().top - box.top;
      expect(top).toBeLessThan(24);
    }
    await screen.unmount();
  });

  it('a column without wrap keeps one line with an ellipsis', async () => {
    const screen = await renderDir(<Log />, { dir });
    await poll(() => rowOf(3) !== null, 'rows drawn').toBe(true);
    const status = cellsOf(rowOf(3)).at(-1);
    if (status === undefined) throw new Error('no status cell');
    expect(getComputedStyle(status).whiteSpace).toBe('nowrap');
    await screen.unmount();
  });

  it('the wrapping column takes the widest share of the row', async () => {
    const screen = await renderDir(<Log />, { dir });
    await poll(() => rowOf(2) !== null, 'rows drawn').toBe(true);
    const widths = cellsOf(rowOf(2)).map((c) => c.getBoundingClientRect().width);
    const reason = widths[1] ?? 0;
    for (const [i, w] of widths.entries()) if (i !== 1) expect(reason).toBeGreaterThan(w);
    await screen.unmount();
  });

  it('the keyboard and sorting work as before', async () => {
    const screen = await renderDir(<Log />, { dir });
    await userEvent.tab();
    const { forward } = arrows(dir);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(document.activeElement?.closest('[role="row"]')?.getAttribute('aria-rowindex')).toBe(
      '3',
    );
    await userEvent.keyboard(`{${forward}}`);
    expect(document.activeElement?.textContent).toBe(LONG);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement?.textContent).toBe(SHORT);
    await userEvent.keyboard('{Control>}{Home}{/Control}{Enter}');
    expect(
      screen.getByRole('columnheader', { name: 'من' }).element().getAttribute('aria-sort'),
    ).toBe('ascending');
    // After the reorder, every row is measured again: the long one is tall, its neighbours touch it.
    await poll(() => {
      const shown = [2, 3, 4].map(rowOf);
      const long = shown.find((r) => reasonCell(r)?.textContent === LONG) ?? null;
      const touching = shown.every((row, i) => {
        const next = shown[i + 1];
        if (next === undefined || next === null || row === null) return true;
        return Math.abs(next.getBoundingClientRect().top - row.getBoundingClientRect().bottom) < 1;
      });
      return height(long) > 72 && touching;
    }, 'rows measured after sorting').toBe(true);
    await screen.unmount();
  });

  it('2,000 wrapping rows: bounded DOM rows, no overlap, Ctrl+End reaches the last', async () => {
    const many = Array.from({ length: 2000 }, (_, i) => ({
      ...(GRANTS[i % 3] ?? GRANTS[0]),
      id: String(i),
    })) as Grant[];
    const screen = await renderDir(<Log rows={many} />, { dir });
    await poll(() => rowOf(4) !== null, 'rows drawn').toBe(true);
    expect(document.querySelectorAll('[role="grid"] [role="row"]').length).toBeLessThan(100);
    await poll(() => {
      const shown = [...document.querySelectorAll('[role="grid"] [role="row"]')].slice(1);
      return shown.every((row, i) => {
        const next = shown[i + 1];
        if (next === undefined) return true;
        return Math.abs(next.getBoundingClientRect().top - row.getBoundingClientRect().bottom) < 1;
      });
    }, 'drawn rows touch, never overlap').toBe(true);
    await userEvent.tab();
    await userEvent.keyboard('{Control>}{End}{/Control}');
    await poll(
      () => document.activeElement?.closest('[role="row"]')?.getAttribute('aria-rowindex'),
      'last row focused',
    ).toBe('2001');
    await screen.unmount();
  });

  it.each(['light', 'dark'] as const)('is axe clean in %s', async (theme) => {
    const screen = await renderDir(<Log selectable />, { dir, theme });
    await poll(() => rowOf(3) !== null, 'rows drawn').toBe(true);
    await expectAxeClean(screen.container);
    await screen.unmount();
  });
});
