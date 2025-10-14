/**
 * Filter Model Core Logic
 *
 * Pure functions for filtering operations.
 */

import type { FilterModel } from './types';

/**
 * Check if a single row matches a filter condition.
 *
 * @param row - The row data object
 * @param filter - The filter to apply
 * @param caseSensitive - Whether text comparisons are case sensitive
 * @returns True if the row matches the filter
 */
export function matchesFilter(row: Record<string, unknown>, filter: FilterModel, caseSensitive = false): boolean {
  const rawValue = row[filter.field];

  // Handle blank/notBlank first - these work on null/undefined/empty
  if (filter.operator === 'blank') {
    return rawValue == null || rawValue === '';
  }
  if (filter.operator === 'notBlank') {
    return rawValue != null && rawValue !== '';
  }

  // Null/undefined values don't match other filters
  if (rawValue == null) return false;

  // Prepare values for comparison
  const stringValue = String(rawValue);
  const compareValue = caseSensitive ? stringValue : stringValue.toLowerCase();
  const filterValue = caseSensitive ? String(filter.value) : String(filter.value).toLowerCase();

  switch (filter.operator) {
    // Text operators
    case 'contains':
      return compareValue.includes(filterValue);

    case 'notContains':
      return !compareValue.includes(filterValue);

    case 'equals':
      return compareValue === filterValue;

    case 'notEquals':
      return compareValue !== filterValue;

    case 'startsWith':
      return compareValue.startsWith(filterValue);

    case 'endsWith':
      return compareValue.endsWith(filterValue);

    // Number/Date operators (use raw numeric values)
    case 'lessThan':
      return Number(rawValue) < Number(filter.value);

    case 'lessThanOrEqual':
      return Number(rawValue) <= Number(filter.value);

    case 'greaterThan':
      return Number(rawValue) > Number(filter.value);

    case 'greaterThanOrEqual':
      return Number(rawValue) >= Number(filter.value);

    case 'between':
      return Number(rawValue) >= Number(filter.value) && Number(rawValue) <= Number(filter.valueTo);

    // Set operators
    case 'in':
      return Array.isArray(filter.value) && filter.value.includes(rawValue);

    case 'notIn':
      return Array.isArray(filter.value) && !filter.value.includes(rawValue);

    default:
      return true;
  }
}

/**
 * Filter rows based on multiple filter conditions (AND logic).
 * All filters must match for a row to be included.
 *
 * @param rows - The rows to filter
 * @param filters - Array of filters to apply
 * @param caseSensitive - Whether text comparisons are case sensitive
 * @returns Filtered rows
 */
export function filterRows<T extends Record<string, unknown>>(
  rows: T[],
  filters: FilterModel[],
  caseSensitive = false
): T[] {
  if (!filters.length) return rows;
  return rows.filter((row) => filters.every((f) => matchesFilter(row, f, caseSensitive)));
}

/**
 * Compute a cache key for a set of filters.
 * Used for memoization of filter results.
 *
 * @param filters - Array of filters
 * @returns Stable string key for the filter set
 */
export function computeFilterCacheKey(filters: FilterModel[]): string {
  return JSON.stringify(
    filters.map((f) => ({
      field: f.field,
      operator: f.operator,
      value: f.value,
      valueTo: f.valueTo,
    }))
  );
}

/**
 * Extract unique values from a field across all rows.
 * Useful for populating "set" filter dropdowns.
 *
 * @param rows - The rows to extract values from
 * @param field - The field name
 * @returns Sorted array of unique non-null values
 */
export function getUniqueValues<T extends Record<string, unknown>>(rows: T[], field: string): unknown[] {
  const values = new Set<unknown>();
  for (const row of rows) {
    const value = row[field];
    if (value != null) {
      values.add(value);
    }
  }
  return [...values].sort((a, b) => {
    // Handle mixed types gracefully
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    return String(a).localeCompare(String(b));
  });
}
