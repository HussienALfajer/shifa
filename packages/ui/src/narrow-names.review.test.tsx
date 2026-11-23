// Review finding B1 of slice 0.4-12 (reviewer agent, 2026-11-23): the tooltip that shows a cut
// table header or toolbar label repeats the trigger's own name, so it must name the trigger (as
// an icon button's label tooltip does), never describe it: a screen reader hears the name once,
// whether the text is cut or not.
import { describe, expect, it } from 'vitest';
import { people } from '../test/fixtures.ts';
import { renderDir } from '../test/support/index.ts';
import { DataTable, type DataTableColumn } from './data-table/data-table.tsx';
import { Toolbar, ToolbarButton } from './toolbar/toolbar.tsx';

const LONG = 'تاريخ آخر زيارة للعيادة مع الطبيب المعالج';
const LONG_LABEL = 'تصدير قائمة المرضى المسجلين هذا الأسبوع';

interface Row {
  id: string;
  name: string;
}
const ROWS: Row[] = people(2, { seed: 71 });
const COLUMNS: DataTableColumn<Row>[] = [
  { id: 'name', header: 'الاسم', value: (p) => p.name, width: 'lg', sortable: true },
  { id: 'visit', header: LONG, value: () => '10/11/2026', width: 'sm' },
];

/** The trigger names itself once: no description, and every name reference says the label. */
function expectNamedOnce(el: Element, label: string) {
  expect(el.getAttribute('aria-describedby'), 'no description').toBeNull();
  for (const id of (el.getAttribute('aria-labelledby') ?? '').split(' ').filter(Boolean)) {
    expect(document.getElementById(id)?.textContent.trim(), 'labelled by its own text').toBe(label);
  }
}

describe.each(['rtl', 'ltr'] as const)('a cut or whole label is said once in %s', (dir) => {
  it('table headers', async () => {
    const screen = await renderDir(
      <div style={{ width: 480 }}>
        <DataTable aria-label="قائمة" columns={COLUMNS} rows={ROWS} getRowId={(p) => p.id} />
      </div>,
      { dir },
    );
    expectNamedOnce(screen.getByRole('columnheader', { name: 'الاسم' }).element(), 'الاسم');
    expectNamedOnce(screen.getByRole('columnheader', { name: LONG }).element(), LONG);
    await screen.unmount();
  });

  it('toolbar buttons', async () => {
    const screen = await renderDir(
      <div style={{ width: 900 }}>
        <Toolbar aria-label="أدوات">
          <ToolbarButton icon="list">{LONG_LABEL}</ToolbarButton>
          <ToolbarButton>طباعة</ToolbarButton>
        </Toolbar>
      </div>,
      { dir },
    );
    expectNamedOnce(screen.getByRole('button', { name: 'طباعة' }).element(), 'طباعة');
    expectNamedOnce(screen.getByRole('button', { name: LONG_LABEL }).element(), LONG_LABEL);
    await screen.unmount();
  });
});
