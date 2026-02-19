/**
 * Filter Model Core Logic
 *
 * Pure functions for filtering operations.
 */

import type { FilterModel } from './types';

/**
 * Convert a value to a comparable number.
 * Handles Date objects, numeric values, and date/ISO strings.
 */
function toNumeric(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  const n = Number(value);
  if (!isNaN(n)) return n;
  // Try parsing as a date string (ISO 8601, etc.)
  const d = new Date(value as string);
  return d.getTime(); // NaN if unparseable
}

/**
 * Check if a single row matches a filter condition.
 *
 * @param row - The row data object
 * @param filter - The filter to apply
 * @param caseSensitive - Whether text comparisons are case sensitive
 * @param filterValue - Optional extractor for complex cell values (arrays, objects)
 * @returns True if the row matches the filter
 */
export function matchesFilter(
  row: Record<string, unknown>,
  filter: FilterModel,
  caseSensitive = false,
  filterValue?: (value: unknown, row: Record<string, unknown>) => unknown | unknown[],
): boolean {
  const rawValue = row[filter.field];

  // Handle blank/notBlank first - these work on null/undefined/empty
  if (filter.operator === 'blank') {
    return rawValue == null || rawValue === '';
  }
  if (filter.operator === 'notBlank') {
    return rawValue != null && rawValue !== '';
  }

  // When a filterValue extractor is present, use array-aware matching for set operators.
  // Each extracted value is checked individually against the filter set.
  if (filterValue && (filter.operator === 'notIn' || filter.operator === 'in')) {
    const extracted = filterValue(rawValue, row);
    const values = Array.isArray(extracted) ? extracted : extracted != null ? [extracted] : [];

    if (filter.operator === 'notIn') {
      // Row is hidden if ANY extracted value is in the excluded set.
      // Empty values array (null/empty cell) → vacuously passes (no value to exclude).
      const excluded = filter.value;
      if (!Array.isArray(excluded)) return true;
      return !values.some((v) => excluded.includes(v));
    }
    if (filter.operator === 'in') {
      // Row passes if ANY extracted value is in the included set.
      const included = filter.value;
      return Array.isArray(included) && values.some((v) => included.includes(v));
    }
  }

  // Set operators handle null explicitly: null is never "in" a set,
  // and null is never excluded by "notIn" (it's not a listed value).
  if (filter.operator === 'notIn') {
    if (rawValue == null) return true;
    return Array.isArray(filter.value) && !filter.value.includes(rawValue);
  }
  if (filter.operator === 'in') {
    return Array.isArray(filter.value) && filter.value.includes(rawValue);
  }

  // Null/undefined values don't match other filters
  if (rawValue == null) return false;

  // Prepare values for comparison
  const stringValue = String(rawValue);
  const compareValue = caseSensitive ? stringValue : stringValue.toLowerCase();
  const compareFilterValue = caseSensitive ? String(filter.value) : String(filter.value).toLowerCase();

  switch (filter.operator) {
    // Text operators
    case 'contains':
      return compareValue.includes(compareFilterValue);

    case 'notContains':
      return !compareValue.includes(compareFilterValue);

    case 'equals':
      return compareValue === compareFilterValue;

    case 'notEquals':
      return compareValue !== compareFilterValue;

    case 'startsWith':
      return compareValue.startsWith(compareFilterValue);

    case 'endsWith':
      return compareValue.endsWith(compareFilterValue);

    // Number/Date operators (use toNumeric for Date objects and date strings)
    case 'lessThan':
      return toNumeric(rawValue) < toNumeric(filter.value);

    case 'lessThanOrEqual':
      return toNumeric(rawValue) <= toNumeric(filter.value);

    case 'greaterThan':
      return toNumeric(rawValue) > toNumeric(filter.value);

    case 'greaterThanOrEqual':
      return toNumeric(rawValue) >= toNumeric(filter.value);

    case 'between':
      return toNumeric(rawValue) >= toNumeric(filter.value) && toNumeric(rawValue) <= toNumeric(filter.valueTo);

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
 * @param filterValues - Optional map of field → value extractor for complex columns
 * @returns Filtered rows
 */
export function filterRows<T extends Record<string, unknown>>(
  rows: T[],
  filters: FilterModel[],
  caseSensitive = false,
  filterValues?: Map<string, (value: unknown, row: T) => unknown | unknown[]>,
): T[] {
  if (!filters.length) return rows;
  return rows.filter((row) =>
    filters.every((f) =>
      matchesFilter(
        row,
        f,
        caseSensitive,
        filterValues?.get(f.field) as
          | ((value: unknown, row: Record<string, unknown>) => unknown | unknown[])
          | undefined,
      ),
    ),
  );
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
    })),
  );
}

/**
 * Extract unique values from a field across all rows.
 * Useful for populating "set" filter dropdowns.
 *
 * When `filterValue` is provided, the extractor is called for each row's cell value.
 * If it returns an array, each element is added individually (flattened).
 * This enables complex-valued cells (e.g., arrays of objects) to expose
 * their individual filterable values.
 *
 * @param rows - The rows to extract values from
 * @param field - The field name
 * @param filterValue - Optional extractor for complex cell values
 * @returns Sorted array of unique non-null values
 */
export function getUniqueValues<T extends Record<string, unknown>>(
  rows: T[],
  field: string,
  filterValue?: (value: unknown, row: T) => unknown | unknown[],
): unknown[] {
  const values = new Set<unknown>();
  for (const row of rows) {
    const cellValue = row[field];
    if (filterValue) {
      const extracted = filterValue(cellValue, row);
      if (Array.isArray(extracted)) {
        for (const v of extracted) {
          if (v != null) values.add(v);
        }
      } else if (extracted != null) {
        values.add(extracted);
      }
    } else {
      if (cellValue != null) {
        values.add(cellValue);
      }
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
