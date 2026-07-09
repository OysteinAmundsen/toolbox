/**
 * Reproduction for fillSelection over the real updateRows pipeline.
 *
 * The unit tests in clipboard.spec.ts use a mock grid without `getRowId`/
 * `updateRows`, so they only exercise the direct-write fallback. This spec
 * drives a REAL tbw-grid with EditingPlugin loaded (so paste routes through
 * `grid.updateRows(..., 'api')` → `commitCellValue`) to catch regressions in
 * the id-backed path — e.g. tiling a single copied cell across a multi-row
 * selection filling only the first row.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GridElement } from '../../../public';
import { EditingPlugin } from '../editing/EditingPlugin';
import { SelectionPlugin } from '../selection/SelectionPlugin';
import { UndoRedoPlugin } from '../undo-redo/UndoRedoPlugin';
import { ClipboardPlugin } from './ClipboardPlugin';
import { defaultPasteHandler, type PasteDetail } from './types';

async function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitUpgrade(el: HTMLElement & { ready?: () => Promise<void> }): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await el.ready?.();
  await nextFrame();
  await nextFrame();
}

describe('clipboard fillSelection over updateRows pipeline', () => {
  let grid: any;

  beforeEach(async () => {
    await import('../../core/grid');
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('tiles a single copied cell across a 3-row selection (all rows filled)', async () => {
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'terminal', header: 'Source terminal', editable: true },
      ],
      getRowId: (row: any) => String(row.id),
      plugins: [new EditingPlugin({ editOn: 'click', dirtyTracking: true })],
    };
    grid.rows = [
      { id: 1, terminal: 'Mongstad' },
      { id: 2, terminal: '' },
      { id: 3, terminal: '' },
    ];
    await waitUpgrade(grid);

    // Copy one cell ("Mongstad" from row 0), select rows 0..2 in the same
    // column, paste with fillSelection. Should tile the source into all 3 rows.
    const detail: PasteDetail = {
      rows: [['Mongstad']],
      text: 'Mongstad',
      target: { row: 0, col: 1, field: 'terminal', bounds: { endRow: 2, endCol: 1 } },
      fields: ['terminal'],
      fillSelection: true,
    };

    defaultPasteHandler(detail, grid as GridElement);
    await nextFrame();

    expect(grid._rows[0].terminal).toBe('Mongstad');
    expect(grid._rows[1].terminal).toBe('Mongstad');
    expect(grid._rows[2].terminal).toBe('Mongstad');
  });

  it('fills a 3-row selection via the real paste event (SelectionPlugin + includeHeaders)', async () => {
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'terminal', header: 'Source terminal', editable: true },
      ],
      getRowId: (row: any) => String(row.id),
      plugins: [
        new SelectionPlugin({ mode: 'range' }),
        new ClipboardPlugin({ fillSelection: true, includeHeaders: true }),
        new EditingPlugin({ editOn: 'click', dirtyTracking: true }),
      ],
    };
    grid.rows = [
      { id: 1, terminal: 'Mongstad' },
      { id: 2, terminal: '' },
      { id: 3, terminal: '' },
    ];
    await waitUpgrade(grid);

    // Select the "terminal" column across all 3 rows (from row 0 to row 2, col 1).
    const selection = grid.getPluginByName('selection') as SelectionPlugin;
    selection.setRanges([{ from: { row: 0, col: 1 }, to: { row: 2, col: 1 } }]);
    await nextFrame();

    // Copying a single cell with includeHeaders produces "Source terminal\nMongstad".
    const pasteEvent = new Event('paste', { bubbles: true }) as Event & { clipboardData: unknown };
    pasteEvent.clipboardData = { getData: () => 'Source terminal\nMongstad' };
    grid.dispatchEvent(pasteEvent);
    await nextFrame();

    expect(grid._rows[0].terminal).toBe('Mongstad');
    expect(grid._rows[1].terminal).toBe('Mongstad');
    expect(grid._rows[2].terminal).toBe('Mongstad');
  });

  it('fills when the selection is several single-cell ranges (cell-by-cell multi-select)', async () => {
    // Regression: real grids express a multi-cell selection as MANY single-cell
    // ranges (clicking/dragging cell-by-cell). The paste handler used to inspect
    // ranges[0] only → treated it as one cell → filled just the first row.
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'terminal', header: 'Source terminal', editable: true },
      ],
      getRowId: (row: any) => String(row.id),
      plugins: [
        new SelectionPlugin({ mode: 'range' }),
        new ClipboardPlugin({ fillSelection: true, includeHeaders: true }),
        new EditingPlugin({ editOn: 'click', dirtyTracking: true }),
      ],
    };
    grid.rows = [
      { id: 1, terminal: 'Mongstad' },
      { id: 2, terminal: '' },
      { id: 3, terminal: '' },
    ];
    await waitUpgrade(grid);

    // Selection stored as 3 separate single-cell ranges (with duplicates, as the
    // live grid produces), not one contiguous range.
    const selection = grid.getPluginByName('selection') as SelectionPlugin;
    selection.setRanges([
      { from: { row: 0, col: 1 }, to: { row: 0, col: 1 } },
      { from: { row: 1, col: 1 }, to: { row: 1, col: 1 } },
      { from: { row: 1, col: 1 }, to: { row: 1, col: 1 } },
      { from: { row: 2, col: 1 }, to: { row: 2, col: 1 } },
    ]);
    await nextFrame();

    const pasteEvent = new Event('paste', { bubbles: true }) as Event & { clipboardData: unknown };
    pasteEvent.clipboardData = { getData: () => 'Source terminal\nMongstad' };
    grid.dispatchEvent(pasteEvent);
    await nextFrame();

    expect(grid._rows[0].terminal).toBe('Mongstad');
    expect(grid._rows[1].terminal).toBe('Mongstad');
    expect(grid._rows[2].terminal).toBe('Mongstad');
  });

  it('does not throw when a cell-commit handler brackets each commit in a transaction', async () => {
    // Regression (TBW111): the app brackets each cell-commit with
    // beginTransaction() + queueMicrotask(endTransaction). A synchronous paste
    // batch fires N cell-commits before the microtasks run — nested begins used
    // to throw "Transaction already in progress", aborting the updateRows loop
    // so only the first cell committed. Nested transactions must coalesce.
    const undo = new UndoRedoPlugin();
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'terminal', header: 'Source terminal', editable: true },
      ],
      getRowId: (row: any) => String(row.id),
      plugins: [
        new SelectionPlugin({ mode: 'range' }),
        new ClipboardPlugin({ fillSelection: true, includeHeaders: true }),
        new EditingPlugin({ editOn: 'click', dirtyTracking: true }),
        undo,
      ],
    };
    grid.rows = [
      { id: 1, terminal: 'Mongstad' },
      { id: 2, terminal: '' },
      { id: 3, terminal: '' },
    ];
    await waitUpgrade(grid);

    // Mimic the app: bracket every cell-commit with a transaction that ends on a
    // microtask (grouping the primary edit with any cascaded ones).
    grid.addEventListener('cell-commit', () => {
      undo.beginTransaction();
      queueMicrotask(() => undo.endTransaction());
    });

    const selection = grid.getPluginByName('selection') as SelectionPlugin;
    selection.setRanges([
      { from: { row: 0, col: 1 }, to: { row: 0, col: 1 } },
      { from: { row: 1, col: 1 }, to: { row: 1, col: 1 } },
      { from: { row: 2, col: 1 }, to: { row: 2, col: 1 } },
    ]);
    await nextFrame();

    const pasteEvent = new Event('paste', { bubbles: true }) as Event & { clipboardData: unknown };
    pasteEvent.clipboardData = { getData: () => 'Source terminal\nMongstad' };
    expect(() => grid.dispatchEvent(pasteEvent)).not.toThrow();
    // Let the microtask-scheduled endTransaction() calls flush.
    await nextFrame();

    expect(grid._rows[0].terminal).toBe('Mongstad');
    expect(grid._rows[1].terminal).toBe('Mongstad');
    expect(grid._rows[2].terminal).toBe('Mongstad');
    // The whole paste coalesces into a single undo entry.
    expect(undo.getUndoStack()).toHaveLength(1);
  });
});
