/**
 * Sorting Module
 *
 * Handles column sorting state transitions and row ordering.
 */

import type { ColumnConfig, InternalGrid, SortHandler, SortState } from '../types';
import { renderHeader } from './header';

/**
 * Default comparator for sorting values.
 * Handles nulls (pushed to end), numbers, and string fallback.
 */
export function defaultComparator(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  return a > b ? 1 : a < b ? -1 : 0;
}

/**
 * Built-in sort implementation using column comparator or default.
 * This is the default sortHandler when none is configured.
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
function finalizeSortResult<T>(grid: InternalGrid<T>, sortedRows: T[], col: ColumnConfig<T>, dir: 1 | -1): void {
  grid._rows = sortedRows;
  // Bump epoch so renderVisibleRows triggers full inline rebuild
  grid.__rowRenderEpoch++;
  // Invalidate pooled rows to guarantee rebuild
  grid._rowPool.forEach((r) => (r.__epoch = -1));
  renderHeader(grid);
  grid.refreshVirtualWindow(true);
  (grid as unknown as HTMLElement).dispatchEvent(
    new CustomEvent('sort-change', { detail: { field: col.field, direction: dir } }),
  );
  // Trigger state change after sort applied
  grid.requestStateChange?.();
}

/**
 * Cycle sort state for a column: none -> ascending -> descending -> none.
 * Restores original row order when clearing sort.
 */
export function toggleSort(grid: InternalGrid, col: ColumnConfig<any>): void {
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
    (grid as unknown as HTMLElement).dispatchEvent(
      new CustomEvent('sort-change', { detail: { field: col.field, direction: 0 } }),
    );
    // Trigger state change after sort is cleared
    grid.requestStateChange?.();
  }
}

/**
 * Apply a concrete sort direction to rows.
 *
 * Uses custom sortHandler from gridConfig if provided, otherwise uses built-in sorting.
 * Supports both sync and async handlers (for server-side sorting).
 */
export function applySort(grid: InternalGrid, col: ColumnConfig<any>, dir: 1 | -1): void {
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
