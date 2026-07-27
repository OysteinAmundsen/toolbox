/**
 * Filter Model Core Logic
 *
 * Pure functions for filtering operations.
 */

import type { FilterModel } from './types';

/**
 * Sentinel value used in set-filter unique values to represent rows with
 * no value (null, undefined, empty array via filterValue extractor).
 * Exported so server-side implementations can use the same constant.
 * @since 1.18.0
 */
export const BLANK_FILTER_VALUE = '(Blank)';

/** A row object as seen by the filter engine. */
type RowRecord = Record<string, unknown>;

/** A compiled filter predicate. */
type RowPredicate = (row: RowRecord) => boolean;

/** Resolves the comparable cell value for a row (direct or via extractor). */
type ValueGetter = (row: RowRecord) => unknown;

/** Optional extractor for complex cell values (arrays, objects, computed columns). */
type FilterValueExtractor = (value: unknown, row: RowRecord) => unknown | unknown[];

/**
 * Reject blanks before coercion. A value is blank when it is null, undefined,
 * '' or NaN (NaN is strictly an error state but is treated as "no value" here).
 * Kept intentionally loose (doesn't force a number type) so numeric strings,
 * Date objects and ISO date strings keep flowing through the coercion in
 * `>`/`<`/`toNumeric`.
 */
function isBlank(value: unknown): boolean {
  return value == null || value === '' || (typeof value === 'number' && isNaN(value));
}

/**
 * Convert a value to a comparable number.
 * Handles Date objects, numeric values, and date/ISO strings.
 */
function toNumeric(value: unknown): number {
  if (typeof value === 'number') return value;
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
 * Delegates to `compileFilter` to avoid duplicating operator logic. The compiled
 * predicate is created per call, so prefer `filterRows` (which pre-compiles once)
 * for bulk filtering.
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
  return compileFilter(filter, caseSensitive, filterValue)(row);
}

/**
 * Compile a single filter into a specialized predicate with pre-resolved values.
 * Avoids repeated type coercion and string conversion inside the hot loop.
 *
 * Delegates to one operator-family compiler at a time; the first that claims the
 * operator wins. Unknown operators pass every row through.
 */
function compileFilter(filter: FilterModel, caseSensitive: boolean, filterValue?: FilterValueExtractor): RowPredicate {
  const field = filter.field;

  // When a filterValue extractor is provided, use it instead of direct row[field]
  // access. This supports virtual/computed columns whose field doesn't exist on
  // the row data object.
  const getValue: ValueGetter = filterValue ? (row) => filterValue(row[field], row) : (row) => row[field];

  return (
    compileBlankPredicate(filter, getValue) ??
    compileSetPredicate(filter, field, filterValue) ??
    compileNumericPredicate(filter, field, getValue, filterValue === undefined) ??
    compileTextPredicate(filter, caseSensitive, getValue) ??
    // Unknown operator — pass row through
    (() => true)
  );
}

/**
 * `blank` / `notBlank` — no filter value needed.
 *
 * The blank test is inlined rather than delegating to {@link isBlank}: these are
 * the only predicates where the check IS the whole body, so the extra call would
 * be pure overhead in the per-row hot loop.
 */
function compileBlankPredicate(filter: FilterModel, getValue: ValueGetter): RowPredicate | undefined {
  if (filter.operator === 'blank')
    return (row) => {
      const v = getValue(row);
      return v == null || v === '' || (typeof v === 'number' && isNaN(v));
    };
  if (filter.operator === 'notBlank')
    return (row) => {
      const v = getValue(row);
      return v != null && v !== '' && !(typeof v === 'number' && isNaN(v));
    };
  return undefined;
}

/**
 * Set operators (`in` / `notIn`) — pre-convert the filter value to a Set for
 * O(1) lookups. With a `filterValue` extractor the extracted value may be an
 * array (multi-value cells); a row that yields no values matches the
 * {@link BLANK_FILTER_VALUE} sentinel.
 */
function compileSetPredicate(
  filter: FilterModel,
  field: string,
  filterValue?: FilterValueExtractor,
): RowPredicate | undefined {
  const op = filter.operator;
  if (op !== 'in' && op !== 'notIn') return undefined;

  const negate = op === 'notIn';
  if (!Array.isArray(filter.value)) return negate ? () => true : () => false;
  const lookup = new Set(filter.value);

  if (filterValue) {
    return (row) => {
      const extracted = filterValue(row[field], row);
      const values = Array.isArray(extracted) ? extracted : extracted != null ? [extracted] : [];
      const matched = values.length === 0 ? lookup.has(BLANK_FILTER_VALUE) : values.some((v) => lookup.has(v));
      return negate ? !matched : matched;
    };
  }
  return (row) => {
    const v = row[field];
    const matched = v == null || v === '' ? lookup.has(BLANK_FILTER_VALUE) : lookup.has(v);
    return negate ? !matched : matched;
  };
}

