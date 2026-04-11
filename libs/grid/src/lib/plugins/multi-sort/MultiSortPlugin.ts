/**
 * Multi-Sort Plugin (Class-based)
 *
 * Provides multi-column sorting capabilities for tbw-grid.
 * Supports shift+click for adding secondary sort columns.
 */

import { announce } from '../../core/internal/aria';
import { BaseGridPlugin, HeaderClickEvent, type PluginManifest, type PluginQuery } from '../../core/plugin/base-plugin';
import type { ColumnState, GridHost } from '../../core/types';
import { getSortDirection, getSortIndex, sortRowsInPlace, toggleSort } from './multi-sort';
import styles from './multi-sort.css?inline';
import type { MultiSortConfig, SortModel } from './types';

/**
 * Multi-Sort Plugin for tbw-grid
 *
 * Enables sorting by multiple columns at once—hold Shift and click additional column
 * headers to build up a sort stack. Priority badges show the sort order, so users
 * always know which column takes precedence.
 *
 * ## Installation
 *
 * ```ts
 * import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';
 * ```
 *
 * ## Keyboard Shortcuts
 *
 * | Shortcut | Action |
 * |----------|--------|
 * | `Click header` | Sort by column (clears other sorts) |
 * | `Shift + Click` | Add column to multi-sort stack |
 * | `Ctrl + Click` | Toggle sort direction |
 *
 * ## Events
 *
 * | Event | Detail | Description |
 * |-------|--------|-------------|
 * | `sort-change` | `{ sortModel: SortModel[] }` | Fired when sort changes |
 *
 * @example Basic Multi-Column Sorting
 * ```ts
 * import { queryGrid } from '@toolbox-web/grid';
 * import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';
 *
 * const grid = queryGrid('tbw-grid');
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'name', header: 'Name', sortable: true },
 *     { field: 'department', header: 'Department', sortable: true },
 *     { field: 'salary', header: 'Salary', type: 'number', sortable: true },
 *   ],
 *   plugins: [new MultiSortPlugin({ maxSortColumns: 3, showSortIndex: true })],
 * };
 *
 * grid.on('sort-change', ({ sortModel }) => {
 *   console.log('Active sorts:', sortModel);
 * });
 * ```
 *
 * @example Initial Sort Configuration
 * ```ts
 * new MultiSortPlugin({
 *   initialSort: [
 *     { field: 'department', direction: 'asc' },
 *     { field: 'salary', direction: 'desc' },
 *   ],
 * })
 * ```
 *
 * @see {@link MultiSortConfig} for all configuration options
 * @see {@link SortModel} for the sort model structure
 *
 * @internal Extends BaseGridPlugin
 */
export class MultiSortPlugin extends BaseGridPlugin<MultiSortConfig> {
  /**
   * Plugin manifest declaring query types this plugin responds to.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    queries: [
      { type: 'sort:get-model', description: 'Returns the current multi-sort model as SortModel[]' },
      { type: 'sort:set-model', description: 'Sets the multi-sort model from context (SortModel[])' },
    ],
  };

  /** @internal */
  readonly name = 'multiSort';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<MultiSortConfig> {
    return {
      maxSortColumns: 3,
      showSortIndex: true,
    };
  }

  // #region Internal State
  private sortModel: SortModel[] = [];
  /** Cached sort result — returned as-is while a row edit is active to prevent
   *  the edited row from jumping to a new sorted position mid-edit. Row data
   *  mutations are still visible because the array holds shared object refs. */
  private cachedSortResult: unknown[] | null = null;

