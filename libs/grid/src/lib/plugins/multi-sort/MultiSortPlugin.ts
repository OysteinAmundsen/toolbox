/**
 * Multi-Sort Plugin (Class-based)
 *
 * Provides multi-column sorting capabilities for tbw-grid.
 * Supports shift+click for adding secondary sort columns.
 */

import { BaseGridPlugin, HeaderClickEvent } from '../../core/plugin/base-plugin';
import type { ColumnState } from '../../core/types';
import { applySorts, getSortDirection, getSortIndex, toggleSort } from './multi-sort';
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
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `maxSortColumns` | `number` | `3` | Maximum columns to sort by |
 * | `showSortIndex` | `boolean` | `true` | Show sort priority badges |
 * | `initialSort` | `SortModel[]` | - | Pre-configured sort order on load |
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
 * ## Programmatic API
 *
 * | Method | Signature | Description |
 * |--------|-----------|-------------|
 * | `setSort` | `(sortModel: SortModel[]) => void` | Set sort programmatically |
 * | `getSortModel` | `() => SortModel[]` | Get current sort model |
 * | `clearSort` | `() => void` | Clear all sorting |
 * | `addSort` | `(field, direction) => void` | Add a column to sort |
 * | `removeSort` | `(field) => void` | Remove a column from sort |
 *
 * @example Basic Multi-Column Sorting
 * ```ts
 * import '@toolbox-web/grid';
 * import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';
 *
 * const grid = document.querySelector('tbw-grid');
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'name', header: 'Name', sortable: true },
 *     { field: 'department', header: 'Department', sortable: true },
 *     { field: 'salary', header: 'Salary', type: 'number', sortable: true },
 *   ],
 *   plugins: [new MultiSortPlugin({ maxSortColumns: 3, showSortIndex: true })],
 * };
 *
 * grid.addEventListener('sort-change', (e) => {
 *   console.log('Active sorts:', e.detail.sortModel);
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
  // #endregion

  // #region Lifecycle

  /** @internal */
  override detach(): void {
    this.sortModel = [];
  }
  // #endregion

  // #region Hooks

  /** @internal */
  override processRows(rows: readonly unknown[]): unknown[] {
    if (this.sortModel.length === 0) {
      return [...rows];
    }
    return applySorts([...rows], this.sortModel, [...this.columns]);
  }

  /** @internal */
  override onHeaderClick(event: HeaderClickEvent): boolean {
    const column = this.columns.find((c) => c.field === event.field);
    if (!column?.sortable) return false;

    const shiftKey = event.originalEvent.shiftKey;
    const maxColumns = this.config.maxSortColumns ?? 3;

    this.sortModel = toggleSort(this.sortModel, event.field, shiftKey, maxColumns);

    this.emit('sort-change', { sortModel: [...this.sortModel] });
    this.requestRender();

    return true;
  }

  /** @internal */
  override afterRender(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    const showIndex = this.config.showSortIndex !== false;

    // Update all sortable header cells with sort indicators
    const headerCells = gridEl.querySelectorAll('.header-row .cell[data-field]');
    headerCells.forEach((cell) => {
      const field = cell.getAttribute('data-field');
      if (!field) return;

      const sortIndex = getSortIndex(this.sortModel, field);
      const sortDir = getSortDirection(this.sortModel, field);

      // Remove existing sort index badge (always clean up)
      const existingBadge = cell.querySelector('.sort-index');
      existingBadge?.remove();

      if (sortDir) {
        // Column is sorted - remove base indicator and add our own
        const existingIndicator = cell.querySelector('[part~="sort-indicator"], .sort-indicator');
        existingIndicator?.remove();

        cell.setAttribute('data-sort', sortDir);

        // Add sort arrow indicator - insert BEFORE filter button and resize handle
        // to maintain consistent order: [label, sort-indicator, sort-index, filter-btn, resize-handle]
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        // Use grid-level icons (fall back to defaults)
        this.setIcon(indicator, this.resolveIcon(sortDir === 'asc' ? 'sortAsc' : 'sortDesc'));

        // Find insertion point: before filter button or resize handle
        const filterBtn = cell.querySelector('.tbw-filter-btn');
        const resizeHandle = cell.querySelector('.resize-handle');
        const insertBefore = filterBtn ?? resizeHandle;
        if (insertBefore) {
          cell.insertBefore(indicator, insertBefore);
        } else {
          cell.appendChild(indicator);
        }

        // Add sort index badge if multiple columns sorted and showSortIndex is enabled
        if (showIndex && this.sortModel.length > 1 && sortIndex !== undefined) {
          const badge = document.createElement('span');
          badge.className = 'sort-index';
          badge.textContent = String(sortIndex);
          // Insert badge right after the indicator
          if (indicator.nextSibling) {
            cell.insertBefore(badge, indicator.nextSibling);
          } else {
            cell.appendChild(badge);
          }
        }
      } else {
        cell.removeAttribute('data-sort');
        // Remove any stale sort indicators left by a previous afterRender cycle
        // Base indicators use part="sort-indicator", plugin indicators use class="sort-indicator"
        const staleIndicator = cell.querySelector('[part~="sort-indicator"], .sort-indicator');
        staleIndicator?.remove();
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
    this.emit('sort-change', { sortModel: [...model] });
    this.requestRender();
  }

  /**
   * Clear all sorting.
   */
  clearSort(): void {
    this.sortModel = [];
    this.emit('sort-change', { sortModel: [] });
    this.requestRender();
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

    // Re-sort the model by priority to ensure correct order
    // This is handled after all columns are processed, but we maintain order here
  }
  // #endregion
}
