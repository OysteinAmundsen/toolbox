/**
 * Column Visibility Core Logic
 *
 * Pure functions for column visibility operations.
 */

import type { ColumnConfig } from '../../core/types';

/**
 * Filter columns to only include visible ones.
 *
 * @param columns - Array of column configurations
 * @param hidden - Set of hidden field names
 * @returns New array containing only visible columns
 */
export function filterVisibleColumns<TRow = unknown>(
  columns: ColumnConfig<TRow>[],
  hidden: Set<string>,
): ColumnConfig<TRow>[] {
  return columns.filter((col) => !hidden.has(col.field));
}

/**
 * Check if a column can be hidden.
 *
 * Mirrors the invariant enforced by the grid core (`config-manager.setColumnVisible`):
 * a column cannot be hidden if it is flagged `lockVisible`, or if hiding it would
 * leave zero visible columns.
 *
 * @param columns - All column configurations
 * @param field - Field to check
 * @param hidden - Currently hidden field names
 * @returns True if the column can be hidden
 */
export function canHideColumn<TRow = unknown>(
  columns: ColumnConfig<TRow>[],
  field: string,
  hidden: Set<string>,
): boolean {
  const col = columns.find((c) => c.field === field);

  // Cannot hide columns marked with lockVisible
  if (col?.lockVisible) return false;

  // At least one column must remain visible
  const visibleCount = columns.filter((c) => !hidden.has(c.field) && c.field !== field).length;
  return visibleCount > 0;
}

/**
 * Toggle column visibility state.
 *
 * @param hidden - Current set of hidden field names
 * @param field - Field to toggle
 * @param visible - Explicit visibility state (undefined = toggle)
 * @returns New Set with updated hidden state
 */
export function toggleColumnVisibility(hidden: Set<string>, field: string, visible?: boolean): Set<string> {
  const newHidden = new Set(hidden);

  if (visible === undefined) {
    // Toggle mode
    if (newHidden.has(field)) {
      newHidden.delete(field);
    } else {
      newHidden.add(field);
    }
  } else if (visible) {
    // Explicitly show
    newHidden.delete(field);
  } else {
    // Explicitly hide
    newHidden.add(field);
  }

  return newHidden;
}
