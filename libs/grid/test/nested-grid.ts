/**
 * Nested-grid test harness: a parent `<tbw-grid>` whose MasterDetail panel for
 * row 0 renders a child `<tbw-grid>`. The grid renders in light DOM, so the child
 * lives INSIDE the parent's `.rows` — the setup every "parent must not touch the
 * child" isolation spec needs (#581).
 */
import { afterEach, beforeEach, expect } from 'vitest';
import type { DataGridElement } from '../src/lib/core/grid';
import type { ColumnConfig, GridPlugin } from '../src/lib/core/types';
import { MasterDetailPlugin } from '../src/lib/plugins/master-detail';
import { nextFrame, waitUpgrade } from './helpers';

export interface Order {
  id: number;
  items: Array<{ sku: string; qty: number }>;
}

/** Row 0 has three child items; the rest are empty so only one detail grid mounts. */
export const ORDERS: Order[] = [
  {
    id: 1,
    items: [
      { sku: 'A', qty: 1 },
      { sku: 'B', qty: 2 },
      { sku: 'C', qty: 3 },
    ],
  },
  { id: 2, items: [] },
  { id: 3, items: [] },
];

export interface NestedGridOptions {
  /** Plugins for the parent grid, in addition to the MasterDetail plugin. */
  parentPlugins?: GridPlugin[];
  /** Plugins for the child grid rendered in row 0's detail panel. */
  childPlugins?: GridPlugin[];
  /** Parent columns; defaults to a single `id` column. */
  parentColumns?: ColumnConfig<Order>[];
  /** Child columns; defaults to `sku` + `qty`. */
  childColumns?: ColumnConfig[];
}

/**
 * Register `beforeEach`/`afterEach` that give every test a fresh, body-attached
 * parent grid and a clean `document.body`. Call once at `describe` level.
 */
export function useParentGrid(): { readonly parent: DataGridElement<Order> } {
  let parent: DataGridElement<Order>;
  beforeEach(() => {
    document.body.innerHTML = '';
    parent = document.createElement('tbw-grid') as DataGridElement<Order>;
    document.body.appendChild(parent);
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });
  return {
    get parent() {
      return parent;
    },
  };
}

/**
 * Configure `parent`, expand row 0 so the child grid mounts, and wait for both
 * grids to render. Returns the child grid.
 */
export async function mountNestedGrid(
  parent: DataGridElement<Order>,
  {
    parentPlugins = [],
    childPlugins = [],
    parentColumns = [{ field: 'id' }],
    childColumns = [{ field: 'sku' }, { field: 'qty' }],
  }: NestedGridOptions = {},
): Promise<DataGridElement> {
  // Assigned inside the renderer closure, so TS cannot narrow a plain `let`.
  const mounted: { child: DataGridElement | null } = { child: null };
  const masterDetail = new MasterDetailPlugin({
    detailRenderer: (row) => {
      const grid = document.createElement('tbw-grid') as DataGridElement;
      grid.gridConfig = { columns: childColumns, plugins: childPlugins };
      grid.rows = row.items as Order['items'];
      mounted.child = grid;
      return grid;
    },
  });
  parent.gridConfig = { columns: parentColumns, plugins: [masterDetail, ...parentPlugins] };
  parent.rows = ORDERS;
  await waitUpgrade(parent);
  masterDetail.expand(0);
  await nextFrame(2);
  const child = mounted.child;
  expect(child).not.toBeNull();
  if (!child) throw new Error('child grid did not mount');
  await waitUpgrade(child);
  return child;
}

/** Elements matching `selector` whose nearest grid ancestor is `grid` — never a nested grid's. */
export function own<T extends HTMLElement>(grid: HTMLElement, selector: string): T[] {
  return Array.from(grid.querySelectorAll<T>(selector)).filter((el) => el.closest('tbw-grid') === grid);
}

/** The single own data cell at (row, col). A nested grid may render the same pair — ownership is checked. */
export function ownCell(grid: HTMLElement, row: number, col: number): HTMLElement {
  const matches = own(grid, `.data-grid-row > .cell[data-row="${row}"][data-col="${col}"]`);
  expect(matches.length, `cell ${row},${col}`).toBe(1);
  return matches[0];
}

/** The grid's own pooled rows, in DOM order. */
export function ownRows(grid: HTMLElement): HTMLElement[] {
  return own(grid, '.rows > .data-grid-row');
}
