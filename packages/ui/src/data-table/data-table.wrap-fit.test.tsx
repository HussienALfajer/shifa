// Data table wrapping column, its width (found on the first screenshot, A-02 components): the
// wrapping text never widens the table. In a box wide enough for every column's minimum, the grid
// fits the box (no sideways scroll) and each line of the wrapped text is inside its cell; in a
// wide box the one-line cells keep their whole text.
import { describe, expect, it } from 'vitest';
import { people } from '../../test/fixtures.ts';
import { renderDir } from '../../test/support/index.ts';
import { DataTable, type DataTableColumn } from './data-table.tsx';

const DIRS = ['rtl', 'ltr'] as const;
const NAMES = people(3, { seed: 61 }).map((p) => p.name);
const LONG =
  'المالك لا يرى موعدًا حجزه السكرتير صباح الأحد في فرع الجميلية، بينما يظهر الموعد في شاشة السكرتير ولا يظهر في تقويم الطبيب. نريد أن نرى ما يراه المالك قبل أن نطلب منه تصوير الشاشة.';

interface Grant {
  id: string;
  who: string;
  reason: string;
  start: string;
}

const ROWS: Grant[] = [{ id: 'a', who: NAMES[0] ?? '', reason: LONG, start: '24/11/2026 09:10' }];
const COLUMNS: DataTableColumn<Grant>[] = [
  { id: 'who', header: 'من', value: (g) => g.who, width: 'md' },
  { id: 'reason', header: 'السبب', value: (g) => g.reason, wrap: true },
  { id: 'start', header: 'البداية', value: (g) => g.start },
];

describe.each(DIRS)('Data table wrapping column width in %s', (dir) => {
  it.each([900, 560])('fits a %i px box, the text inside its cell', async (width) => {
    const screen = await renderDir(
      <div style={{ width }}>
        <DataTable aria-label="سجل" columns={COLUMNS} rows={ROWS} getRowId={(g) => g.id} />
      </div>,
      { dir },
    );
    const scroll = document.querySelector<HTMLElement>('[data-slot="data-table-scroll"]');
    if (scroll === null) throw new Error('no scroll box');
    await expect.poll(() => document.querySelectorAll('[role="gridcell"]').length).toBe(3);
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth + 1);
    const [who, reason, start] = [...document.querySelectorAll<HTMLElement>('[role="gridcell"]')];
    const range = document.createRange();
    range.selectNodeContents(reason ?? document.body);
    const text = range.getBoundingClientRect();
    const box = reason?.getBoundingClientRect();
    expect(text.left).toBeGreaterThanOrEqual((box?.left ?? 0) - 1);
    expect(text.right).toBeLessThanOrEqual((box?.right ?? 0) + 1);
    // A box narrower than every column's whole text cuts the one-line cells, as the sheet does.
    for (const cell of width >= 900 ? [who, start] : []) {
      const inner = cell?.firstElementChild as HTMLElement | null;
      expect(inner?.scrollWidth ?? 0).toBeLessThanOrEqual((cell?.clientWidth ?? 0) + 1);
    }
    await screen.unmount();
  });
});
