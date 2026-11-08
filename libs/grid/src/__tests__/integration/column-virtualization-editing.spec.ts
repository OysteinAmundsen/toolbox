/**
 * ColumnVirtualization × Editing and horizontal keyboard navigation (#640).
 *
 * The rendered column list is a scroll window plus always-rendered pinned columns. Rows that carry
 * live editors must follow a moved window (keyed by field, so a kept editor keeps its draft and
 * focus), and every horizontal move — core Arrow/Tab, Editing's Tab, `beginCellEdit` — walks the
 * full visible list and reveals its target instead of stopping at, or jumping out of, the window.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { BaseGridPlugin } from '../../lib/core/plugin/base-plugin';
import type { ColumnConfig } from '../../lib/core/types';
import { ColumnVirtualizationPlugin } from '../../lib/plugins/column-virtualization/column-virtualization-plugin';
import { EditingPlugin } from '../../lib/plugins/editing/editing-plugin';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';

const COLUMN_COUNT = 180;

function makeColumns(editable = true): ColumnConfig[] {
  return Array.from({ length: COLUMN_COUNT }, (_, i) => ({ field: `c${i}`, header: `C${i}`, width: 100, editable }));
}

async function setup(plugins: BaseGridPlugin[], columns = makeColumns()) {
  const grid = createGrid();
  Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 800 });
  const virtualization = new ColumnVirtualizationPlugin();
  grid.gridConfig = { columns, fitMode: 'fixed', plugins: [virtualization, ...plugins] };
  grid.rows = [0, 1].map((r) => Object.fromEntries(columns.map((c) => [c.field, `${c.field}-v${r}`])));
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
  const rowEl = (row: number) => grid.querySelectorAll<HTMLElement>('.rows .data-grid-row')[row];
  const fieldsOf = (el: Element | undefined) =>
    [...(el?.querySelectorAll<HTMLElement>(':scope > .cell') ?? [])].map((c) => c.dataset.field);
  const headerFields = () => fieldsOf(grid.querySelector('.header-row') ?? undefined);
  const cell = (row: number, field: string) =>
    grid.querySelector<HTMLElement>(`.rows .data-grid-row > .cell[data-row="${row}"][data-field="${field}"]`);
  const focused = () => `${grid._focusRow}:${grid._visibleColumns[grid._focusCol]?.field}`;
  const key = (k: string, init: KeyboardEventInit = {}) =>
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  const focusOn = (row: number, field: string) => {
    grid._focusRow = row;
    grid._focusCol = grid._visibleColumns.findIndex((c) => c.field === field);
  };
  return { grid, scrollTo, rowEl, fieldsOf, headerFields, cell, focused, key, focusOn };
}

describe('ColumnVirtualization × rows with live editors (#640)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('re-windows a row-mode edit row and gives its new cells editors', async () => {
    const editing = new EditingPlugin();
    const { grid, scrollTo, rowEl, fieldsOf, headerFields } = await setup([editing]);
    editing.beginBulkEdit(0);
    await waitUpgrade(grid);

    await scrollTo(5_000);

    expect(fieldsOf(rowEl(0))).toEqual(headerFields());
    expect(fieldsOf(rowEl(0))[0]).toBe('c47');
    const cells = [...rowEl(0).querySelectorAll<HTMLElement>(':scope > .cell')];
    expect(cells.every((c) => c.classList.contains('editing'))).toBe(true);
    expect(cells.map((c) => c.dataset.col)).toEqual(cells.map((_, i) => String(i)));

    await scrollTo(0);
    expect(fieldsOf(rowEl(0))).toEqual(headerFields());
    expect(rowEl(0).querySelector<HTMLInputElement>('[data-field="c0"] input')?.value).toBe('c0-v0');
  });

  it('keeps the element, draft and focus of an editor that stays in the window', async () => {
    const editing = new EditingPlugin();
    const { grid, scrollTo, cell } = await setup([editing]);
    editing.beginBulkEdit(0);
    await waitUpgrade(grid);
    // beginBulkEdit focuses its first editor in a deferred timer — let it run before focusing ours.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = cell(0, 'c5')!.querySelector('input')!;
    input.focus();
    input.value = 'draft';
    expect(document.activeElement).toBe(input);

    await scrollTo(400);

    expect(cell(0, 'c0')).toBeNull();
    expect(cell(0, 'c5')!.querySelector('input')).toBe(input);
    expect(input.value).toBe('draft');
    expect(document.activeElement).toBe(input);
  });

  it('commits the draft of a focused editor whose column scrolls out of the window', async () => {
    const editing = new EditingPlugin();
    const { grid, scrollTo, cell } = await setup([editing]);
    editing.beginBulkEdit(0);
    await waitUpgrade(grid);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const input = cell(0, 'c5')!.querySelector('input')!;
    input.focus();
    input.value = 'draft';

    await scrollTo(5_000);

    expect(cell(0, 'c5')).toBeNull();
    expect((grid.rows[0] as Record<string, unknown>).c5).toBe('draft');
    expect(editing.activeEditRow).toBe(0);
  });

  it.each([
    ['after Tab to the column now at its old index', true],
    ['right after the scroll', false],
  ])('grid-mode Escape reverts the focused column %s', async (_label, tabToNext) => {
    const { grid, scrollTo, cell } = await setup([new EditingPlugin({ mode: 'grid' })]);
    const cancels: Array<{ field: string; colIndex: number }> = [];
    grid.addEventListener('cell-cancel', (e) => cancels.push((e as CustomEvent).detail));
    const focusEditor = (field: string) => {
      grid._focusRow = 0;
      grid._focusCol = grid._visibleColumns.findIndex((c) => c.field === field);
      const input = cell(0, field)!.querySelector('input')!;
      input.focus();
      return input;
    };
    focusEditor('c5');
    // Scroll by one column: the retained c5 editor moves from rendered index 5 to 4.
    await scrollTo(400);
    expect(grid._visibleColumns.findIndex((c) => c.field === 'c5')).toBe(4);
    const target = tabToNext ? 'c6' : 'c5';
    const input = tabToNext ? focusEditor('c6') : cell(0, 'c5')!.querySelector('input')!;
    input.value = 'draft';

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await waitUpgrade(grid);

    const row = grid.rows[0] as Record<string, unknown>;
    expect(row.c5).toBe('c5-v0');
    expect(row[target]).toBe(`${target}-v0`);
    expect(cancels).toEqual([
      expect.objectContaining({ field: target, colIndex: grid._visibleColumns.findIndex((c) => c.field === target) }),
    ]);
  });

  it('unmounts an adapter-rendered cell loader when its editing cell leaves the window', async () => {
    const { grid, scrollTo, cell } = await setup([new EditingPlugin({ mode: 'grid' })]);
    const overlay = document.createElement('div');
    overlay.className = 'tbw-cell-loading-overlay';
    cell(0, 'c0')!.appendChild(overlay);
    const unmount = vi.fn((_container: HTMLElement) => undefined);
    grid.__frameworkAdapter = { unmount, releaseCell: vi.fn((_cell: HTMLElement) => undefined) };

    await scrollTo(5_000);

    expect(cell(0, 'c0')).toBeNull();
    expect(unmount).toHaveBeenCalledWith(overlay);
  });

  it('keeps cellClass current on an editing cell that stays in the window', async () => {
    let tone = 'cold';
    const columns = makeColumns().map((c) => ({ ...c, cellClass: () => tone }));
    const { grid, scrollTo, cell } = await setup([new EditingPlugin({ mode: 'grid' })], columns);
    expect(cell(0, 'c5')?.classList.contains('cold')).toBe(true);
    tone = 'hot';

    await scrollTo(400);

    expect(cell(0, 'c5')?.classList.contains('editing')).toBe(true);
    expect(cell(0, 'c5')?.classList.contains('hot')).toBe(true);
    expect(grid.querySelectorAll('.rows .cell.cold')).toHaveLength(0);
  });

  it('keeps one cell per column when two columns share a field', async () => {
    const columns = makeColumns();
    columns[6] = { ...columns[6], field: 'c5', header: 'C5 again' };
    const { grid, scrollTo, rowEl, fieldsOf } = await setup([new EditingPlugin({ mode: 'grid' })], columns);

    await scrollTo(400);

    const fields = grid._visibleColumns.map((c) => c.field);
    expect(fields.filter((f) => f === 'c5')).toHaveLength(2);
    for (const row of [0, 1]) {
      expect(fieldsOf(rowEl(row))).toEqual(fields);
      const cols = [...rowEl(row).querySelectorAll<HTMLElement>(':scope > .cell')].map((c) => c.dataset.col);
      expect(cols).toEqual(fields.map((_, i) => String(i)));
    }
  });

  it('releases dropped editor cells inside one adapter batch', async () => {
    const { grid, scrollTo } = await setup([new EditingPlugin({ mode: 'grid' })]);
    const calls: string[] = [];
    grid.__frameworkAdapter = {
      beginBatch: () => calls.push('begin'),
      endBatch: () => calls.push('end'),
      releaseCell: () => calls.push('release'),
    };

    await scrollTo(400);

    expect(calls).toContain('release');
    // Every release sits inside a begin/end pair.
    let depth = 0;
    for (const call of calls) {
      if (call === 'begin') depth++;
      else if (call === 'end') depth--;
      else expect(depth).toBeGreaterThan(0);
    }
  });

  it("leaves a nested grid's editing cells alone when the row's own editors leave the window", async () => {
    const columns = makeColumns();
    // c8 stays rendered across the scroll; its renderer stands in for a nested grid with a live
    // editor, and reuses its node per cell the way framework adapters do.
    const nestedByCell = new WeakMap<HTMLElement, HTMLElement>();
    columns[8] = {
      ...columns[8],
      editable: false,
      renderer: (ctx) => {
        let nested = ctx.cellEl ? nestedByCell.get(ctx.cellEl) : undefined;
        if (!nested) {
          nested = document.createElement('div');
          nested.innerHTML = '<div class="cell editing" data-nested><input></div>';
          if (ctx.cellEl) nestedByCell.set(ctx.cellEl, nested);
        }
        return nested;
      },
    };
    const editing = new EditingPlugin();
    const { grid, scrollTo, cell } = await setup([editing], columns);
    editing.beginCellEdit(0, 'c0');
    await waitUpgrade(grid);

    await scrollTo(1_000);

    expect(cell(0, 'c0')).toBeNull();
    expect(cell(0, 'c8')?.querySelector('[data-nested]')?.classList.contains('editing')).toBe(true);
  });

  it('revealColumn reveals an identical column object but refuses an ambiguous shared field', async () => {
    const columns = makeColumns(false);
    columns[160] = { ...columns[160], field: 'c150', header: 'C150 again' };
    const { grid } = await setup([], columns);
    const first = () => grid._visibleColumns.find((c) => !c.pinned)?.field;
    expect(first()).toBe('c0');

    // An equivalent-but-not-identical object (or the bare field) matches two columns.
    expect(grid.query<boolean>('revealColumn', { ...grid._columns[160] }).some(Boolean)).toBe(false);
    expect(grid.query<boolean>('revealColumn', 'c150').some(Boolean)).toBe(false);
    expect(first()).toBe('c0');

    expect(grid.query<boolean>('revealColumn', grid._columns[160]).some(Boolean)).toBe(true);
    await waitUpgrade(grid);
    expect(grid._visibleColumns).toContain(grid._columns[160]);
  });

  it.each([
    ['ArrowRight', 'ArrowRight', [] as BaseGridPlugin[], false],
    ['Tab while editing', 'Tab', [new EditingPlugin({ mode: 'grid' })], true],
  ])('%s does not trap on two adjacent columns sharing a field', async (_label, k, plugins, editable) => {
    // 10 columns: below the virtualization threshold, so this is the plain (unwindowed) grid.
    const columns = makeColumns(editable).slice(0, 10);
    columns[6] = { ...columns[6], field: 'c5', header: 'C5 again' };
    const { grid, key } = await setup(plugins, columns);
    grid._focusRow = 0;
    grid._focusCol = 5;

    key(k);
    await waitUpgrade(grid);
    expect(grid._focusCol).toBe(6);
    key(k);
    await waitUpgrade(grid);

    expect(grid._focusCol).toBe(7);
  });

  it.each([
    ['while grid-mode focus is parked', true],
    ['while body focus is on a rendered cell', false],
  ])('leaves Tab in a header control to the browser %s', async (_label, parked) => {
    const columns = makeColumns();
    const headerField = parked ? 'c50' : 'c5';
    const index = Number(headerField.slice(1));
    columns[index] = {
      ...columns[index],
      headerRenderer: () => {
        const input = document.createElement('input');
        input.addEventListener('click', (e) => e.stopPropagation());
        return input;
      },
    };
    const { grid, scrollTo } = await setup([new EditingPlugin({ mode: 'grid' })], columns);
    grid._focusRow = 0;
    grid._focusCol = grid._visibleColumns.findIndex((c) => c.field === (parked ? 'c5' : 'c10'));
    if (parked) await scrollTo(5_000);
    const focusBefore = grid._focusCol;
    const input = grid.querySelector<HTMLInputElement>(`.header-row .cell[data-field="${headerField}"] input`)!;
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });

    input.dispatchEvent(tab);

    expect(tab.defaultPrevented).toBe(false);
    expect(input.isConnected).toBe(true);
    expect(grid._focusCol).toBe(focusBefore);
  });

  it('drops the value-change callbacks of grid-mode editors that leave the window', async () => {
    const pushes = vi.fn((_value: unknown) => undefined);
    const columns = makeColumns();
    columns[0] = {
      ...columns[0],
      editor: (ctx) => {
        ctx.onValueChange?.(pushes);
        return document.createElement('input');
      },
    };
    const { grid, scrollTo } = await setup([new EditingPlugin({ mode: 'grid' })], columns);
    const push = () =>
      grid.dispatchEvent(
        new CustomEvent('cell-change', { detail: { rowIndex: 0, field: 'c0', newValue: 'x', source: 'api' } }),
      );
    push();
    expect(pushes).toHaveBeenCalledTimes(1);

    await scrollTo(5_000);
    push();

    expect(pushes).toHaveBeenCalledTimes(1);
  });

  it('keeps keyboard focus in the grid when the focused editor scrolls out', async () => {
    const { grid, scrollTo, cell, focused } = await setup([new EditingPlugin({ mode: 'grid' })]);
    grid._focusRow = 0;
    grid._focusCol = grid._visibleColumns.findIndex((c) => c.field === 'c5');
    cell(0, 'c5')!.querySelector('input')!.focus();

    await scrollTo(5_000);

    expect(document.activeElement).toBe(grid);
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    expect(focused()).toBe('0:c6');
  });

  it('keeps focus on a retained editor whose column is reordered', async () => {
    const { grid, cell } = await setup([new EditingPlugin({ mode: 'grid' })]);
    grid._focusRow = 0;
    grid._focusCol = 5;
    const input = cell(0, 'c5')!.querySelector('input')!;
    input.focus();
    input.value = 'draft';
    const order = grid.columns.map((c) => c.field);
    order.splice(order.indexOf('c5'), 1);
    order.unshift('c5');

    grid.setColumnOrder(order);
    await waitUpgrade(grid);

    expect(cell(0, 'c5')!.querySelector('input')).toBe(input);
    expect(input.value).toBe('draft');
    expect(document.activeElement).toBe(input);
  });

  it('leaves Tab in a header control inside an open shadow root to the browser', async () => {
    const columns = makeColumns();
    let inner!: HTMLInputElement;
    columns[5] = {
      ...columns[5],
      headerRenderer: () => {
        const host = document.createElement('div');
        inner = document.createElement('input');
        host.attachShadow({ mode: 'open' }).appendChild(inner);
        host.addEventListener('click', (e) => e.stopPropagation());
        return host;
      },
    };
    const { grid } = await setup([new EditingPlugin({ mode: 'grid' })], columns);
    grid._focusRow = 0;
    grid._focusCol = grid._visibleColumns.findIndex((c) => c.field === 'c10');
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, composed: true });

    inner.dispatchEvent(tab);

    expect(tab.defaultPrevented).toBe(false);
    expect(inner.isConnected).toBe(true);
    expect(grid._visibleColumns[grid._focusCol]?.field).toBe('c10');
  });

  it('re-windows every row in grid mode', async () => {
    const { scrollTo, rowEl, fieldsOf, headerFields } = await setup([new EditingPlugin({ mode: 'grid' })]);

    await scrollTo(5_000);

    for (const row of [0, 1]) {
      expect(fieldsOf(rowEl(row))).toEqual(headerFields());
      expect(rowEl(row).querySelectorAll(':scope > .cell.editing')).toHaveLength(headerFields().length);
    }
  });

  it('keeps a single-cell edit on its column when the window shifts its index', async () => {
    const editing = new EditingPlugin();
    const { grid, scrollTo, cell } = await setup([editing]);
    editing.beginCellEdit(0, 'c5');
    await waitUpgrade(grid);

    await scrollTo(400);

    const index = grid._visibleColumns.findIndex((c) => c.field === 'c5');
    expect(index).not.toBe(5);
    expect(editing.isCellEditing(0, index)).toBe(true);
    expect(editing.activeEditCol).toBe(index);
    expect(grid.querySelectorAll('.rows .cell.editing')).toHaveLength(1);
    expect(cell(0, 'c5')?.classList.contains('editing')).toBe(true);
  });

  it('beginCellEdit scrolls an off-window column in and opens its editor', async () => {
    const editing = new EditingPlugin();
    const { grid, cell, focused } = await setup([editing]);

    editing.beginCellEdit(0, 'c150');

    expect(cell(0, 'c150')?.classList.contains('editing')).toBe(true);
    expect(focused()).toBe('0:c150');
    expect(grid.querySelectorAll('.rows .cell.editing')).toHaveLength(1);
  });
});

describe('ColumnVirtualization × horizontal keyboard navigation (#640)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['without editing', () => [] as BaseGridPlugin[], false],
    ['in row mode', () => [new EditingPlugin()], true],
    ['in grid mode', () => [new EditingPlugin({ mode: 'grid' })], true],
  ])('Tab continues past the window edge %s', async (_label, plugins, editable) => {
    const list = plugins();
    const { grid, key, focused, focusOn, cell } = await setup(list, makeColumns(editable));
    focusOn(0, 'c10');
    if (list[0] instanceof EditingPlugin && _label === 'in row mode') list[0].beginBulkEdit(0);
    await waitUpgrade(grid);

    key('Tab');
    await waitUpgrade(grid);

    expect(focused()).toBe('0:c11');
    expect(cell(0, 'c11')).not.toBeNull();
    if (editable) expect(cell(0, 'c11')?.classList.contains('editing')).toBe(true);
  });

  it.each([
    ['Shift+Tab', 'Tab', { shiftKey: true }, 'c46'],
    ['ArrowLeft', 'ArrowLeft', {}, 'c46'],
  ])('%s continues before the window start', async (_label, k, mods, field) => {
    const { grid, scrollTo, key, focused, focusOn } = await setup([], makeColumns(false));
    await scrollTo(5_000);
    focusOn(0, 'c47');
    expect(grid._visibleColumns[0].field).toBe('c47');

    key(k, mods);

    expect(focused()).toBe(`0:${field}`);
  });

  it('Tab from the last column wraps to the first column of the next row', async () => {
    const { grid, scrollTo, key, focused, focusOn } = await setup([new EditingPlugin({ mode: 'grid' })]);
    await scrollTo(COLUMN_COUNT * 100);
    focusOn(0, 'c179');

    key('Tab');
    await waitUpgrade(grid);

    expect(focused()).toBe('1:c0');
  });

  it.each(['ArrowRight', 'Tab'])('%s steps to the next column instead of jumping into a pinned one', async (k) => {
    const columns = makeColumns(false);
    columns[179] = { ...columns[179], pinned: 'right' } as ColumnConfig;
    const { grid, key, focused, focusOn } = await setup([new PinnedColumnsPlugin()], columns);
    focusOn(0, 'c10');
    expect(grid._visibleColumns[grid._focusCol + 1]?.field).toBe('c179');

    key(k);

    expect(focused()).toBe('0:c11');
  });
});
