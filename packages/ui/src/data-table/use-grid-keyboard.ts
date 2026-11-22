// The keyboard model of the data table (slice 0.4-07; the APG data grid pattern, owner-approved
// sheet 2026-11-22). One Tab stop: the active cell has tabindex 0, every other cell -1. The
// arrows move it in the reading direction (Left is the next column in Arabic), Home and End reach
// the row's ends, Ctrl+Home and Ctrl+End the table's, PageUp and PageDown a visible page; Space
// selects the row, Enter sorts on a header, enters a control in a cell (Escape comes back) or runs
// the row action. Rows are counted with the header as row 0; data row i is row i + 1.
import { type KeyboardEvent, type RefObject, useCallback, useState } from 'react';

export interface Cell {
  row: number;
  col: number;
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([data-cell])';

export interface GridKeyboardOptions {
  grid: RefObject<HTMLElement | null>;
  /** Data rows (the header is extra). */
  rowCount: number;
  colCount: number;
  /** Rows that fit in the scroll box, for PageUp and PageDown. */
  pageSize: () => number;
  /** Brings data row `index` into view so its cells exist (virtualised rows). */
  scrollToRow: (index: number) => void;
  onSpace: (cell: Cell) => void;
  onEnter: (cell: Cell, element: HTMLElement) => void;
}

/** The element of `cell`, when its row is drawn. */
export function cellElement(grid: HTMLElement | null, cell: Cell): HTMLElement | null {
  return (
    grid?.querySelector<HTMLElement>(
      `[data-cell][data-row="${String(cell.row)}"][data-col="${String(cell.col)}"]`,
    ) ?? null
  );
}

/** The first control inside a cell, if it holds one. */
export function controlIn(element: HTMLElement): HTMLElement | null {
  return element.querySelector<HTMLElement>(FOCUSABLE);
}

export function useGridKeyboard({
  grid,
  rowCount,
  colCount,
  pageSize,
  scrollToRow,
  onSpace,
  onEnter,
}: GridKeyboardOptions) {
  const [active, setActive] = useState<Cell>({ row: 0, col: 0 });
  const lastRow = rowCount;
  const lastCol = Math.max(0, colCount - 1);
  const clamp = useCallback(
    (cell: Cell): Cell => ({
      row: Math.min(Math.max(0, cell.row), lastRow),
      col: Math.min(Math.max(0, cell.col), lastCol),
    }),
    [lastRow, lastCol],
  );

  /** Makes `cell` active and focuses it, scrolling its row in first when it is not drawn. */
  const moveTo = useCallback(
    (target: Cell) => {
      const cell = clamp(target);
      setActive(cell);
      const focus = (tries: number) => {
        const element = cellElement(grid.current, cell);
        if (element !== null) {
          element.focus({ preventScroll: false });
          return;
        }
        if (tries > 0)
          requestAnimationFrame(() => {
            focus(tries - 1);
          });
      };
      if (cell.row > 0) scrollToRow(cell.row - 1);
      focus(10);
    },
    [clamp, grid, scrollToRow],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      const element = target.closest<HTMLElement>('[data-cell]');
      if (element === null) return;
      // Inside a control of a cell: keys are the control's, Escape comes back to the cell.
      if (target !== element) {
        if (event.key === 'Escape') {
          event.preventDefault();
          element.focus();
        }
        return;
      }
      const here: Cell = {
        row: Number(element.dataset['row']),
        col: Number(element.dataset['col']),
      };
      const rtl = getComputedStyle(element).direction === 'rtl';
      const ctrl = event.ctrlKey || event.metaKey;
      let next: Cell;
      switch (event.key) {
        case 'ArrowRight':
          next = { ...here, col: here.col + (rtl ? -1 : 1) };
          break;
        case 'ArrowLeft':
          next = { ...here, col: here.col + (rtl ? 1 : -1) };
          break;
        case 'ArrowDown':
          next = { ...here, row: here.row + 1 };
          break;
        case 'ArrowUp':
          next = { ...here, row: here.row - 1 };
          break;
        case 'Home':
          next = ctrl ? { row: 0, col: 0 } : { ...here, col: 0 };
          break;
        case 'End':
          next = ctrl ? { row: lastRow, col: lastCol } : { ...here, col: lastCol };
          break;
        case 'PageDown':
          next = { ...here, row: here.row === 0 ? 1 : here.row + pageSize() };
          break;
        case 'PageUp':
          next = { ...here, row: Math.max(here.row === 0 ? 0 : 1, here.row - pageSize()) };
          break;
        case ' ':
          event.preventDefault();
          onSpace(here);
          return;
        case 'Enter':
          event.preventDefault();
          onEnter(here, element);
          return;
        default:
          return;
      }
      event.preventDefault();
      moveTo(next);
    },
    [lastRow, lastCol, moveTo, onEnter, onSpace, pageSize],
  );

  /** A cell focused by a press or by Tab becomes the active one. */
  const onFocus = useCallback((event: { target: EventTarget }) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-cell]');
    if (element === null) return;
    const row = Number(element.dataset['row']);
    const col = Number(element.dataset['col']);
    setActive((prev) => (prev.row === row && prev.col === col ? prev : { row, col }));
  }, []);

  return { active: clamp(active), onKeyDown, onFocus, moveTo };
}
