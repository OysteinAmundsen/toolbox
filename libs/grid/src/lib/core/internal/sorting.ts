/**
 * Sorting Module
 *
 * Handles column sorting state transitions and row ordering.
 */

import type { ColumnConfig, InternalGrid } from '../types';
import { renderHeader } from './header';

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
    grid._rowPool.forEach((r) => ((r as any).__epoch = -1));
    grid._rows = grid.__originalOrder.slice();
    renderHeader(grid);
    // After re-render ensure cleared column shows aria-sort="none" baseline.
    const headers = grid._headerRowEl?.querySelectorAll('[role="columnheader"].sortable');
    headers?.forEach((h: any) => {
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
 * Apply a concrete sort direction to rows using either the column's custom comparator
 * or a default comparator aware of null/undefined ordering.
 */
export function applySort(grid: InternalGrid, col: ColumnConfig<any>, dir: 1 | -1): void {
  grid._sortState = { field: col.field, direction: dir };
  const comparator =
    (col as any).sortComparator ||
    ((a: any, b: any) => (a == null && b == null ? 0 : a == null ? -1 : b == null ? 1 : a > b ? 1 : a < b ? -1 : 0));
  grid._rows.sort((rA: any, rB: any) => comparator(rA[col.field], rB[col.field], rA, rB) * dir);
  // Bump epoch so renderVisibleRows triggers full inline rebuild (ensures templated / compiled view cells update)
  grid.__rowRenderEpoch++;
  // Invalidate pooled rows to guarantee rebuild even if epoch comparison logic changes
  grid._rowPool.forEach((r) => ((r as any).__epoch = -1));
  renderHeader(grid);
  grid.refreshVirtualWindow(true);
  (grid as unknown as HTMLElement).dispatchEvent(
    new CustomEvent('sort-change', { detail: { field: col.field, direction: dir } }),
  );
  // Trigger state change after sort applied
  grid.requestStateChange?.();
}
