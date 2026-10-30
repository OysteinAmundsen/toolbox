/**
 * Nested-grid isolation for SelectionPlugin.
 *
 * The grid renders in light DOM, so a `<tbw-grid>` inside a master-detail
 * panel lives INSIDE the parent's `.rows` container. Every selection paint
 * pass in the parent must therefore stay scoped to the parent's own rows —
 * an unscoped `querySelectorAll('.cell')` would wipe the child's selection
 * markers on every parent render / scroll frame.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../lib/core/grid';
import { nextFrame, waitUpgrade } from '../../../test/helpers';
import type { DataGridElement } from '../../lib/core/grid';
import { MasterDetailPlugin } from '../../lib/plugins/master-detail';
import { SelectionPlugin } from '../../lib/plugins/selection';

interface Order {
  id: number;
  items: Array<{ sku: string; qty: number }>;
}

describe('SelectionPlugin — nested grid isolation', () => {
  let parent: DataGridElement<Order>;
  let child: DataGridElement | null;

  beforeEach(() => {
    document.body.innerHTML = '';
    child = null;
    parent = document.createElement('tbw-grid') as DataGridElement<Order>;
    document.body.appendChild(parent);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  /** Expand row 0 so the child grid mounts, then wait for both grids to render. */
  async function mountNested(parentMode: 'row' | 'range' | 'cell', childMode: 'row' | 'range') {
    const masterDetail = new MasterDetailPlugin({
      detailRenderer: (row) => {
        const grid = document.createElement('tbw-grid') as DataGridElement;
        grid.gridConfig = {
          columns: [{ field: 'sku' }, { field: 'qty' }],
          plugins: [new SelectionPlugin({ mode: childMode })],
        };
        grid.rows = row.items as Order['items'];
        child = grid;
        return grid;
      },
    });
    parent.gridConfig = {
      columns: [{ field: 'id' }],
      plugins: [masterDetail, new SelectionPlugin({ mode: parentMode })],
    };
    parent.rows = [
      {
        id: 1,
        items: [
          { sku: 'A', qty: 1 },
          { sku: 'B', qty: 2 },
          { sku: 'C', qty: 3 },
        ],
      },
      { id: 2, items: [] },
    ];
    await waitUpgrade(parent);
    masterDetail.expand(0);
    await nextFrame(2);
    expect(child).not.toBeNull();
    await waitUpgrade(child!);
    return child!;
  }

  function cell(grid: HTMLElement, row: number, col: number): HTMLElement {
    const el = grid.querySelector<HTMLElement>(
      `:scope > .tbw-grid-root .rows > .data-grid-row > .cell[data-row="${row}"][data-col="${col}"]`,
    );
    expect(el, `cell ${row},${col}`).not.toBeNull();
    return el!;
  }

  it('a parent render does not wipe the child grid range selection', async () => {
    const nested = await mountNested('cell', 'range');
    const childCell = cell(nested, 1, 0);
    childCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    childCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    childCell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await nextFrame();
    expect(childCell.classList.contains('selected')).toBe(true);
    expect(childCell.getAttribute('aria-selected')).toBe('true');

    // Any parent render re-runs the parent's selection paint pass.
    parent.requestRender();
    await nextFrame(2);

    expect(childCell.classList.contains('selected')).toBe(true);
    expect(childCell.getAttribute('aria-selected')).toBe('true');
  });

  it('parent row selection never marks a child row sharing the same index', async () => {
    const nested = await mountNested('row', 'row');
    const parentCell = cell(parent, 0, 0);
    parentCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextFrame();

    const parentRow = parentCell.closest('.data-grid-row')!;
    expect(parentRow.classList.contains('selected')).toBe(true);

    const childRow0 = cell(nested, 0, 0).closest('.data-grid-row')!;
    expect(childRow0.classList.contains('selected')).toBe(false);
    expect(childRow0.classList.contains('row-focus')).toBe(false);
    expect(childRow0.getAttribute('aria-selected')).not.toBe('true');
  });

  it('a parent render does not strip the child grid focus marker', async () => {
    const nested = await mountNested('row', 'range');
    const childCell = cell(nested, 0, 1);
    childCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await nextFrame();
    expect(childCell.classList.contains('cell-focus')).toBe(true);

    // Parent row mode clears cell-focus on every pass — only for its own cells.
    parent.requestRender();
    await nextFrame(2);
    expect(childCell.classList.contains('cell-focus')).toBe(true);
  });
});
