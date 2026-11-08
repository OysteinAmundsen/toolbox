/**
 * ColumnVirtualization × Selection / Clipboard / focus (#633).
 *
 * `data-col` and `_focusCol` index the RENDERED column window. Selection state and its public
 * `col` coordinates index every visible column instead, and `_focusCol` follows its column when
 * the window moves, so neither drifts to another column on a horizontal scroll.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { BaseGridPlugin } from '../../lib/core/plugin/base-plugin';
import type { ColumnConfig } from '../../lib/core/types';
import { ClipboardPlugin } from '../../lib/plugins/clipboard/clipboard-plugin';
import { ColumnVirtualizationPlugin } from '../../lib/plugins/column-virtualization/column-virtualization-plugin';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';
import { SelectionPlugin } from '../../lib/plugins/selection/selection-plugin';
import type { SelectionConfig } from '../../lib/plugins/selection/types';

const COLUMN_COUNT = 180;

function makeColumns(): ColumnConfig[] {
  return Array.from({ length: COLUMN_COUNT }, (_, i) => ({ field: `c${i}`, header: `C${i}`, width: 100 }));
}

async function setup(
  selectionConfig: SelectionConfig = { mode: 'range' },
  columns = makeColumns(),
  others: BaseGridPlugin[] = [],
  virtualization = new ColumnVirtualizationPlugin(),
  rowCount = 2,
) {
  const grid = createGrid();
  Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 800 });
  const selection = new SelectionPlugin(selectionConfig);
  const clipboard = new ClipboardPlugin();
  grid.gridConfig = { columns, fitMode: 'fixed', plugins: [virtualization, ...others, selection, clipboard] };
  grid.rows = Array.from({ length: rowCount }, (_, r) =>
    Object.fromEntries(columns.map((c) => [c.field, `${c.field}-v${r}`])),
  );
  await waitUpgrade(grid);
  const scrollTo = async (scrollLeft: number) => {
    virtualization.onScroll({
      scrollTop: 0,
      scrollLeft,
      scrollHeight: 0,
      scrollWidth: COLUMN_COUNT * 100,
      clientHeight: 0,
      clientWidth: 800,
    });
    await waitUpgrade(grid);
  };
  const copy = () => clipboard.getSelectionAsText({ includeHeaders: false });
  const renderedIndex = (field: string) => grid._visibleColumns.findIndex((c) => c.field === field);
  const cell = (row: number, field: string) =>
    grid.querySelector<HTMLElement>(`.rows .data-grid-row > .cell[data-row="${row}"][data-field="${field}"]`);
  return { grid, virtualization, selection, clipboard, scrollTo, copy, renderedIndex, cell };
}

function key(grid: HTMLElement, init: KeyboardEventInit) {
  grid.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

describe('ColumnVirtualization × selection ranges (#633)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps a range on its column and copies it after a horizontal scroll', async () => {
    const { selection, scrollTo, copy, cell, grid } = await setup();
    selection.setRanges([{ from: { row: 0, col: 2 }, to: { row: 0, col: 2 } }]);
    await waitUpgrade(grid);
    expect(copy()).toBe('c2-v0');
    expect(cell(0, 'c2')?.classList.contains('selected')).toBe(true);

    await scrollTo(5_000);
    expect(cell(0, 'c2')).toBeNull();
    expect(copy()).toBe('c2-v0');
    expect(grid.querySelectorAll('.rows .cell.selected')).toHaveLength(0);

    await scrollTo(0);
    expect(cell(0, 'c2')?.classList.contains('selected')).toBe(true);
  });

  it('selectAll() spans every column, not just the rendered window', async () => {
    const { selection, copy, grid } = await setup();
    expect(grid._visibleColumns.length).toBeLessThan(COLUMN_COUNT);

    selection.selectAll();

    expect(selection.getSelection().ranges).toEqual([
      { from: { row: 0, col: 0 }, to: { row: 1, col: COLUMN_COUNT - 1 } },
    ]);
    expect(copy().split(/\r?\n/)[0].split('\t')).toHaveLength(COLUMN_COUNT);
  });

  it('resolves a click on a scrolled window cell to its own column', async () => {
    const { selection, scrollTo, copy, cell } = await setup();
    await scrollTo(5_000);

    cell(1, 'c52')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selection.getSelection().ranges).toEqual([{ from: { row: 1, col: 52 }, to: { row: 1, col: 52 } }]);
    expect(copy()).toBe('c52-v1');
    expect(cell(1, 'c52')?.classList.contains('selected')).toBe(true);
  });

  it('maps columns by field when a windowing plugin returns cloned column objects', async () => {
    class CloningWindow extends ColumnVirtualizationPlugin {
      override windowColumns(columns: readonly ColumnConfig[]): readonly ColumnConfig[] {
        return super.windowColumns(columns).map((c) => ({ ...c }));
      }
    }
    const { selection, scrollTo, copy, cell } = await setup({ mode: 'range' }, makeColumns(), [], new CloningWindow());
    await scrollTo(5_000);

    cell(1, 'c52')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selection.getSelection().ranges).toEqual([{ from: { row: 1, col: 52 }, to: { row: 1, col: 52 } }]);
    expect(copy()).toBe('c52-v1');
    expect(cell(1, 'c52')?.classList.contains('selected')).toBe(true);
  });

  it('keeps full-list mapping when a cloned window contains a column with a shared field', async () => {
    class CloningWindow extends ColumnVirtualizationPlugin {
      override windowColumns(columns: readonly ColumnConfig[]): readonly ColumnConfig[] {
        return super.windowColumns(columns).map((c) => ({ ...c }));
      }
    }
    const columns = makeColumns();
    // A rendered column (index 55) shares its field with the off-window c5: only that column is unresolvable.
    columns[55] = { ...columns[55], field: 'c5', header: 'C5 again' };
    const { grid, selection, scrollTo, cell } = await setup({ mode: 'range' }, columns, [], new CloningWindow());
    await scrollTo(5_000);

    cell(1, 'c52')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selection.getSelection().ranges).toEqual([{ from: { row: 1, col: 52 }, to: { row: 1, col: 52 } }]);
    expect(cell(1, 'c52')?.classList.contains('selected')).toBe(true);

    // The ambiguous column itself (rendered c55, field c5) has no selection-space index: never selected.
    const ambiguous = cell(1, 'c5')!;
    ambiguous.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selection.getSelection().ranges).toEqual([{ from: { row: 1, col: 52 }, to: { row: 1, col: 52 } }]);

    const at = (field: string) => grid._visibleColumns.findIndex((c) => c.field === field);
    const mouse = (type: 'mousedown' | 'mousemove', colIndex: number) => ({
      type,
      rowIndex: 1,
      colIndex,
      column: grid._visibleColumns[colIndex],
      isHeader: false,
      originalEvent: new MouseEvent(type),
    });
    selection.onCellMouseDown(mouse('mousedown', at('c52')));
    selection.onCellMouseMove(mouse('mousemove', at('c5')));
    expect(selection.getSelection().ranges).toEqual([{ from: { row: 1, col: 52 }, to: { row: 1, col: 52 } }]);
  });

  it('keeps an existing range when Tab comes from a header control', async () => {
    const columns = makeColumns();
    columns[3] = {
      ...columns[3],
      headerRenderer: () => {
        const input = document.createElement('input');
        input.addEventListener('click', (e) => e.stopPropagation());
        return input;
      },
    };
    const { grid, selection } = await setup({ mode: 'range' }, columns);
    grid._focusRow = 0;
    grid._focusCol = 2;
    selection.setRanges([{ from: { row: 0, col: 1 }, to: { row: 1, col: 2 } }]);
    const input = grid.querySelector<HTMLInputElement>('.header-row .cell[data-field="c3"] input')!;

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    await waitUpgrade(grid);

    expect(selection.getSelection().ranges).toEqual([{ from: { row: 0, col: 1 }, to: { row: 1, col: 2 } }]);
  });

  it('selects to the key destination even when a scroll re-windows before the next render', async () => {
    // 30 rows: row virtualization active, so the keyboard update waits for the next frame.
    const { grid, selection, virtualization, renderedIndex } = await setup(
      { mode: 'range' },
      makeColumns(),
      [],
      undefined,
      30,
    );
    grid._focusRow = 0;
    grid._focusCol = renderedIndex('c5');

    key(grid, { key: 'ArrowDown', shiftKey: true });
    // Scroll in the same task, before the render that applies the keyboard update.
    virtualization.onScroll({
      scrollTop: 0,
      scrollLeft: 5_000,
      scrollHeight: 0,
      scrollWidth: COLUMN_COUNT * 100,
      clientHeight: 0,
      clientWidth: 800,
    });
    await waitUpgrade(grid);

    expect(grid._focusCol).toBe(-1);
    expect(selection.getSelection().ranges).toEqual([{ from: { row: 0, col: 5 }, to: { row: 1, col: 5 } }]);
  });

  it('extends a keyboard range from the anchor column after the window moved', async () => {
    const { grid, selection, scrollTo, renderedIndex } = await setup();
    await scrollTo(5_000);
    grid._focusRow = 0;
    grid._focusCol = renderedIndex('c50');

    key(grid, { key: 'ArrowRight', shiftKey: true });
    await waitUpgrade(grid);

    expect(selection.getSelection().ranges).toEqual([{ from: { row: 0, col: 50 }, to: { row: 0, col: 51 } }]);
  });

  it('extends from the fallback menu (no ContextMenuPlugin) to the column under a scrolled window cell', async () => {
    const checked: Array<[string | undefined, number | undefined]> = [];
    const { selection, scrollTo, cell } = await setup({
      mode: 'range',
      isSelectable: (_row, _rowIndex, column, colIndex) => {
        checked.push([column?.field, colIndex]);
        return true;
      },
    });
    cell(0, 'c2')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await scrollTo(5_000);
    checked.length = 0;

    cell(1, 'c52')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    const item = document.querySelector<HTMLButtonElement>('.tbw-range-extend-menu button');
    expect(item?.textContent).toBe('Extend selection to here');
    expect(checked).toContainEqual(['c52', 52]);
    item!.click();

    expect(selection.getSelection().ranges).toEqual([{ from: { row: 0, col: 2 }, to: { row: 1, col: 52 } }]);
  });

  it('pastes into the selected column after a horizontal scroll', async () => {
    const { grid, selection, scrollTo } = await setup();
    selection.setRanges([{ from: { row: 0, col: 2 }, to: { row: 0, col: 2 } }]);
    await scrollTo(5_000);
    let fields: string[] = [];
    // The native `paste` event shares the type; only the plugin's CustomEvent carries a detail.
    grid.addEventListener('paste', (e) => {
      const detail = (e as CustomEvent<{ fields: string[] } | null>).detail;
      if (detail) fields = detail.fields;
    });
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: (type: string) => (type === 'text/plain' ? 'a\tb' : '') },
    });

    grid.dispatchEvent(event);

    expect(fields).toEqual(['c2', 'c3']);
  });

  it('spans the columns between a window cell and a pinned-right column, as without virtualization', async () => {
    const columns = makeColumns();
    columns[179] = { ...columns[179], pinned: 'right' } as ColumnConfig;
    const { grid, selection, copy, renderedIndex } = await setup({ mode: 'range' }, columns, [
      new PinnedColumnsPlugin(),
    ]);
    // The window ends at c10, so the pinned c179 renders right next to it.
    expect(grid._visibleColumns[renderedIndex('c10') + 1]?.field).toBe('c179');

    selection.setRanges([{ from: { row: 0, col: 10 }, to: { row: 0, col: 11 } }]);
    expect(copy()).toBe('c10-v0\tc11-v0');

    selection.setRanges([{ from: { row: 0, col: 10 }, to: { row: 0, col: 179 } }]);
    expect(copy().split('\t')).toHaveLength(170);
  });
});

describe('ColumnVirtualization × column selection (#633)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('selects and reports columns outside the rendered window', async () => {
    const { grid, selection, scrollTo } = await setup({ mode: 'column' });

    selection.selectColumn('c150');
    expect(selection.getSelectedColumns()).toEqual(['c150']);

    selection.selectColumn('c5');
    await scrollTo(5_000);
    expect(selection.getSelectedColumns()).toEqual(['c5']);

    let detail: readonly string[] = [];
    grid.addEventListener('selection-change', (e) => {
      detail = (e as CustomEvent<{ selectedColumns: readonly string[] }>).detail.selectedColumns;
    });
    selection.selectColumn('c52', { toggle: true });
    expect(selection.getSelectedColumns()).toEqual(['c5', 'c52']);
    expect(detail).toEqual(['c5', 'c52']);

    selection.selectAllColumns();
    expect(selection.getSelectedColumns()).toHaveLength(COLUMN_COUNT);
  });
});

describe('ColumnVirtualization × focused column (#633)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps focusing the same column while the window moves under it', async () => {
    const { grid, scrollTo, renderedIndex } = await setup();
    grid._focusCol = renderedIndex('c8');
    const before = grid._focusCol;

    await scrollTo(1_000);

    expect(grid._focusCol).not.toBe(before);
    expect(grid._visibleColumns[grid._focusCol]?.field).toBe('c8');
  });

  it('parks focus while its column is scrolled out and restores it when it comes back', async () => {
    const { grid, scrollTo, renderedIndex, cell } = await setup();
    grid._focusRow = 0;
    grid._focusCol = renderedIndex('c5');

    await scrollTo(5_000);
    expect(grid._focusCol).toBe(-1);
    expect(grid.focusedCell?.field).toBe('c5');
    expect(grid.querySelectorAll('.rows .cell.cell-focus')).toHaveLength(0);

    await scrollTo(0);
    expect(grid._visibleColumns[grid._focusCol]?.field).toBe('c5');
    expect(cell(0, 'c5')?.classList.contains('cell-focus')).toBe(true);
  });

  it('scrolls an off-window focused column back in before handling a key', async () => {
    const { grid, scrollTo, renderedIndex, cell } = await setup();
    grid._focusRow = 0;
    grid._focusCol = renderedIndex('c5');
    await scrollTo(5_000);

    key(grid, { key: 'ArrowRight' });

    expect(grid._visibleColumns[grid._focusCol]?.field).toBe('c6');
    expect(cell(0, 'c6')?.classList.contains('cell-focus')).toBe(true);
  });

  it('does not scroll back for a lone modifier key', async () => {
    const { grid, scrollTo, renderedIndex } = await setup();
    grid._focusCol = renderedIndex('c5');
    await scrollTo(5_000);

    key(grid, { key: 'Shift', shiftKey: true });

    expect(grid._focusCol).toBe(-1);
  });

  /** Columns with a header input on c50, a cell input on c51 and a cell button on c52. */
  function columnsWithControls(): ColumnConfig[] {
    const control = (tag: 'input' | 'button') => () => {
      const el = document.createElement(tag);
      el.addEventListener('click', (e) => e.stopPropagation());
      return el;
    };
    const columns = makeColumns();
    columns[50] = { ...columns[50], headerRenderer: control('input') };
    columns[51] = { ...columns[51], renderer: control('input') };
    columns[52] = { ...columns[52], renderer: control('button') };
    return columns;
  }

  it.each([
    ['a header control', '.header-row .cell[data-field="c50"] input', ['a', 'Home']],
    ['a form field in a cell', '.rows .cell[data-row="0"][data-field="c51"] input', ['a', 'Home']],
    ['a button in a cell', '.rows .cell[data-row="0"][data-field="c52"] button', [' ', 'Enter']],
  ])('leaves %s alone instead of re-rendering under it', async (_label, selector, keys) => {
    const { grid, scrollTo, renderedIndex } = await setup({ mode: 'range' }, columnsWithControls());
    grid._focusCol = renderedIndex('c5');
    await scrollTo(5_000);
    const target = grid.querySelector<HTMLElement>(selector)!;
    expect(target).not.toBeNull();

    for (const k of keys) {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    }

    expect(target.isConnected).toBe(true);
    expect(grid._focusCol).toBe(-1);
    expect(grid.focusedCell?.field).toBe('c5');
  });

  it.each(['cell', 'range'] as const)(
    'does not select from a parked focus on Home/End in a header control (%s mode)',
    async (mode) => {
      const { grid, selection, scrollTo, renderedIndex } = await setup({ mode }, columnsWithControls());
      grid._focusCol = renderedIndex('c5');
      await scrollTo(5_000);
      const input = grid.querySelector<HTMLInputElement>('.header-row .cell[data-field="c50"] input')!;

      for (const k of ['Home', 'End']) {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
      }
      await Promise.resolve();
      await waitUpgrade(grid);

      expect(selection.getSelection()).toMatchObject({ ranges: [], anchor: null });
      expect(grid._focusCol).toBe(-1);
    },
  );

  it.each([
    ['Home', {}, 0, 'c0', { anchor: { row: 0, col: 0 }, ranges: [] }],
    ['End', {}, 0, 'c179', { anchor: { row: 0, col: 179 }, ranges: [] }],
    ['Home', { ctrlKey: true }, 0, 'c0', { anchor: { row: 0, col: 0 }, ranges: [] }],
    ['End', { ctrlKey: true }, 1, 'c179', { anchor: { row: 1, col: 179 }, ranges: [] }],
    [
      'Home',
      { shiftKey: true },
      0,
      'c0',
      { anchor: { row: 0, col: 50 }, ranges: [{ from: { row: 0, col: 0 }, to: { row: 0, col: 50 } }] },
    ],
    [
      'End',
      { shiftKey: true },
      0,
      'c179',
      { anchor: { row: 0, col: 50 }, ranges: [{ from: { row: 0, col: 50 }, to: { row: 0, col: 179 } }] },
    ],
  ])(
    '%s %o focuses and selects from the full-list edge column, not the window edge',
    async (k, mods, row, field, sel) => {
      const { grid, selection, scrollTo, renderedIndex } = await setup();
      await scrollTo(5_000);
      grid._focusRow = 0;
      grid._focusCol = renderedIndex('c50');

      key(grid, { key: k, ...mods });
      await waitUpgrade(grid);

      expect(grid._focusRow).toBe(row);
      expect(grid._visibleColumns[grid._focusCol]?.field).toBe(field);
      expect(selection.getSelection()).toMatchObject(sel);
    },
  );

  it('navigates from a bare body cell the reveal re-rendered', async () => {
    const { grid, scrollTo, renderedIndex, cell } = await setup();
    grid._focusRow = 0;
    grid._focusCol = renderedIndex('c5');
    await scrollTo(5_000);
    const target = cell(0, 'c52')!;

    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));

    expect(target.isConnected).toBe(false);
    expect(grid._visibleColumns[grid._focusCol]?.field).toBe('c6');
  });

  it.each([{ ctrlKey: true }, { shiftKey: true }])(
    'ignores the %o+Space span chord from a control while focus is parked',
    async (mods) => {
      const { grid, selection, scrollTo, renderedIndex } = await setup({ mode: 'range' }, columnsWithControls());
      grid._focusCol = renderedIndex('c5');
      await scrollTo(5_000);
      const button = grid.querySelector<HTMLElement>('.rows .cell[data-row="0"][data-field="c52"] button')!;

      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true, ...mods }));

      expect(selection.getSelection()).toMatchObject({ ranges: [], anchor: null });
    },
  );

  it('keeps a parked focus when a plugin writes back the value it read', async () => {
    const { grid, scrollTo, renderedIndex } = await setup();
    grid._focusCol = renderedIndex('c5');
    await scrollTo(5_000);

    const read = grid._focusCol;
    grid._focusCol = read;
    await scrollTo(0);

    expect(grid._visibleColumns[grid._focusCol]?.field).toBe('c5');
  });

  it('a click on a rendered cell replaces a parked focus', async () => {
    const { grid, scrollTo, renderedIndex, cell } = await setup();
    grid._focusCol = renderedIndex('c5');
    await scrollTo(5_000);

    cell(1, 'c52')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await scrollTo(0);

    expect(grid.focusedCell?.field).toBe('c52');
  });

  it.each([
    ['parked', 'c5'],
    ['rendered', 'c52'],
  ])('hands a %s focus back as a full-list index when the plugin is removed', async (state, field) => {
    const { grid, scrollTo, renderedIndex } = await setup();
    if (state === 'parked') grid._focusCol = renderedIndex(field);
    await scrollTo(5_000);
    if (state === 'rendered') grid._focusCol = renderedIndex(field);
    expect(grid._focusCol).toBe(state === 'parked' ? -1 : renderedIndex(field));

    grid.gridConfig = { ...grid.gridConfig, plugins: [] };
    await waitUpgrade(grid);

    expect(grid._visibleColumns).toHaveLength(COLUMN_COUNT);
    expect(grid.focusedCell).toMatchObject({ colIndex: Number(field.slice(1)), field });
  });
});
