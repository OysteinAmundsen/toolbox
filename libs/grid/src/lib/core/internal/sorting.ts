/**
 * Sorting Module
 *
 * Handles column sorting state transitions and row ordering.
 */

import type { ColumnConfig, GridHost, InternalGrid, SortHandler, SortState } from '../types';
import { announce } from './aria';
import { renderHeader } from './header';

/**
 * Default comparator used when no column-level `sortComparator` is configured.
 * Pushes `null`/`undefined` to the end and compares remaining values via `>` / `<`
 * operators, which works correctly for numbers and falls back to lexicographic
 * comparison for strings.
 *
 * Use this as a fallback inside a custom `sortComparator` when you only need
 * special handling for certain values:
 *
 * @example
 * ```typescript
 * import { defaultComparator } from '@toolbox-web/grid';
 *
 * const column = {
 *   field: 'priority',
 *   sortComparator: (a, b, rowA, rowB) => {
 *     // Pin "urgent" to the top, then fall back to default ordering
 *     if (a === 'urgent') return -1;
 *     if (b === 'urgent') return 1;
 *     return defaultComparator(a, b);
 *   },
 * };
 * ```
 *
 * @see {@link BaseColumnConfig.sortComparator} for column-level comparators
 * @see {@link builtInSort} for the full sort handler that uses this comparator
 * @category Factory Functions
 */
export function defaultComparator(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * The default `sortHandler` used when none is provided in {@link GridConfig.sortHandler}.
 * Reads each column's `sortComparator` (falling back to {@link defaultComparator})
 * and returns a sorted copy of the rows array.
 *
 * Use this as a fallback inside a custom `sortHandler` when you only need to
 * intercept sorting for specific columns or add pre/post-processing:
 *
 * @example
 * ```typescript
 * import { builtInSort } from '@toolbox-web/grid';
 * import type { SortHandler } from '@toolbox-web/grid';
 *
 * const customSort: SortHandler<Employee> = (rows, state, columns) => {
 *   // Server-side sort for the "salary" column, client-side for everything else
 *   if (state.field === 'salary') {
 *     return fetch(`/api/employees?sort=${state.field}&dir=${state.direction}`)
 *       .then(res => res.json());
 *   }
 *   return builtInSort(rows, state, columns);
 * };
 *
 * grid.gridConfig = { sortHandler: customSort };
 * ```
 *
 * @see {@link GridConfig.sortHandler} for configuring the handler
 * @see {@link defaultComparator} for the comparator used per column
 * @category Factory Functions
 */
export function builtInSort<T>(rows: T[], sortState: SortState, columns: ColumnConfig<T>[]): T[] {
  const col = columns.find((c) => c.field === sortState.field);
  const comparator = col?.sortComparator ?? defaultComparator;
  const { field, direction } = sortState;

  return [...rows].sort((rA: any, rB: any) => {
    return comparator(rA[field], rB[field], rA, rB) * direction;
  });
}

/**
 * Apply sort result to grid and update UI.
 * Called after sync or async sort completes.
 */
function finalizeSortResult<T>(grid: GridHost<T>, sortedRows: T[], col: ColumnConfig<T>, dir: 1 | -1): void {
  grid._rows = sortedRows;
  // Bump epoch so renderVisibleRows triggers full inline rebuild
  grid.__rowRenderEpoch++;
  // Invalidate pooled rows to guarantee rebuild
  grid._rowPool.forEach((r) => (r.__epoch = -1));
  renderHeader(grid);
  grid.refreshVirtualWindow(true);
  grid.dispatchEvent(new CustomEvent('sort-change', { detail: { field: col.field, direction: dir } }));
  announce(grid, `Sorted by ${col.header ?? col.field}, ${dir === 1 ? 'ascending' : 'descending'}`);
  // Trigger state change after sort applied
  grid.requestStateChange?.();
}

/**
 * Cycle sort state for a column: none -> ascending -> descending -> none.
 * Restores original row order when clearing sort.
 */
export function toggleSort(grid: GridHost, col: ColumnConfig<any>): void {
  if (!grid._sortState || grid._sortState.field !== col.field) {
    if (!grid._sortState) grid.__originalOrder = grid._rows.slice();
    applySort(grid, col, 1);
  } else if (grid._sortState.direction === 1) {
    applySort(grid, col, -1);
  } else {
    grid._sortState = null;
    // Force full row rebuild after clearing sort so templated cells reflect original order
    grid.__rowRenderEpoch++;
    // Invalidate existing pooled row epochs so virtualization triggers a full inline rebuild
    grid._rowPool.forEach((r) => (r.__epoch = -1));
    grid._rows = grid.__originalOrder.slice();
    renderHeader(grid);
    // After re-render ensure cleared column shows aria-sort="none" baseline.
    const headers = grid._headerRowEl?.querySelectorAll('[role="columnheader"].sortable');
    headers?.forEach((h) => {
      if (!h.getAttribute('aria-sort')) h.setAttribute('aria-sort', 'none');
      else if (h.getAttribute('aria-sort') === 'ascending' || h.getAttribute('aria-sort') === 'descending') {
        // The active column was re-rendered already, but normalize any missing ones.
        if (!grid._sortState) h.setAttribute('aria-sort', 'none');
      }
    });
    grid.refreshVirtualWindow(true);
    grid.dispatchEvent(new CustomEvent('sort-change', { detail: { field: col.field, direction: 0 } }));
    announce(grid, 'Sort cleared');
    // Trigger state change after sort is cleared
    grid.requestStateChange?.();
  }
}

/**
 * Re-apply the current core sort to rows during #rebuildRowModel.
 * Updates __originalOrder so "clear sort" restores the current dataset.
 * Returns rows unchanged if no core sort is active or handler is async.
 */
export function reapplyCoreSort<T>(grid: InternalGrid<T>, rows: T[]): T[] {
  if (!grid._sortState) return rows;
  grid.__originalOrder = [...rows];
  const handler: SortHandler<any> = grid.effectiveConfig?.sortHandler ?? builtInSort;
  const result = handler(rows, grid._sortState, grid._columns as ColumnConfig<any>[]);
  if (result && typeof (result as Promise<unknown[]>).then === 'function') return rows;
  return result as T[];
}

/**
 * Apply a concrete sort direction to rows.
 *
 * Uses custom sortHandler from gridConfig if provided, otherwise uses built-in sorting.
 * Supports both sync and async handlers (for server-side sorting).
 */
export function applySort(grid: GridHost, col: ColumnConfig<any>, dir: 1 | -1): void {
  grid._sortState = { field: col.field, direction: dir };

  const sortState: SortState = { field: col.field, direction: dir };
  const columns = grid._columns as ColumnConfig<any>[];

  // Get custom handler from effectiveConfig, or use built-in
  const handler: SortHandler<any> = grid.effectiveConfig?.sortHandler ?? builtInSort;

  const result = handler(grid._rows, sortState, columns);

  // Handle async (Promise) or sync result
  if (result && typeof (result as Promise<unknown[]>).then === 'function') {
    // Async handler - wait for result
    (result as Promise<unknown[]>).then((sortedRows) => {
      finalizeSortResult(grid, sortedRows, col, dir);
    });
  } else {
    // Sync handler - apply immediately
    finalizeSortResult(grid, result as unknown[], col, dir);
  }
}
