/**
 * Sorting Module
 *
 * Handles column sorting state transitions and row ordering.
 */

import type { ColumnConfig, GridHost, InternalGrid, SortHandler, SortState } from '../types';
import { announce, getA11yMessage } from './aria';
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
  const customComparator = col?.sortComparator;
  const { field, direction } = sortState;
  const sorted = [...rows];

  if (customComparator) {
    // Custom comparator path — keep the indirect call
    sorted.sort((rA: any, rB: any) => customComparator(rA[field], rB[field], rA, rB) * direction);
  } else {
    // Fast path — inline default comparator and fold direction to avoid
    // ~20M indirect function calls + multiplications at 1M rows.
    sortInPlace(sorted, field, direction);
  }

  return sorted;
}

/**
 * Sort an array in-place using the default comparator with direction folded in.
 * Shared between the public `builtInSort` (which copies first) and the internal
 * fast paths in `applySort` / `reapplyCoreSort` (which skip the copy).
 */
function sortInPlace(rows: any[], field: string, direction: 1 | -1): void {
  rows.sort((rA: any, rB: any) => {
    const a = rA[field];
    const b = rB[field];
    if (a == null && b == null) return 0;
    if (a == null) return -direction;
    if (b == null) return direction;
    return a > b ? direction : a < b ? -direction : 0;
  });
}

/**
 * Execute the built-in sort on rows in-place, using a column-level custom
 * comparator when present, otherwise the default comparator.
 */
function executeBuiltInSortInPlace(rows: any[], field: string, direction: 1 | -1, columns: ColumnConfig<any>[]): void {
  const col = columns.find((c) => c.field === field);
  const customComparator = col?.sortComparator;
  if (customComparator) {
    rows.sort((rA: any, rB: any) => customComparator(rA[field], rB[field], rA, rB) * direction);
  } else {
    sortInPlace(rows, field, direction);
  }
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
  for (let i = 0; i < grid._rowPool.length; i++) {
    grid._rowPool[i].__epoch = -1;
  }
  renderHeader(grid);
  grid.refreshVirtualWindow(true);
  emitSortChange(grid, col, dir);
}

/**
 * Emit sort-change event, aria announcement, and state change request.
 * Shared by both the direct sort path and the scheduler-delegated path.
 */
function emitSortChange<T>(grid: GridHost<T>, col: ColumnConfig<T>, dir: 1 | -1 | 0): void {
  grid.dispatchEvent(new CustomEvent('sort-change', { detail: { field: col.field, direction: dir } }));
  announce(
    grid,
    getA11yMessage(
      grid,
      dir === 0 ? 'sortCleared' : 'sortApplied',
      col.header ?? col.field,
      dir === 1 ? 'ascending' : 'descending',
    ),
  );
  // Trigger state change after sort applied
  grid.requestStateChange?.();
}

/**
 * Check whether the grid has plugins that inject synthetic rows into `_rows`
 * (group headers, tree nodes, pivot aggregates, etc.).
 * When true, sorting must go through the render scheduler so the full row-model
 * pipeline (reapplyCoreSort → processRows) runs on the base rows instead of
 * directly mutating _rows which would corrupt plugin-generated row structures.
 *
 * This intentionally ignores plugins that only filter or reorder rows (Filtering,
 * MultiSort) — direct in-place sorting is safe for those.
 */
function hasRowStructurePlugins(grid: GridHost): boolean {
  return grid._pluginManager?._hasRowStructurePlugins ?? false;
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

    // When row-model plugins are active (grouping, tree, etc.), delegate to the
    // render scheduler so #rebuildRowModel runs the full pipeline on base rows.
    if (hasRowStructurePlugins(grid)) {
      // RenderPhase.ROWS = 4 — triggers rebuildRowModel which skips reapplyCoreSort
      // when _sortState is null, then runs processRows to rebuild groups.
      grid._requestSchedulerPhase(4, 'sort-clear');
      emitSortChange(grid, col, 0);
      return;
    }

    // Fast path: no row-model plugins — direct _rows manipulation is safe.
    // Force full row rebuild after clearing sort so templated cells reflect original order
    grid.__rowRenderEpoch++;
    // Invalidate existing pooled row epochs so virtualization triggers a full inline rebuild
    for (let i = 0; i < grid._rowPool.length; i++) {
      grid._rowPool[i].__epoch = -1;
    }
    grid._rows = grid.__originalOrder.slice();
    grid.__originalOrder = [];
    renderHeader(grid);
    // After re-render ensure cleared column shows aria-sort="none" baseline.
    const headers = grid._headerRowEl?.querySelectorAll('[role="columnheader"].sortable');
    if (headers) {
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        if (!h.getAttribute('aria-sort')) h.setAttribute('aria-sort', 'none');
        else if (h.getAttribute('aria-sort') === 'ascending' || h.getAttribute('aria-sort') === 'descending') {
          // The active column was re-rendered already, but normalize any missing ones.
          if (!grid._sortState) h.setAttribute('aria-sort', 'none');
        }
      }
    }
    grid.refreshVirtualWindow(true);
    emitSortChange(grid, col, 0);
  }
}

