// Spec 0.4 criterion 7 (slice 0.4-04): every RTL gate component has its gate test file and a
// filled row in the slice's results table, so a component cannot be added or skipped silently.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GATE_COMPONENTS } from './gate-components.ts';

const pkgDir = join(import.meta.dirname, '..');
const sliceFile = join(pkgDir, '..', '..', 'docs', 'slices', '0.4-04-rtl-gate-components.md');

/** The checks of each row, after the component's name, in the table's column order. */
const COLUMNS = ['Arrows', 'Popup side', 'Focus', 'Arabic typeahead', 'Digits', 'axe', 'Base'];

/** The rows of the "## Gate results" table: cells by column, keyed by the first cell. */
function gateRows(): Map<string, string[]> {
  const text = readFileSync(sliceFile, 'utf8');
  const section = text.split(/^## Gate results\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  const rows = new Map<string, string[]>();
  for (const line of section.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    const [first, ...rest] = cells;
    if (first !== undefined && first !== 'Component') rows.set(first, rest);
  }
  return rows;
}

describe('RTL gate results', () => {
  it.each(GATE_COMPONENTS)('$name has a gate test file', ({ dir }) => {
    expect(existsSync(join(pkgDir, 'src', dir, `${dir}.gate.test.tsx`))).toBe(true);
  });

  it.each(GATE_COMPONENTS)('$name has a filled row in the results table', ({ name }) => {
    const row = gateRows().get(name);
    expect(row, `no row for ${name}`).toBeDefined();
    expect(row).toHaveLength(COLUMNS.length);
    // Each check is pass, fail or n/a (with its reason); the base is UI SDK or a fallback.
    for (const [i, cell] of (row ?? []).entries()) {
      expect(cell, `${name}: ${COLUMNS[i] ?? '?'}`).not.toMatch(/^(—|-|)$/);
    }
    expect(row?.at(-1)).toMatch(/^(UI SDK|Base UI|react-day-picker)\b/);
  });

  it('has no row for a component outside the gate', () => {
    const names: string[] = GATE_COMPONENTS.map((c) => c.name);
    expect([...gateRows().keys()].filter((n) => !names.includes(n))).toEqual([]);
  });
});