/**
 * Numeric / date operators — pre-resolve the threshold(s) once.
 *
 * When the filter type is `'number'` and there's no custom extractor, row values
 * are expected to already be JS numbers — emit a tighter predicate that skips
 * `toNumeric()`. When a `filterValue` extractor is present, always use the
 * cautious path since the extracted value may need conversion.
 *
 * Numeric comparisons must always exclude blank values, otherwise JS coercion
 * leaks them through (e.g. `null >= 0` is `true`, `Number('') === 0`). Blank rows
 * are only matched by the explicit `blank` operator.
 */
function compileNumericPredicate(
  filter: FilterModel,
  field: string,
  getValue: ValueGetter,
  noExtractor: boolean,
): RowPredicate | undefined {
  const op = filter.operator;
  const isNumType = filter.type === 'number' && noExtractor;

  if (op === 'greaterThan') {
    const threshold = toNumeric(filter.value);
    return isNumType
      ? (row) => {
          const v = row[field];
          return !isBlank(v) && (v as number) > threshold;
        }
      : (row) => {
          const v = getValue(row);
          if (isBlank(v)) return false;
          const n = toNumeric(v);
          return !isNaN(n) && n > threshold;
        };
  }
  if (op === 'greaterThanOrEqual') {
    const threshold = toNumeric(filter.value);
    return isNumType
      ? (row) => {
          const v = row[field];
          return !isBlank(v) && (v as number) >= threshold;
        }
      : (row) => {
          const v = getValue(row);
          if (isBlank(v)) return false;
          const n = toNumeric(v);
          return !isNaN(n) && n >= threshold;
        };
  }
  if (op === 'lessThan') {
    const threshold = toNumeric(filter.value);
    return isNumType
      ? (row) => {
          const v = row[field];
          return !isBlank(v) && (v as number) < threshold;
        }
      : (row) => {
          const v = getValue(row);
          if (isBlank(v)) return false;
          const n = toNumeric(v);
          return !isNaN(n) && n < threshold;
        };
  }
  if (op === 'lessThanOrEqual') {
    const threshold = toNumeric(filter.value);
    return isNumType
      ? (row) => {
          const v = row[field];
          return !isBlank(v) && (v as number) <= threshold;
        }
      : (row) => {
          const v = getValue(row);
          if (isBlank(v)) return false;
          const n = toNumeric(v);
          return !isNaN(n) && n <= threshold;
        };
  }
  if (op === 'between') {
    const lo = toNumeric(filter.value);
    const hi = toNumeric(filter.valueTo);
    return isNumType
      ? (row) => {
          const v = row[field];
          if (isBlank(v)) return false;
          const n = v as number;
          return n >= lo && n <= hi;
        }
      : (row) => {
          const v = getValue(row);
          if (isBlank(v)) return false;
          const n = toNumeric(v);
          return !isNaN(n) && n >= lo && n <= hi;
        };
  }
  return undefined;
}

/**
 * Text operators — pre-resolve the filter comparison value (and its lower-cased
 * form) once, then emit a case-sensitive or case-insensitive specialization.
 */
function compileTextPredicate(
  filter: FilterModel,
  caseSensitive: boolean,
  getValue: ValueGetter,
): RowPredicate | undefined {
  const op = filter.operator;
  const compareFilterValue = caseSensitive ? String(filter.value) : String(filter.value).toLowerCase();

  if (op === 'contains') {
    return caseSensitive
      ? (row) => {
          const v = getValue(row);
          return v != null && String(v).includes(compareFilterValue);
        }
      : (row) => {
          const v = getValue(row);
          return v != null && String(v).toLowerCase().includes(compareFilterValue);
        };
  }
  if (op === 'notContains') {
    return caseSensitive
      ? (row) => {
          const v = getValue(row);
          return v != null && !String(v).includes(compareFilterValue);
        }
      : (row) => {
          const v = getValue(row);
          return v != null && !String(v).toLowerCase().includes(compareFilterValue);
        };
  }
  if (op === 'equals') {
    return caseSensitive
      ? (row) => {
          const v = getValue(row);
          return v != null && String(v) === compareFilterValue;
        }
      : (row) => {
          const v = getValue(row);
          return v != null && String(v).toLowerCase() === compareFilterValue;
        };
  }
  if (op === 'notEquals') {
    return caseSensitive
      ? (row) => {
          const v = getValue(row);
          return v != null && String(v) !== compareFilterValue;
        }
      : (row) => {
          const v = getValue(row);
          return v != null && String(v).toLowerCase() !== compareFilterValue;
        };
  }
  if (op === 'startsWith') {
    return caseSensitive
      ? (row) => {
          const v = getValue(row);
          return v != null && String(v).startsWith(compareFilterValue);
        }
      : (row) => {
          const v = getValue(row);
          return v != null && String(v).toLowerCase().startsWith(compareFilterValue);
        };
  }
  if (op === 'endsWith') {
    return caseSensitive
      ? (row) => {
          const v = getValue(row);
          return v != null && String(v).endsWith(compareFilterValue);
        }
      : (row) => {
          const v = getValue(row);
          return v != null && String(v).toLowerCase().endsWith(compareFilterValue);
        };
  }
  return undefined;
}