  /** Typed internal grid accessor. */
  get #internalGrid(): GridHost {
    return this.grid as unknown as GridHost;
  }

  /**
   * Clear the core `_sortState` so that only this plugin's `processRows`
   * sorting applies.  `ConfigManager.applyState()` always sets the core sort
   * state when restoring from storage, even when a plugin handles sorting.
   * Without this, the stale core state leaks into `collectState()` and
   * `reapplyCoreSort()` after the plugin clears its own model.
   */
  private clearCoreSortState(): void {
    this.#internalGrid._sortState = null;
  }
  // #endregion

  // #region Lifecycle

  /** @internal */
  override detach(): void {
    this.sortModel = [];
    this.cachedSortResult = null;
  }
  // #endregion

  // #region Query System

  /** @internal */
  override handleQuery(query: PluginQuery): unknown {
    switch (query.type) {
      case 'sort:get-model':
        return [...this.sortModel];
      case 'sort:set-model': {
        const model = query.context;
        if (!Array.isArray(model)) return false;
        this.sortModel = [...model] as SortModel[];
        this.clearCoreSortState();
        this.emit('sort-change', { sortModel: [...this.sortModel] });
        this.requestRender();
        return true;
      }
      default:
        return undefined;
    }
  }

  // #endregion

  // #region Hooks

  /** @internal */
  override processRows(rows: readonly unknown[]): unknown[] {
    if (this.sortModel.length === 0) {
      this.cachedSortResult = null;
      return [...rows];
    }

    // Freeze sort order while a row is actively being edited (row mode only).
    // Re-sorting mid-edit would move the edited row to a new index while the
    // editors remain at the old position, causing data/UI mismatch.
    // In grid mode (_isGridEditMode) sorting is safe — afterCellRender
    // re-injects editors into the re-sorted cells.
    // We return the cached previous sort result (same object references, so
    // in-place value mutations are already visible) instead of unsorted input.
    const grid = this.#internalGrid;
    if (!grid._isGridEditMode && typeof grid._activeEditRows === 'number' && grid._activeEditRows !== -1) {
      if (this.cachedSortResult && this.cachedSortResult.length === rows.length) {
        return [...this.cachedSortResult];
      }
    }

    // Sort in-place — the input array is already a mutable copy from plugin-manager.
    // Pre-resolved comparator chain avoids column lookup on every pair comparison.
    const mutableRows = rows as unknown[];
    sortRowsInPlace(mutableRows, this.sortModel, this.columns);
    this.cachedSortResult = mutableRows;
    return mutableRows;
  }

  /** @internal */
  override onHeaderClick(event: HeaderClickEvent): boolean {
    const column = this.columns.find((c) => c.field === event.field);
    if (!column?.sortable) return false;

    const shiftKey = event.originalEvent.shiftKey;
    const maxColumns = this.config.maxSortColumns ?? 3;

    this.sortModel = toggleSort(this.sortModel, event.field, shiftKey, maxColumns);
    this.clearCoreSortState();

    this.emit('sort-change', { sortModel: [...this.sortModel] });
    this.requestRender();
    this.grid?.requestStateChange?.();

    // Announce for screen readers
    if (this.sortModel.length > 0) {
      const labels = this.sortModel.map((s) => {
        const col = this.columns.find((c) => c.field === s.field);
        return `${col?.header ?? s.field} ${s.direction === 'asc' ? 'ascending' : 'descending'}`;
      });
      announce(this.gridElement!, `Sorted by ${labels.join(', then ')}`);
    } else {
      announce(this.gridElement!, 'Sort cleared');
    }

    return true;
  }

  /** @internal */
  override afterRender(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    const showIndex = this.config.showSortIndex !== false;

    const headerCells = gridEl.querySelectorAll('.header-row .cell[data-field]');
    headerCells.forEach((cell) => {
      const field = cell.getAttribute('data-field');
      if (!field) return;

      const sortIndex = getSortIndex(this.sortModel, field);
      const sortDir = getSortDirection(this.sortModel, field);

      // Remove existing sort index badge (always clean up)
      cell.querySelector('.sort-index')?.remove();

      if (sortDir) {
        const indicator = this.updateSortIndicator(cell, sortDir);

        // Add sort index badge if multiple columns sorted and showSortIndex is enabled
        if (showIndex && this.sortModel.length > 1 && sortIndex !== undefined) {
          const badge = document.createElement('span');
          badge.className = 'sort-index';
          badge.textContent = String(sortIndex);
          if (indicator.nextSibling) {
            cell.insertBefore(badge, indicator.nextSibling);
          } else {
            cell.appendChild(badge);
          }
        }
      } else if (cell.classList.contains('sortable')) {
        this.updateSortIndicator(cell, null);
      }
    });
  }
  // #endregion

  // #region Public API

  /**
   * Get the current sort model.
   * @returns Copy of the current sort model
   */
  getSortModel(): SortModel[] {
    return [...this.sortModel];
  }

  /**
   * Set the sort model programmatically.
   * @param model - New sort model to apply
   */
  setSortModel(model: SortModel[]): void {
    this.sortModel = [...model];
    this.clearCoreSortState();
    this.emit('sort-change', { sortModel: [...model] });
    this.requestRender();
    this.grid?.requestStateChange?.();
    if (model.length > 0) {
      const labels = model.map((s) => {
        const col = this.columns.find((c) => c.field === s.field);
        return `${col?.header ?? s.field} ${s.direction === 'asc' ? 'ascending' : 'descending'}`;
      });
      announce(this.gridElement!, `Sorted by ${labels.join(', then ')}`);
    }
  }

  /**
   * Clear all sorting.
   */
  clearSort(): void {
    this.sortModel = [];
    this.clearCoreSortState();
    this.emit('sort-change', { sortModel: [] });
    this.requestRender();
    this.grid?.requestStateChange?.();
    announce(this.gridElement!, 'Sort cleared');
  }

  /**
   * Get the sort index (1-based) for a specific field.
   * @param field - Field to check
   * @returns 1-based index or undefined if not sorted
   */
  getSortIndex(field: string): number | undefined {
    return getSortIndex(this.sortModel, field);
  }

  /**
   * Get the sort direction for a specific field.
   * @param field - Field to check
   * @returns Sort direction or undefined if not sorted
   */
  getSortDirection(field: string): 'asc' | 'desc' | undefined {
    return getSortDirection(this.sortModel, field);
  }
  // #endregion

  // #region Column State Hooks

  /**
   * Return sort state for a column if it's in the sort model.
   * @internal
   */
  override getColumnState(field: string): Partial<ColumnState> | undefined {
    const index = this.sortModel.findIndex((s) => s.field === field);
    if (index === -1) return undefined;

    const sortEntry = this.sortModel[index];
    return {
      sort: {
        direction: sortEntry.direction,
        priority: index,
      },
    };
  }

  /**
   * Apply sort state from column state.
   * Rebuilds the sort model from all column states.
   * @internal
   */
  override applyColumnState(field: string, state: ColumnState): void {
    // Only process if the column has sort state
    if (!state.sort) {
      // Remove this field from sortModel if it exists
      this.sortModel = this.sortModel.filter((s) => s.field !== field);
      return;
    }

    // Find existing entry or add new one
    const existingIndex = this.sortModel.findIndex((s) => s.field === field);
    const newEntry: SortModel = {
      field,
      direction: state.sort.direction,
    };

    if (existingIndex !== -1) {
      // Update existing entry
      this.sortModel[existingIndex] = newEntry;
    } else {
      // Add at the correct priority position
      this.sortModel.splice(state.sort.priority, 0, newEntry);
    }

    // Clear core sort state — this plugin exclusively handles sorting via
    // processRows. The core _sortState is set by ConfigManager.applyState()
    // before plugins run; null it so reapplyCoreSort() is a no-op.
    this.clearCoreSortState();
  }
  // #endregion
}
