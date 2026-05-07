/**
 * Multi-Sort Core Logic
 *
 * Pure functions for multi-column sorting operations.
 */

import { resolveCellValue } from '../../core/internal/value-accessor';
import type { ColumnConfig } from '../../core/types';
import type { SortModel } from './types';

// Module-level cached collator. `String.prototype.localeCompare(b)` (no args)
// lazily allocates a fresh Intl.Collator on every call in V8 — measurable on
// large datasets where string comparisons dominate the secondary sort key.
// A single cached `Intl.Collator` reused via `.compare(a, b)` is ~3-5x faster.
const stringCollator = new Intl.Collator(undefined, { sensitivity: 'variant' });

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

  const copy = [...rows];
  sortRowsInPlace(copy, sorts, columns);
  return copy;
}

/**
 * Sort an array in-place using multiple sort columns.
 * Pre-resolves column comparators to avoid O(n·log·n·m) column lookups
 * inside the comparator.
 * @internal
 */
export function sortRowsInPlace<TRow = unknown>(rows: TRow[], sorts: SortModel[], columns: ColumnConfig<TRow>[]): void {
  if (!sorts.length) return;

  // Pre-resolve comparator chain — avoids columns.find() on every pair comparison
  const chain = sorts.map((sort) => {
    const col = columns.find((c) => c.field === sort.field);
    const comparator = col?.sortComparator ?? defaultComparator;
    // Pre-bind the value getter per link so the hot comparator path doesn't
    // re-evaluate `column?.valueAccessor` on every pair comparison. For the
    // common case (no valueAccessor) this collapses to a single property read.
    // Documented precedence: sortComparator → valueAccessor → field.
    const field = sort.field;
    const getValue: (row: TRow) => unknown = col?.valueAccessor
      ? (row: TRow) => resolveCellValue(row, col)
      : (row: TRow) => (row as Record<string, unknown>)[field];
    return {
      field,
      asc: sort.direction === 'asc',
      comparator,
      getValue,
      // Auto-pin `__loading` placeholder rows (e.g. ServerSidePlugin under `sortMode: 'local'`)
      // to the end ONLY when no custom comparator is configured. Custom comparators receive
      // the row pair as 3rd/4th args and own placeholder handling themselves.
      pinPlaceholders: !col?.sortComparator,
    };
  });

  // Only enable per-pair pin checks if the dataset *actually* contains loading
  // placeholders — for the common case (no `__loading` rows) we skip ~n·log·n
  // property reads + branch on the hot path. Single O(n) scan up front.
  const chainNeedsPin = chain.some((l) => l.pinPlaceholders);
  const needsPinScan = chainNeedsPin && hasLoadingRow(rows);

  // Schwartzian transform: extract sort keys ONCE per row up front, then sort
  // indices by the cached keys. `Array.prototype.sort` calls the comparator
  // ~n·log·n times; without caching, each call would re-extract every key
  // (2 sides × k columns = 2·k property reads / accessor invocations per
  // compare). Caching collapses ~2·k·n·log·n extractions to k·n. For 10K
  // rows × 2 keys that's 20K extractions instead of ~260K, and the comparator
  // body becomes a pure key-vs-key comparison the JIT can optimize tightly.
  const n = rows.length;
  const k = chain.length;
  const keys: unknown[] = new Array(n * k);
  for (let i = 0; i < n; i++) {
    const row = rows[i];
    const base = i * k;
    for (let j = 0; j < k; j++) {
      keys[base + j] = chain[j].getValue(row);
    }
  }

  // Index array — sort this and then permute `rows` in one pass at the end.
  // Typed array when it fits; falls back to plain Array for very large datasets.
  const indices: Uint32Array | number[] = n <= 0xffffffff ? new Uint32Array(n) : new Array(n);
  for (let i = 0; i < n; i++) indices[i] = i;

  const compareIndices = (ia: number, ib: number): number => {
    if (needsPinScan) {
      const pinned = pinLoadingRows(rows[ia], rows[ib]);
      if (pinned !== 0) return pinned;
    }
    const baseA = ia * k;
    const baseB = ib * k;
    for (let j = 0; j < k; j++) {
      const link = chain[j];
      // Custom comparators receive the row pair as 3rd/4th args; defaultComparator
      // ignores them. Keys are already cached so no extraction happens here.
      const result = link.comparator(keys[baseA + j], keys[baseB + j], rows[ia], rows[ib]);
      if (result !== 0) return link.asc ? result : -result;
    }
    return 0;
  };

  if (indices instanceof Uint32Array) {
    indices.sort(compareIndices);
  } else {
    (indices as number[]).sort(compareIndices);
  }

  // Permute rows in-place using the sorted index array. Single allocation of
  // a snapshot; then write back. Done in two passes to avoid clobbering.
  const snapshot = rows.slice();
  for (let i = 0; i < n; i++) {
    rows[i] = snapshot[indices[i]];
  }
}

/**
 * O(n) scan checking whether any row has the `__loading` placeholder marker.
 * Cheap relative to the O(n·log·n) sort, and lets us elide per-pair pin checks
 * when the dataset has no placeholders (the overwhelmingly common case).
 * @internal
 */
function hasLoadingRow(rows: readonly unknown[]): boolean {
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i] as { __loading?: unknown } | null)?.__loading === true) return true;
  }
  return false;
}

/**
 * Pin `__loading` placeholder rows (e.g. ServerSidePlugin under `sortMode: 'local'`)
 * to the end of the sorted array regardless of sort direction.
 *
 * Returns 0 when neither row is a placeholder, +1 when `a` is, -1 when `b` is.
 *
 * @internal
 */
function pinLoadingRows(a: unknown, b: unknown): number {
  const aLoading = (a as { __loading?: unknown } | null)?.__loading === true;
  const bLoading = (b as { __loading?: unknown } | null)?.__loading === true;
  if (aLoading === bLoading) return 0;
  return aLoading ? 1 : -1;
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

  // String comparison (fallback). Uses a module-level cached Intl.Collator
  // — see `stringCollator` declaration for rationale.
  return stringCollator.compare(typeof a === 'string' ? a : String(a), typeof b === 'string' ? b : String(b));
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