/**
 * Filter rows based on multiple filter conditions (AND logic).
 * All filters must match for a row to be included.
 *
 * Pre-compiles each filter into a specialized predicate to avoid
 * repeated type coercion and branch checks inside the hot loop.
 *
 * @param rows - The rows to filter
 * @param filters - Array of filters to apply
 * @param caseSensitive - Whether text comparisons are case sensitive
 * @param filterValues - Optional map of field → value extractor for complex columns
 * @returns Filtered rows
 */
export function filterRows<T extends Record<string, unknown>>(
  rows: readonly T[],
  filters: FilterModel[],
  caseSensitive = false,
  filterValues?: Map<string, (value: unknown, row: T) => unknown | unknown[]>,
): T[] {
  if (!filters.length) return rows as T[];

  // Pre-compile all filters into specialized predicates
  const predicates = filters.map((f) =>
    compileFilter(
      f,
      caseSensitive,
      filterValues?.get(f.field) as ((value: unknown, row: Record<string, unknown>) => unknown | unknown[]) | undefined,
    ),
  );

  // Single-filter fast path avoids per-row loop overhead
  if (predicates.length === 1) {
    return rows.filter(predicates[0]);
  }

  return rows.filter((row) => {
    for (let i = 0; i < predicates.length; i++) {
      if (!predicates[i](row)) return false;
    }
    return true;
  });
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
  let hasBlank = false;
  for (const row of rows) {
    const cellValue = row[field];
    if (filterValue) {
      const extracted = filterValue(cellValue, row);
      if (Array.isArray(extracted)) {
        if (extracted.length === 0) {
          hasBlank = true;
        }
        for (const v of extracted) {
          if (v != null) values.add(v);
        }
      } else if (extracted != null) {
        values.add(extracted);
      } else {
        hasBlank = true;
      }
    } else {
      if (cellValue != null && cellValue !== '') {
        values.add(cellValue);
      } else {
        hasBlank = true;
      }
    }
  }
  // When some rows have no values (null, undefined, or empty string),
  // include a "(Blank)" sentinel so users can explicitly filter empty rows.
  if (hasBlank) {
    values.add(BLANK_FILTER_VALUE);
  }
  return [...values].sort((a, b) => {
    // Handle mixed types gracefully
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    return String(a).localeCompare(String(b));
  });
}

/**
 * Extract unique values for multiple fields in a single pass through the rows.
 * This is more efficient than calling `getUniqueValues` N times when
 * computing derived state for several set filters at once.
 *
 * @param rows - The rows to extract values from
 * @param fields - Array of { field, filterValue? } descriptors
 * @returns Map of field → sorted unique values (same contract as `getUniqueValues`)
 */
export function getUniqueValuesBatch<T extends Record<string, unknown>>(
  rows: T[],
  fields: { field: string; filterValue?: (value: unknown, row: T) => unknown | unknown[] }[],
): Map<string, unknown[]> {
  // Per-field accumulators
  const acc = new Map<string, { values: Set<unknown>; hasBlank: boolean; hasExtractor: boolean }>();
  for (const { field, filterValue } of fields) {
    acc.set(field, { values: new Set(), hasBlank: false, hasExtractor: !!filterValue });
  }

  // Single pass through all rows
  for (const row of rows) {
    for (const { field, filterValue } of fields) {
      const entry = acc.get(field)!;
      const cellValue = row[field];
      if (filterValue) {
        const extracted = filterValue(cellValue, row);
        if (Array.isArray(extracted)) {
          if (extracted.length === 0) entry.hasBlank = true;
          for (const v of extracted) {
            if (v != null) entry.values.add(v);
          }
        } else if (extracted != null) {
          entry.values.add(extracted);
        } else {
          entry.hasBlank = true;
        }
      } else {
        if (cellValue != null && cellValue !== '') {
          entry.values.add(cellValue);
        } else {
          entry.hasBlank = true;
        }
      }
    }
  }

  // Build sorted output
  const result = new Map<string, unknown[]>();
  for (const [field, { values, hasBlank }] of acc) {
    if (hasBlank) values.add(BLANK_FILTER_VALUE);
    result.set(
      field,
      [...values].sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
      }),
    );
  }
  return result;
}