/**
 * Re-apply the current core sort to rows during #rebuildRowModel.
 * Updates __originalOrder so "clear sort" restores the current dataset.
 * Returns rows unchanged if no core sort is active or handler is async.
 *
 * @param skipOriginalOrderSave - When true, caller already saved __originalOrder.
 *   Avoids an O(n) `rows.slice()` in the hot path.
 */
export function reapplyCoreSort<T>(grid: InternalGrid<T>, rows: T[], skipOriginalOrderSave = false): T[] {
  if (!grid._sortState) return rows;

  const handler: SortHandler<any> = grid.effectiveConfig?.sortHandler ?? builtInSort;

  // Reference equality gate: builtInSort is public API and must not mutate its input,
  // but internally we can bypass the copy when we know the caller already made one.
  // Do NOT replace with duck-typing or string comparison — the identity check is intentional.
  if (handler === builtInSort) {
    // Fast path: caller (#rebuildRowModel) already passed a copy of #rows.
    // Save a snapshot for "clear sort" unless the caller already did.
    if (!skipOriginalOrderSave) {
      grid.__originalOrder = rows.slice();
    }
    executeBuiltInSortInPlace(
      rows,
      grid._sortState!.field,
      grid._sortState!.direction,
      grid._columns as ColumnConfig<any>[],
    );
    return rows;
  }

  // Custom handler: preserve current behavior
  if (!skipOriginalOrderSave) {
    grid.__originalOrder = rows;
  }
  const result = handler(rows, grid._sortState, grid._columns as ColumnConfig<any>[]);
  if (result && typeof (result as Promise<unknown[]>).then === 'function') return rows;
  return result as T[];
}

/**
 * Apply a concrete sort direction to rows.
 *
 * Uses custom sortHandler from gridConfig if provided, otherwise uses built-in sorting.
 * Supports both sync and async handlers (for server-side sorting).
 *
 * When row-model plugins are active (grouping, tree, pivot), delegates to the render
 * scheduler so the full pipeline (reapplyCoreSort → processRows) runs on base rows.
 * This prevents sorting from corrupting plugin-generated row structures.
 */
export function applySort(grid: GridHost, col: ColumnConfig<any>, dir: 1 | -1): void {
  grid._sortState = { field: col.field, direction: dir };

  // When row-model plugins are active, delegate to the render scheduler.
  // #rebuildRowModel will call reapplyCoreSort on the base rows, then processRows
  // rebuilds groups/trees on the sorted data.
  if (hasRowStructurePlugins(grid)) {
    // RenderPhase.ROWS = 4
    grid._requestSchedulerPhase(4, 'sort-apply');
    emitSortChange(grid, col, dir);
    return;
  }

  // Fast path: no row-model plugins — sort _rows directly.
  const sortState: SortState = { field: col.field, direction: dir };
  const columns = grid._columns as ColumnConfig<any>[];

  // Get custom handler from effectiveConfig, or use built-in
  const handler: SortHandler<any> = grid.effectiveConfig?.sortHandler ?? builtInSort;

  // Reference equality gate — see comment in reapplyCoreSort above.
  if (handler === builtInSort) {
    // Fast path: sort grid._rows in-place — avoids allocating a 1M-element copy.
    // __originalOrder was already saved by toggleSort before calling applySort.
    executeBuiltInSortInPlace(grid._rows as any[], sortState.field, dir, columns);
    finalizeSortResult(grid, grid._rows, col, dir);
    return;
  }

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
