/**
 * Multi-Sort Core Logic
 *
 * Pure functions for multi-column sorting operations.
 */

import type { ColumnConfig } from '../../core/types';
import type { SortModel } from './types';

/**
 * Apply multiple sort columns to a row array.
 * Sorts are applied in order - first sort has highest priority.
 *
 * @param rows - Array of row objects to sort
 * @param sorts - Ordered array of sort configurations
 * @param columns - Column configurations (for custom comparators)
 * @returns New sorted array (does not mutate original)
 */
export function applySorts<TRow = unknown>(rows: TRow[], sorts: SortModel[], columns: ColumnConfig<TRow>[]): TRow[] {
  if (!sorts.length) return [...rows];

  return [...rows].sort((a, b) => {
    for (const sort of sorts) {
      const col = columns.find((c) => c.field === sort.field);
      const comparator = col?.sortComparator ?? defaultComparator;
      const aVal = (a as Record<string, unknown>)[sort.field];
      const bVal = (b as Record<string, unknown>)[sort.field];
      const result = comparator(aVal, bVal, a, b);
      if (result !== 0) {
        return sort.direction === 'asc' ? result : -result;
      }
    }
    return 0;
  });
}

/**
 * Default comparator for sorting values.
 * Handles nulls, numbers, dates, and strings.
 *
 * @param a - First value
 * @param b - Second value
 * @returns Comparison result (-1, 0, 1)
 */
export function defaultComparator(a: unknown, b: unknown): number {
  // Handle nulls/undefined - push to end
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  // Type-aware comparison
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  // Boolean comparison
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 0 : a ? -1 : 1;
  }

  // String comparison (fallback)
  return String(a).localeCompare(String(b));
}

/**
 * Toggle sort state for a field.
 * With shift key: adds/toggles in multi-sort list
 * Without shift key: replaces entire sort with single column
 *
 * @param current - Current sort model
 * @param field - Field to toggle
 * @param shiftKey - Whether shift key is held (multi-sort mode)
 * @param maxColumns - Maximum columns allowed in sort
 * @returns New sort model
 */
export function toggleSort(current: SortModel[], field: string, shiftKey: boolean, maxColumns: number): SortModel[] {
  const existing = current.find((s) => s.field === field);

  if (shiftKey) {
    // Multi-sort: add/toggle in list
    if (existing) {
      if (existing.direction === 'asc') {
        // Flip to descending
        return current.map((s) => (s.field === field ? { ...s, direction: 'desc' as const } : s));
      } else {
        // Remove from sort
        return current.filter((s) => s.field !== field);
      }
    } else if (current.length < maxColumns) {
      // Add new sort column
      return [...current, { field, direction: 'asc' as const }];
    }
    // Max columns reached, return unchanged
    return current;
  } else {
    // Single sort: replace all
    if (existing?.direction === 'asc') {
      return [{ field, direction: 'desc' }];
    } else if (existing?.direction === 'desc') {
      return [];
    }
    return [{ field, direction: 'asc' }];
  }
}

/**
 * Get the sort index (1-based) for a field in the sort model.
 * Returns undefined if the field is not in the sort model.
 *
 * @param sortModel - Current sort model
 * @param field - Field to check
 * @returns 1-based index or undefined
 */
export function getSortIndex(sortModel: SortModel[], field: string): number | undefined {
  const index = sortModel.findIndex((s) => s.field === field);
  return index >= 0 ? index + 1 : undefined;
}

/**
 * Get the sort direction for a field in the sort model.
 *
 * @param sortModel - Current sort model
 * @param field - Field to check
 * @returns Sort direction or undefined if not sorted
 */
export function getSortDirection(sortModel: SortModel[], field: string): 'asc' | 'desc' | undefined {
  return sortModel.find((s) => s.field === field)?.direction;
}
