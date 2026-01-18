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
 * @example
 * ```ts
 * new MultiSortPlugin({ maxSortColumns: 3, showSortIndex: true })
 * ```
 */
export class MultiSortPlugin extends BaseGridPlugin<MultiSortConfig> {
  readonly name = 'multiSort';
  override readonly styles = styles;

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

  override detach(): void {
    this.sortModel = [];
  }
  // #endregion

  // #region Hooks

  override processRows(rows: readonly unknown[]): unknown[] {
    if (this.sortModel.length === 0) {
      return [...rows];
    }
    return applySorts([...rows], this.sortModel, [...this.columns]);
  }

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
        // For unsorted columns, leave the base indicator (⇅) alone
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
